/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { Shape, Exact } from 'shape'

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

const validateMode = Shape(Exact('sync', 'async'))

function Traverse(this: Seneca, options: TraverseOptionsFull) {
  const seneca = this

  validateMode(options.mode)

  function createTaskEntity(raw: any): TaskEntity {
    if (raw && typeof raw.save$ === 'function') {
      return raw
    }
    return seneca.entity('sys/traversetask').data$(raw)
  }

  // A Run process can have multiple tasks as children.
  // Thus, this plugin automatically maps these relations for the client.
  options.customRef = { ...options.customRef, 'sys/traversetask': 'run_id' }
  // Build a new array instead of pushing in place: the incoming options may
  // share the defaults' `parental` reference, and mutating it would leak the
  // injected relation across plugin loads (accumulating duplicates).
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
    .message(
      'find:children',
      {
        rootEntityId: String,
      },
      msgFindChildren,
    )
    .message(
      'on:run,do:create',
      {
        rootEntityId: String,
        taskMsg: String,
      },
      msgCreateTaskRun,
    )
    .message(
      'on:task,do:execute',
      {
        task: Object,
      },
      msgTaskExecute,
    )
    .message(
      'do:dispatch,on:task',
      {
        task: Object,
      },
      msgDispatch,
    )
    .message(
      'on:run,do:start',
      {
        runId: String,
      },
      msgRunStart,
    )
    .message(
      'on:run,do:stop',
      {
        runId: String,
      },
      msgRunStop,
    )
    .message(
      'on:task,do:complete',
      {
        taskId: String,
      },
      msgTaskComplete,
    )
    .message('on:run,did:complete', { run: Object }, msgRunDidComplete)
    .message('on:run,do:claim', { run: Object }, msgRunClaim)

  // Returns a sorted list of entity pairs
  // starting from a given entity.
  // In breadth-first order, sorting first by level,
  // then alphabetically in each level.
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

  // Returns all discovered child
  // instances with their parent relationship.
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
          const childInstances = await seneca
            .entity(childCanon)
            .list$({
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

  // Create a run process and generate tasks
  // for each child entity to be executed.
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

    // `task_msg` is later dispatched as an arbitrary Seneca pattern. When an
    // allowlist is configured, refuse patterns outside it so untrusted callers
    // can't schedule arbitrary actions.
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

    // BFS depth per canon, derived from the (BFS-ordered) children: a canon's
    // depth is its parent's + 1. Stamped on each task as `seq` so async mode
    // can execute deepest-first.
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
      // Any creation failure is unrecoverable: remove the created tasks and the
      // run so the caller retries from a clean state (no partial run).
      const rollback = await Promise.allSettled([
        ...createdTasks.map((t) => t.remove$()),
        run.remove$(),
      ])
      // Rollback is best-effort: a failed remove$ can orphan a task or the run.
      // Log so the leak is observable rather than silent.
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
    // Deepest level, so the async driver knows where to start walking seq down.
    run.max_seq = createdTasks.reduce((m, t) => (t.seq > m ? t.seq : m), 0)
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

  // Start a run: async dispatches the single deepest pending task, then each
  // completion chains the next one (reverse-BFS, one task in flight at a time);
  // sync runs the tasks in-process to completion.
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

    if (options.mode === 'async') {
      // Dispatch the deepest pending task; each completion chains the next.
      await dispatchNext(run.id)

      const startedRun: RunEntity = await seneca
        .entity('sys/traverse')
        .load$(run.id)

      return { ok: true, run: startedRun }
    }

    const findChildrenRes: FindChildrenResult = await seneca.post(
      'sys:traverse,find:children',
      {
        rootEntity: 'sys/traverse',
        rootEntityId: run.id,
      },
    )

    processRunTasks(run, findChildrenRes.children)
    return { ok: true, run }
  }

  // Stop a Run process execution,
  // preventing the dispatching of the next pending child task.
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

    // Transition to done exactly once. `status === 'done'` is the persisted
    // idempotency marker: an at-least-once transport redelivering the same
    // completion (or a duplicate signal) must not advance the counter twice.
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

      // Chain the next task (deepest-first). Exactly one task is in flight at a
      // time, so completions never overlap and the counter needs no lock.
      await dispatchNext(task.run_id)
    }

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

  // Overridable pin: swap in a store-level CAS (e.g. DynamoDB attribute_not_exists)
  // for atomic distributed completion so did:complete fires exactly once.
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

  // Attempt to complete a run through the (overridable) claim pin, emitting
  // did:complete only for the caller that wins the claim — so the hook fires
  // exactly once per run regardless of how many tasks report done concurrently.
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

  // Async driver: dispatch the single deepest pending task. Each completion
  // calls this again, so exactly one task is in flight at a time — reverse-BFS
  // order (a parent runs only after every deeper task is done) with no
  // concurrent completions, hence no counter lock. When no pending task remains,
  // finalise the run through the (overridable) claim pin.
  //
  // The next task is found by walking `seq` down from `max_seq`, loading one
  // pending row per level (an indexed key lookup, not a full-table scan): the
  // first level with a pending task wins; an empty level drops one level
  // shallower. Cost is bounded by tree depth, independent of task count.
  async function dispatchNext(runId: UUID): Promise<void> {
    const run: RunEntity = await seneca.entity('sys/traverse').load$(runId)

    if (!run || run.status !== 'active') {
      return
    }

    for (let seq = run.max_seq ?? 0; seq >= 0; seq--) {
      const next: TaskEntity = await seneca
        .entity('sys/traversetask')
        .load$({ run_id: runId, seq, status: 'pending' })

      if (next) {
        // Fire-and-forget: completion arrives out-of-band via do:complete, which
        // chains the following task. A rejected dispatch must not surface as an
        // unhandled rejection.
        seneca
          .post('sys:traverse,on:task,do:execute', { task: next })
          .catch((err: unknown) =>
            seneca.log.error('async-dispatch-failed', {
              task_id: next.id,
              err,
            }),
          )
        return
      }
    }

    // No pending task at any level — finalise the run.
    await checkAndCompleteRun(runId)
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

  async function completeRunDirect(runId: UUID): Promise<void> {
    const run: RunEntity = await seneca.entity('sys/traverse').load$(runId)

    if (!run || run.status === 'stopped' || run.status === 'completed') {
      return
    }

    run.status = 'completed'
    run.completed_at = Date.now()
    await run.save$()
  }

  async function processRunTasks(
    runEnt: RunEntity,
    tasks: ChildInstance[],
  ): Promise<void> {
    if (tasks.length === 0) {
      await completeRunDirect(runEnt.id)
      return
    }

    let run = runEnt

    for (const taskToProcess of tasks) {
      run = await seneca
        .entity(taskToProcess.parent_canon)
        .load$(taskToProcess.parent_id)

      if (!run || run.status === 'stopped') {
        break
      }

      const task: TaskEntity = await seneca
        .entity('sys/traversetask')
        .load$(taskToProcess.child_id)

      if (!task) {
        continue
      }

      const canProcessNextTask =
        task.status !== 'dispatched' && task.status !== 'done'

      if (!canProcessNextTask) {
        continue
      }

      await seneca.post('sys:traverse,on:task,do:execute', {
        task,
      })
    }

    await completeRunDirect(runEnt.id)
  }
}

// Default options.
const defaults: TraverseOptionsFull = {
  // TODO: Enable debug logging
  debug: false,
  rootExecute: true,
  rootEntity: 'sys/user',
  mode: 'sync',
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
