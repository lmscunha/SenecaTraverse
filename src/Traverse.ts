/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { Shape, Open, Exact, Min, Skip } from 'shape'

import type {
  // Base Types
  Seneca,
  EntityID,
  UUID,
  Parental,
  ParentChildRelation,

  // Entity Types
  ChildInstance,
  RunEntity,
  TaskEntity,

  // Options
  TraverseOptionsFull,

  // Input Types
  FindDepsInput,
  FindChildrenInput,
  CreateTaskRunInput,
  TaskExecuteInput,
  DispatchInput,
  RunStartInput,
  RunStopInput,
  TaskCompleteInput,
  RunDidCompleteInput,
  RunClaimInput,

  // Output Types
  InvalidResult,
  FindDepsResult,
  FindChildrenResult,
  CreateTaskRunResult,
  CreateTaskRunRollbackResult,
  TaskExecuteResult,
  DispatchResult,
  RunStartResult,
  RunStopResult,
  TaskCompleteResult,
  RunDidCompleteResult,
  RunClaimResult,

  // Plugin
  TraversePlugin,
} from './types'

export type { TraverseOptions } from './types'

// Payload shapes for messages whose `.message()` schema can only say `Object`.
// Seneca validates each message arg with its bundled Gubu — that covers
// required + type, but not enum membership or nested entity structure. A `task`
// or `run` arriving over a transport is otherwise unchecked beyond "is an
// object". These shapes add the domain constraints Gubu can't express. The
// outer/inner `Open` let Seneca meta fields and the live entity's save$/load$
// methods pass through untouched.
const taskMsgShape = Shape(
  Open({
    task: Open({
      run_id: String,
      // Only read for ordering in dispatchNext, not from the message — so
      // skippable, but non-negative when a task does carry it.
      seq: Skip(Min(0, Number)),
      status: Exact('pending', 'dispatched', 'done'),
    }),
  }),
)
const runMsgShape = Shape(
  Open({
    run: Open({
      status: Exact('created', 'active', 'completed', 'stopped'),
    }),
  }),
)

// Validate a message payload with `shape` before the handler runs. Used only
// where the constraint is richer than the native `.message()` schema (see
// above). Shape throws a detailed ShapeError on mismatch, which Seneca surfaces
// as an invalid-message action error.
function shaped<M extends object, R>(
  shape: (msg: M) => unknown,
  fn: (this: Seneca, msg: M) => R,
): (this: Seneca, msg: M) => R {
  return function (this: Seneca, msg: M) {
    shape(msg)
    return fn.call(this, msg)
  }
}

