/* Copyright © 2025 Seneca Project Contributors, MIT License. */

import { Optional } from 'gubu'

type EntityID = string

type ParentChildRelation = [EntityID, EntityID]

type Parental = ParentChildRelation[]

type TraverseOptionsFull = {
  debug: boolean
  rootEntity: EntityID
  relations: {
    parental: Parental
  }
}

export type TraverseOptions = Partial<TraverseOptionsFull>

function Traverse(this: any, options: TraverseOptionsFull) {
  const seneca: any = this

  // const { Default } = seneca.valid

  seneca.fix('sys:traverse').message(
    'find:deps',
    {
      rootEntity: Optional(String),
    },
    msgFindDeps,
  )

  // Returns a sorted list of entity pairs starting from a given entity.
  // In breadth-first order, sorting first by level, then alphabetically in each level.
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

  function compareRelations(
    relations: ParentChildRelation[],
  ): ParentChildRelation[] {
    return [...relations].sort(
      (a, b) =>
        a[0].localeCompare(b[0], undefined, { numeric: true }) ||
        a[1].localeCompare(b[1], undefined, { numeric: true }),
    )
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
}

Object.assign(Traverse, { defaults })

export default Traverse

if ('undefined' !== typeof module) {
  module.exports = Traverse
}
