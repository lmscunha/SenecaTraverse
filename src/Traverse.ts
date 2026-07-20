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

  // Seneca instance for entity access. scope:'root' uses seneca.root to bypass
  // principal-scoping, so a run can reach entities owned by other principals.
  const se = (): Seneca => (options.scope === 'root' ? seneca.root : seneca)

  function createTaskEntity(raw: any): TaskEntity {
    if (raw && typeof raw.save$ === 'function') {
      return raw
    }
    return se().entity('sys/traversetask').data$(raw)
  }

  // Per-run mutex. A completion is a read-modify-write on the run's
  // `completed_tasks` counter; concurrent do:complete calls for the same run
  // would otherwise interleave their load/increment/save and lose increments.
  // Serialising by run id keeps that counter update atomic within this process.
  // (A distributed host swaps the claim pin for a store-level conditional write
  // — see msgRunClaim.)
  const runLocks: Map<UUID, Promise<unknown>> = new Map()

  function withRunLock<T>(runId: UUID, fn: () => Promise<T>): Promise<T> {
    const prev = runLocks.get(runId) ?? Promise.resolve()
    // Run fn after prev settles either way, so one rejection can't wedge the
    // chain for the run.
    const next = prev.then(fn, fn)
    const tail = next.catch(() => undefined)
    runLocks.set(runId, tail)
    // Drop the entry once this call is the tail, so the map doesn't accumulate
    // an entry per completed run.
    tail.then(() => {
      if (runLocks.get(runId) === tail) {
        runLocks.delete(runId)
      }
    })
    return next
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
          const childInstances = await se()
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

    const run: RunEntity = await se().entity('sys/traverse').save$({
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
          se().entity('sys/traversetask').save$({
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
    const levelSizes: Record<string, number> = {}

    tasksCreationRes.forEach((taskCreation, idx) => {
      const spec = taskSpecs[idx]!

      if (taskCreation.status === 'fulfilled') {
        createdTasks.push(taskCreation.value)
        levelSizes[spec.seq] = (levelSizes[spec.seq] ?? 0) + 1
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
      await Promise.allSettled([
        ...createdTasks.map((t) => t.remove$()),
        run.remove$(),
      ])
      return {
        ok: false,
        why: 'task-create-failed',
        tasksCreated: 0,
        tasksFailed: taskFailedCount,
      }
    }

    run.total_tasks = createdTasks.length
    run.level_sizes = levelSizes
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

  // Start a run: async dispatches the deepest level (reverse-BFS, driven by
  // completions); sync runs the tasks in-process to completion.
  async function msgRunStart(
    this: Seneca,
    msg: RunStartInput,
  ): Promise<RunStartResult | InvalidResult> {
    const runId = msg.runId

    const run: RunEntity = await se().entity('sys/traverse').load$(runId)

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
      // Dispatch the deepest pending level; completions drive the walk upward.
      await withRunLock(run.id, () => advanceLevel(run.id))

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

    const run: RunEntity = await se().entity('sys/traverse').load$(runId)

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
    const existing: TaskEntity = await seneca
      .entity('sys/traversetask')
      .load$(msg.taskId)

    if (!existing) {
      return { ok: true }
    }

    return withRunLock(existing.run_id, async () => {
      // Reload inside the lock for the freshest status — an earlier queued
      // completion for this same task may have already marked it done.
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

        // O(1) counter bump — no per-completion scan of the task table.
        const run: RunEntity = await seneca
          .entity('sys/traverse')
          .load$(task.run_id)
        if (run) {
          run.completed_tasks = (run.completed_tasks ?? 0) + 1
          await run.save$()
        }
      }

      await advanceLevel(task.run_id)

      const run: RunEntity = await seneca
        .entity('sys/traverse')
        .load$(task.run_id)

      return { ok: true, doneTasks: run?.completed_tasks, run }
    })
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
    const run: RunEntity = await se().entity('sys/traverse').load$(msg.run.id)

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
    const run: RunEntity = await se().entity('sys/traverse').load$(runId)

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

  // Reverse-BFS level walk for async runs: dispatch the deepest not-yet-started
  // level, then advance one level shallower each time a level fully completes,
  // so a parent is dispatched only after all its children are done. Which level
  // to release is arithmetic on the O(1) completed_tasks counter against the
  // per-level sizes — the task table is scanned only to dispatch a level (once
  // per level), never per completion.
  async function advanceLevel(runId: UUID): Promise<void> {
    const run: RunEntity = await se().entity('sys/traverse').load$(runId)

    if (!run || run.status !== 'active') {
      return
    }

    const sizes = run.level_sizes ?? {}
    const seqsDesc = Object.keys(sizes)
      .map(Number)
      .sort((a, b) => b - a)
    const done = run.completed_tasks ?? 0

    let nextSeq: number | undefined
    if (done === 0) {
      nextSeq = seqsDesc[0]
    } else {
      let cum = 0
      let atBoundary = false
      for (let i = 0; i < seqsDesc.length; i++) {
        cum += sizes[seqsDesc[i]!] ?? 0
        if (done === cum) {
          nextSeq = seqsDesc[i + 1]
          atBoundary = true
          break
        }
      }
      // Mid-level: a level is still draining, nothing to release yet.
      if (!atBoundary) {
        return
      }
    }

    // Past the shallowest level — every task is done.
    if (nextSeq === undefined) {
      await checkAndCompleteRun(runId)
      return
    }

    const levelTasks: TaskEntity[] = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: runId, seq: nextSeq })

    for (const task of levelTasks) {
      if (task.status !== 'pending') {
        continue
      }

      // Fire-and-forget: siblings dispatch in parallel; completion arrives
      // out-of-band via do:complete. A rejected dispatch must not abort the
      // rest of the level or surface as an unhandled rejection.
      seneca
        .post('sys:traverse,on:task,do:execute', { task })
        .catch((err: unknown) =>
          seneca.log.error('async-dispatch-failed', { task_id: task.id, err }),
        )
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

  async function completeRunDirect(runId: UUID): Promise<void> {
    const run: RunEntity = await se().entity('sys/traverse').load$(runId)

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
  scope: 'principal',
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