function Traverse(this: Seneca, options: TraverseOptionsFull) {
  const seneca = this

  // A task may cross a transport first; whether it keeps its save$/load$ methods
  // depends on the transport (e.g. AWS SQS strips them to plain JSON). Rebuild
  // only when missing — the save$ guard reuses a method-preserving entity as-is,
  // so it's never double-wrapped.
  function createTaskEntity(raw: any): TaskEntity {
    if (raw && typeof raw.save$ === 'function') {
      return raw
    }
    return seneca.entity('sys/traversetask').data$(raw)
  }

  options.customRef = { ...options.customRef, 'sys/traversetask': 'run_id' }
  // New array, not push: parental may be the caller's (or shared defaults')
  // array — mutating it would append this relation again on a second .use().
  options.relations = {
    ...options.relations,
    parental: [
      ...options.relations.parental,
      ['sys/traverse', 'sys/traversetask'],
    ],
  }

  seneca
    .fix('sys:traverse')
    .message('find:deps', {}, msgFindDeps)
    .message('find:children', { rootEntityId: String }, msgFindChildren)
    .message(
      'on:run,do:create',
      { rootEntityId: String, taskMsg: String },
      msgCreateTaskRun,
    )
    .message(
      'on:task,do:execute',
      { task: Object },
      shaped(taskMsgShape, msgTaskExecute),
    )
    .message(
      'do:dispatch,on:task',
      { task: Object },
      shaped(taskMsgShape, msgDispatch),
    )
    .message('on:run,do:start', { runId: String }, msgRunStart)
    .message('on:run,do:stop', { runId: String }, msgRunStop)
    .message('on:task,do:complete', { taskId: String }, msgTaskComplete)
    .message(
      'on:run,did:complete',
      { run: Object },
      shaped(runMsgShape, msgRunDidComplete),
    )
    .message(
      'on:run,do:claim',
      { run: Object },
      shaped(runMsgShape, msgRunClaim),
    )

  // Entity pairs from a root, breadth-first, sorted by level then name.
  async function msgFindDeps(
    this: Seneca,
    msg: FindDepsInput,
  ): Promise<FindDepsResult> {
    const allRelations: Parental = options.relations.parental
    const rootEntity = msg.rootEntity || options.rootEntity
    const deps: ParentChildRelation[] = []

    const parentChildrenMap: Map<EntityID, EntityID[]> = new Map()

    for (const [parent, child] of allRelations) {
      if (!parentChildrenMap.has(parent)) {
        parentChildrenMap.set(parent, [])
      }

      parentChildrenMap.get(parent)!.push(child)
    }

    for (const children of parentChildrenMap.values()) {
      children.sort()
    }

    const visitedEntitiesSet: Set<EntityID> = new Set([rootEntity])
    let currentLevel: EntityID[] = [rootEntity]

    while (currentLevel.length > 0) {
      const nextLevel: EntityID[] = []
      let levelDeps: ParentChildRelation[] = []

      for (const parent of currentLevel) {
        const children = parentChildrenMap.get(parent) || []

        for (const child of children) {
          if (visitedEntitiesSet.has(child)) {
            continue
          }

          levelDeps.push([parent, child])
          visitedEntitiesSet.add(child)
          nextLevel.push(child)
        }
      }

      levelDeps = compareRelations(levelDeps)
      deps.push(...levelDeps)
      currentLevel = nextLevel
    }

    return {
      ok: true,
      deps,
    }
  }

  // All child instances with their parent relationship.
  async function msgFindChildren(
    this: Seneca,
    msg: FindChildrenInput,
  ): Promise<FindChildrenResult> {
    const rootEntity: EntityID = msg.rootEntity || options.rootEntity
    const rootEntityId = msg.rootEntityId
    const customRef = options.customRef
    const relationsQueueRes = await seneca.post('sys:traverse,find:deps', {
      rootEntity,
    })
    const relationsQueue = relationsQueueRes.deps

    const result: ChildInstance[] = []
    const parentInstanceMap = new Map<EntityID, Set<UUID>>()

    parentInstanceMap.set(rootEntity, new Set([rootEntityId]))

    for (const [parentCanon, childCanon] of relationsQueue) {
      const parentInstances = parentInstanceMap.get(parentCanon)

      if (!parentInstances || parentInstances.size === 0) {
        continue
      }

      const foreignRef =
        customRef[childCanon] || `${getEntityName(parentCanon)}_id`

      if (!parentInstanceMap.has(childCanon)) {
        parentInstanceMap.set(childCanon, new Set())
      }

      const childInstancesSet = parentInstanceMap.get(childCanon)

      const childQueryPromises = Array.from(parentInstances).map(
        async (parentId) => {
          const childInstances = await seneca.entity(childCanon).list$({
            [foreignRef]: parentId,
            fields$: ['id'],
          })

          return { parentId, childInstances }
        },
      )

      const queryResults = await Promise.all(childQueryPromises)

      for (const { parentId, childInstances } of queryResults) {
        for (const childInst of childInstances) {
          const childId = childInst.id

          childInstancesSet!.add(childId)

          result.push({
            parent_id: parentId,
            child_id: childId,
            parent_canon: parentCanon,
            child_canon: childCanon,
          })
        }
      }
    }

    return {
      ok: true,
      children: result,
    }
  }

  // Create a run and one task per child entity (topological order).
  async function msgCreateTaskRun(
    this: Seneca,
    msg: CreateTaskRunInput,
  ): Promise<
    CreateTaskRunResult | CreateTaskRunRollbackResult | InvalidResult
  > {
    const taskMsg = msg.taskMsg
    const rootEntity = msg.rootEntity || options.rootEntity
    const rootEntityId = msg.rootEntityId
    const isRootIncluded = options.rootExecute

    // task_msg is dispatched as an arbitrary Seneca pattern; gate it when set.
    const taskMsgAllow = options.taskMsgAllow
    if (taskMsgAllow.length > 0 && !taskMsgAllow.includes(taskMsg as string)) {
      seneca.log.error('task-msg-not-allowed', { task_msg: taskMsg })
      return { ok: false, why: 'task-msg-not-allowed' }
    }

    const run: RunEntity = await seneca.entity('sys/traverse').save$({
      root_entity: rootEntity,
      root_id: rootEntityId,
      status: 'created',
      task_msg: taskMsg,
      total_tasks: 0,
      completed_tasks: 0,
    })

    const findChildrenRes: FindChildrenResult = await seneca.post(
      'sys:traverse,find:children',
      {
        rootEntity,
        rootEntityId,
      },
    )

    // Depth per canon (parent + 1), stamped on each task as `seq`; dispatch
    // orders by it (topological, or deepest-first when `reverse`).
    const depthByCanon = new Map<EntityID, number>([[rootEntity, 0]])
    for (const child of findChildrenRes.children) {
      if (!depthByCanon.has(child.child_canon)) {
        depthByCanon.set(
          child.child_canon,
          (depthByCanon.get(child.parent_canon) ?? 0) + 1,
        )
      }
    }

    const taskSpecs: (ChildInstance & { seq: number })[] = []

    if (isRootIncluded) {
      taskSpecs.push({
        parent_id: rootEntityId,
        child_id: rootEntityId,
        parent_canon: rootEntity,
        child_canon: rootEntity,
        seq: 0,
      })
    }

    for (const child of findChildrenRes.children) {
      taskSpecs.push({
        ...child,
        seq: depthByCanon.get(child.child_canon) ?? 0,
      })
    }

    const tasksCreationRes: PromiseSettledResult<TaskEntity>[] =
      await Promise.allSettled(
        taskSpecs.map((spec) =>
          seneca.entity('sys/traversetask').save$({
            run_id: run.id,
            parent_id: spec.parent_id,
            child_id: spec.child_id,
            parent_canon: spec.parent_canon,
            child_canon: spec.child_canon,
            seq: spec.seq,
            status: 'pending',
            task_msg: run.task_msg,
          }),
        ),
      )

    const createdTasks: TaskEntity[] = []
    let taskFailedCount = 0

    tasksCreationRes.forEach((taskCreation, idx) => {
      const spec = taskSpecs[idx]!

      if (taskCreation.status === 'fulfilled') {
        createdTasks.push(taskCreation.value)
        return
      }

      taskFailedCount++
      seneca.log.error('task-create-failed', {
        child_canon: spec.child_canon,
        child_id: spec.child_id,
        err: taskCreation.reason,
      })
    })

    if (taskFailedCount > 0) {
      // Roll back so no run starts from a partial task set.
      const rollback = await Promise.allSettled([
        ...createdTasks.map((t) => t.remove$()),
        run.remove$(),
      ])
      // Best-effort: log a failed removal so a leak is observable.
      for (const outcome of rollback) {
        if (outcome.status === 'rejected') {
          seneca.log.error('task-create-rollback-failed', {
            run_id: run.id,
            err: outcome.reason,
          })
        }
      }
      return {
        ok: false,
        why: 'task-create-failed',
        tasksCreated: 0,
        tasksFailed: taskFailedCount,
      }
    }

    run.total_tasks = createdTasks.length
    await run.save$()

    return {
      ok: true,
      run,
      tasksCreated: createdTasks.length,
      tasksFailed: 0,
    }
  }

  // Execute a single Run task.
  async function msgTaskExecute(
    this: Seneca,
    msg: TaskExecuteInput,
  ): Promise<TaskExecuteResult> {
    const task: TaskEntity = createTaskEntity(msg.task)

    if (task.status == 'done' || task.status == 'dispatched') {
      return { ok: true }
    }

    task.status = 'dispatched'
    task.dispatched_at = Date.now()
    await task.save$()

    await seneca.post('sys:traverse,do:dispatch,on:task', { task })

    return { ok: true }
  }

  // Start a run: dispatch the first pending task (order set by the `reverse`
  // option) and return; each completion chains the next, one task in flight.
  async function msgRunStart(
    this: Seneca,
    msg: RunStartInput,
  ): Promise<RunStartResult | InvalidResult> {
    const runId = msg.runId

    const run: RunEntity = await seneca.entity('sys/traverse').load$(runId)

    if (!run?.status) {
      return { ok: false, why: 'run-entity-not-found' }
    }

    if (run.status === 'completed' || run.status === 'active') {
      return { ok: true, run }
    }

    run.status = 'active'
    run.started_at = Date.now()
    await run.save$()

    await dispatchNext(run.id)

    const startedRun: RunEntity = await seneca
      .entity('sys/traverse')
      .load$(run.id)

    return { ok: true, run: startedRun }
  }

  // Stop a run: halts dispatch of the next pending task.
  async function msgRunStop(
    this: Seneca,
    msg: RunStopInput,
  ): Promise<RunStopResult | InvalidResult> {
    const runId = msg.runId

    const run: RunEntity = await seneca.entity('sys/traverse').load$(runId)

    if (!run?.status) {
      return { ok: false, why: 'run-entity-not-found' }
    }

    if (run.status !== 'active') {
      return { ok: true, run }
    }

    run.status = 'stopped'
    await run.save$()

    return { ok: true, run }
  }

  // Deliver a task to its handler. Default posts in-process; a transport host
  // overrides this to enqueue. Either way the handler/worker posts do:complete
  // when the work is done, which chains the next task.
  async function msgDispatch(
    this: Seneca,
    msg: DispatchInput,
  ): Promise<DispatchResult> {
    const task: TaskEntity = createTaskEntity(msg.task)
    await seneca.post(task.task_msg, { task })
    return { ok: true }
  }

  async function msgTaskComplete(
    this: Seneca,
    msg: TaskCompleteInput,
  ): Promise<TaskCompleteResult> {
    const task: TaskEntity = await seneca
      .entity('sys/traversetask')
      .load$(msg.taskId)

    if (!task) {
      return { ok: true }
    }

    // Transition once — `done` is the idempotency marker against at-least-once
    // redelivery, so the counter can't advance or re-chain twice.
    if (task.status !== 'done') {
      task.status = 'done'
      task.done_at = Date.now()
      if (msg.result !== undefined) task.result = msg.result
      if (msg.fragment !== undefined) task.fragment = msg.fragment
      await task.save$()

      const run: RunEntity = await seneca
        .entity('sys/traverse')
        .load$(task.run_id)
      if (run) {
        run.completed_tasks = (run.completed_tasks ?? 0) + 1
        await run.save$()
      }

      await dispatchNext(task.run_id)
    }

    // Reload: dispatchNext may have finalised the run (status/completed_at).
    const run: RunEntity = await seneca
      .entity('sys/traverse')
      .load$(task.run_id)

    return { ok: true, doneTasks: run?.completed_tasks, run }
  }

  async function msgRunDidComplete(
    this: Seneca,
    _msg: RunDidCompleteInput,
  ): Promise<RunDidCompleteResult> {
    return { ok: true }
  }

  // Overridable: a distributed host swaps in a store-level CAS so the run
  // completes exactly once.
  async function msgRunClaim(
    this: Seneca,
    msg: RunClaimInput,
  ): Promise<RunClaimResult> {
    const run: RunEntity = await seneca.entity('sys/traverse').load$(msg.run.id)

    if (!run || run.status !== 'active') {
      return { ok: true, claimed: false, run }
    }

    if ((run.completed_tasks ?? 0) < run.total_tasks) {
      return { ok: true, claimed: false, run }
    }

    run.status = 'completed'
    run.completed_at = Date.now()
    await run.save$()

    return { ok: true, claimed: true, run }
  }

  // Claim the run, firing did:complete only for the winning caller.
  async function checkAndCompleteRun(runId: UUID): Promise<void> {
    const run: RunEntity = await seneca.entity('sys/traverse').load$(runId)

    if (!run || run.status !== 'active') {
      return
    }

    const claimRes: RunClaimResult = await seneca.post(
      'sys:traverse,on:run,do:claim',
      { run },
    )

    if (claimRes.claimed) {
      await seneca.post('sys:traverse,on:run,did:complete', {
        run: claimRes.run,
      })
    }
  }

  // Dispatch the next pending task, or finalise the run when none remain. One
  // query — filtered to the run, ordered by seq, one row — never scans the whole
  // task table. `reverse` picks the direction: deepest-first (-1) or, by
  // default, shallowest-first (1, topological). Only ONE task is dispatched per
  // call; completion arrives out-of-band via do:complete, which chains the next,
  // keeping exactly one task in flight (so no counter lock).
  //
  // Dispatch is fire-and-forget by default so a run stays stoppable mid-flight.
  // With `awaitDispatch` the do:execute post is awaited instead, flushing the
  // task-row save + transport send inside the caller's live invocation — needed
  // on a host that tears down the moment it returns (e.g. an AWS Lambda SQS
  // consumer freezes after the handler resolves, killing an unawaited dispatch
  // mid-save so the task message is never sent and the run stalls).
  async function dispatchNext(runId: UUID): Promise<void> {
    const run: RunEntity = await seneca.entity('sys/traverse').load$(runId)

    if (!run || run.status !== 'active') {
      return
    }

    const [next]: TaskEntity[] = await seneca.entity('sys/traversetask').list$({
      run_id: runId,
      status: 'pending',
      sort$: { seq: options.reverse ? -1 : 1 },
      limit$: 1,
    })

    if (!next) {
      await checkAndCompleteRun(runId)
      return
    }

    const dispatch = seneca
      .post('sys:traverse,on:task,do:execute', { task: next })
      .catch((err: unknown) =>
        seneca.log.error('dispatch-failed', { task_id: next.id, err }),
      )

    if (options.awaitDispatch) {
      await dispatch
    }
  }

  function compareRelations(
    relations: ParentChildRelation[],
  ): ParentChildRelation[] {
    return [...relations].sort(
      (a, b) =>
        a[0].localeCompare(b[0], undefined, { numeric: true }) ||
        a[1].localeCompare(b[1], undefined, { numeric: true }),
    )
  }

  function getEntityName(entityId: EntityID): string {
    const canonSeparatorIdx = entityId.lastIndexOf('/')
    return canonSeparatorIdx === -1
      ? entityId
      : entityId.slice(canonSeparatorIdx + 1)
  }
}

// Default options.
const defaults: TraverseOptionsFull = {
  // TODO: Enable debug logging
  debug: false,
  rootExecute: true,
  rootEntity: 'sys/user',
  reverse: false,
  awaitDispatch: false,
  taskMsgAllow: [],
  relations: {
    parental: [],
  },
  customRef: {},
}

Object.assign(Traverse, { defaults })

export default Traverse as TraversePlugin

if ('undefined' !== typeof module) {
  module.exports = Traverse
}
