/* Copyright © 2025 Seneca Project Contributors, MIT License. */

import { Optional } from 'gubu'

type EntityID = string
type UUID = string

type ParentChildRelation = [EntityID, EntityID]

type Parental = ParentChildRelation[]

type ChildInstance = {
  parent_id: UUID
  child_id: UUID
  parent_canon: EntityID
  child_canon: EntityID
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
  ): Promise<{
    ok: boolean
    children: ChildInstance[]
  }> {
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
