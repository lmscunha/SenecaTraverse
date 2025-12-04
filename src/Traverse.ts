/* Copyright © 2025 Seneca Project Contributors, MIT License. */

import { Optional, Skip } from 'gubu'

type Entity = string

type Relation = [Entity, Entity]

type Parental = Relation[]

type TraverseOptionsFull = {
  debug: boolean
  rootEntity: Entity
  relations: {
    parental: Parental
  }
}

export type TraverseOptions = Partial<TraverseOptionsFull>

function Traverse(this: any, options: TraverseOptionsFull) {
  const seneca: any = this

  const { Default } = seneca.valid

  seneca.fix('sys:traverse').message(
    'find:deps',
    {
      rootEntity: Optional(String),
      relations: Skip({ parental: [[String, String]] }),
    },
    msgFindDeps,
  )

  // Returns the sorted entity pairs, starting from a given entity.
  // In breadth-first order, sorting first by level, then alphabetically in each level.
  async function msgFindDeps(
    this: any,
    msg: {
      rootEntity: Entity
      relations: {
        parental: Parental
      }
    },
  ): Promise<{ ok: boolean; deps: Relation[] }> {
    // const seneca = this

    const allRealtions: Parental =
      msg.relations?.parental || options.relations.parental
    const rootEntity = msg.rootEntity || options.rootEntity

    const parentChildrenMap: Map<Entity, Entity[]> = new Map()
    const deps: Relation[] = []

    for (let [parent, child] of allRealtions) {
      if (!parentChildrenMap.has(parent)) {
        parentChildrenMap.set(parent, [])
      }

      const childrenList = parentChildrenMap.get(parent) || []
      childrenList.push(child)
      parentChildrenMap.set(parent, childrenList)
    }

    const visitedEntitiesSet: Set<Entity> = new Set()
    let levelEntToProcess: Entity[] = []

    visitedEntitiesSet.add(rootEntity)
    levelEntToProcess.push(rootEntity)

    while (levelEntToProcess.length > 0) {
      const nextLevel: Entity[] = []

      levelEntToProcess.sort()

      for (const parent of levelEntToProcess) {
        const entityChildren = parentChildrenMap.get(parent)?.sort() || []

        if (entityChildren.length === 0) {
          continue
        }

        for (const child of entityChildren) {
          if (!visitedEntitiesSet.has(child)) {
            deps.push([parent, child])
            visitedEntitiesSet.add(child)
            nextLevel.push(child)
          }
        }
      }

      levelEntToProcess = nextLevel
    }

    return {
      ok: true,
      deps,
    }
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
