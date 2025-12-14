/* Copyright © 2025 Seneca Project Contributors, MIT License. */

import { Optional } from 'gubu'

type EntityID = string
type UUID = string
type Timestamp = number
type Message = string | object

type ParentChildRelation = [EntityID, EntityID]
type Parental = ParentChildRelation[]

type ChildInstance = {
  parent_id: UUID
  child_id: UUID
  parent_canon: EntityID
  child_canon: EntityID
}

type Entity = {
  save$: Function
  load$: Function
  list$: Function
  remove$: Function
}

type RunEntity = {
  id: UUID
  root_entity: EntityID
  root_id: UUID
  task_msg: Message
  // TODO: add stop act
  status: 'created' | 'running' | 'completed' | 'stopped'
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
  started_at?: Timestamp
  completed_at?: Timestamp
} & Entity

type TaskEntity = {
  id: UUID
  run_id: UUID
  status: 'pending' | 'dispatched' | 'done' | 'failed'
  retry: number
  task_msg: Message
  dispatched_at?: Timestamp
  completed_at?: Timestamp
} & ChildInstance &
  Entity

interface FindChildren {
  ok: boolean
  children: ChildInstance[]
}

type TraverseOptionsFull = {
  debug: boolean
  rootEntity: EntityID
  relations: {
    parental: Parental
  }
  customRef: Record<EntityID, string>
}

export type TraverseOptions = Partial<TraverseOptionsFull>

function Traverse(this: any, options: TraverseOptionsFull) {
  const seneca: any = this
  options.relations.parental.push(['sys/traverse', 'sys/traversetask'])

  // const { Default } = seneca.valid

  seneca
    .fix('sys:traverse')
    .message(
      'find:deps',
      {
        rootEntity: Optional(String),
      },
      msgFindDeps,
    )
    .message(
      'find:children',
      {
        rootEntity: Optional(String),
        rootEntityId: String,
      },
      msgFindChildren,
    )
    .message(
      'on:run,do:create',
      {
        rootEntity: Optional(String),
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
      'on:run,do:start',
      {
        runId: String,
      },
      msgRunStart,
    )

  // Returns a sorted list of entity pairs
  // starting from a given entity.
  // In breadth-first order, sorting first by level,
  // then alphabetically in each level.
  async function msgFindDeps(
    this: any,
    msg: {
      rootEntity?: EntityID
    },
  ): Promise<{ ok: boolean; deps: ParentChildRelation[] }> {
    // const seneca = this
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
    this: any,
    msg: {
      rootEntity?: EntityID
      rootEntityId: UUID
    },
  ): Promise<FindChildren> {
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

  // Create a run process and generate tasks
  // for each child entity to be executed.
  async function msgCreateTaskRun(
    this: any,
    msg: {
      rootEntity?: EntityID
      rootEntityId: string
      taskMsg: string
    },
  ): Promise<{
    ok: boolean
    run: RunEntity
    tasksCreated: number
    tasksFailed: number
  }> {
    const taskMsg = msg.taskMsg
    const rootEntity = msg.rootEntity || options.rootEntity
    const rootEntityId = msg.rootEntityId

    let runEnt: RunEntity = await seneca.entity('sys/traverse').save$({
      root_entity: rootEntity,
      root_id: rootEntityId,
      status: 'created',
      task_msg: taskMsg,
      total_tasks: 0,
      completed_tasks: 0,
      failed_tasks: 0,
    })

    const findChildrenRes: FindChildren = await seneca.post(
      'sys:traverse,find:children',
      {
        rootEntity,
        rootEntityId,
      },
    )

    const tasksCreationPromises: Promise<TaskEntity>[] = [
      seneca.entity('sys/traversetask').save$({
        run_id: runEnt.id,
        parent_id: rootEntityId,
        child_id: rootEntityId,
        parent_canon: rootEntity,
        child_canon: rootEntity,
        status: 'pending',
        retry: 0,
        task_msg: runEnt.task_msg,
      }),
    ]

    findChildrenRes.children.forEach((child) => {
      tasksCreationPromises.push(
        seneca.entity('sys/traversetask').save$({
          run_id: runEnt.id,
          parent_id: child.parent_id,
          child_id: child.child_id,
          parent_canon: child.parent_canon,
          child_canon: child.child_canon,
          status: 'pending',
          retry: 0,
          task_msg: runEnt.task_msg,
        }),
      )
    })

    const tasksCreationRes: PromiseSettledResult<TaskEntity>[] =
      await Promise.allSettled(tasksCreationPromises)

    let taskSuccessCount = 0
    let taskFailedCount = 0

    tasksCreationRes.forEach((taskCreation, idx) => {
      if (taskCreation.status === 'fulfilled') {
        taskSuccessCount++
      } else {
        taskFailedCount++
        const childrenData = findChildrenRes.children[idx]

        // TODO: add proper logging and retry
        console.error(
          'task create failed for child_canon: ' +
            childrenData.child_canon +
            ' - child_id: ' +
            childrenData.child_id +
            ' - error: ' +
            taskCreation.reason,
        )
      }
    })

    runEnt.total_tasks = taskSuccessCount
    runEnt = await runEnt.save$()

    return {
      ok: true,
      run: runEnt,
      tasksCreated: taskSuccessCount,
      tasksFailed: taskFailedCount,
    }
  }

  // Execute a single task updating its
  // status afterwards.
  async function msgTaskExecute(
    this: any,
    msg: {
      task: TaskEntity
    },
  ): Promise<{
    ok: boolean
    why?: string
    task?: TaskEntity
  }> {
    const task = msg.task

    if (!task?.id) {
      return { ok: false, why: 'task-not-found' }
    }

    const taskRun: RunEntity = await seneca
      .entity('sys/traverse')
      .load$(task.run_id)

    if (taskRun.completed_at) {
      return { ok: true }
    }

    task.status = 'dispatched'
    task.dispatched_at = Date.now()
    await task.save$()

    seneca.message(task.task_msg, async function (this: any, msg: any) {
      const seneca = this

      const clientActMsg = await seneca.prior(msg)
      const previousTask: TaskEntity = msg.task_entity

      const taskRunParent: RunEntity = await seneca
        .entity('sys/traverse')
        .load$(previousTask.run_id)

      if (taskRunParent.status !== 'running') {
        return clientActMsg
      }

      const nextTask: TaskEntity = await seneca
        .entity('sys/traversetask')
        .load$({
          run_id: previousTask.run_id,
          status: 'pending',
        })

      if (!nextTask?.id) {
        taskRunParent.status = 'completed'
        await taskRunParent.save$()

        return { ok: true }
      }

      await seneca.post('sys:traverse,on:task,do:execute', {
        task: nextTask,
      })

      return clientActMsg
    })

    // enqueue or process the current task
    await seneca.post(task.task_msg, {
      task_entity: task,
    })

    return { ok: true, task: task }
  }

  // Start a run process execution for all
  // its pending children tasks.
  async function msgRunStart(
    this: any,
    msg: {
      runId: string
    },
  ): Promise<{
    ok: boolean
    why?: string
    run?: RunEntity
  }> {
    const runId = msg.runId

    const runEnt: RunEntity = await seneca.entity('sys/traverse').load$({
      id: runId,
    })

    if (!runEnt?.id) {
      return { ok: false, why: 'run-entity-not-found' }
    }

    const nextTask: TaskEntity = await seneca.entity('sys/traversetask').load$({
      run_id: runEnt.id,
      status: 'pending',
    })

    if (!nextTask?.id) {
      runEnt.status = 'completed'
      runEnt.completed_at = Date.now()
      await runEnt.save$()

      return { ok: true }
    }

    runEnt.status = 'running'
    runEnt.started_at = Date.now()
    await runEnt.save$()

    seneca.post('sys:traverse,on:task,do:execute', {
      task: nextTask,
    })

    return { ok: true, run: runEnt }
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
  rootEntity: 'sys/user',
  relations: {
    parental: [],
  },
  customRef: {},
}

Object.assign(Traverse, { defaults })

export default Traverse

if ('undefined' !== typeof module) {
  module.exports = Traverse
}
