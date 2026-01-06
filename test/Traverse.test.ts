/* Copyright © 2025 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Seneca from 'seneca'
// import SenecaMsgTest from 'seneca-msg-test'
// import { Maintain } from '@seneca/maintain'

import TraverseDoc from '..'
import Traverse from '..'

describe('Traverse', () => {
  test('load-plugin', async () => {
    expect(TraverseDoc).exist()

    const seneca = Seneca({ legacy: false })
      .test()
      .use('promisify')
      .use('entity')
      .use(Traverse)
    await seneca.ready()

    expect(seneca.find_plugin('Traverse')).exist()
  })

  test('find-deps', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar4'],
          ['foo/bar1', 'foo/bar5'],
          ['foo/bar3', 'foo/bar6'],
          ['foo/bar4', 'foo/bar7'],
          ['foo/bar5', 'foo/bar8'],
          ['foo/bar0', 'foo/zed0'],
          ['foo/zed0', 'foo/zed1'],
          ['foo/zed1', 'foo/zed2'],
          ['bar/baz0', 'bar/baz1'],
          ['qux/test', 'qux/prod'],
          ['foo/bar2', 'foo/bar9'],
          ['foo/bar6', 'foo/bar10'],
          ['foo/bar7', 'foo/bar11'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })
    // console.log('RES', res)

    expect(res.deps).equal([
      // Level 0
      ['foo/bar0', 'foo/bar1'],
      ['foo/bar0', 'foo/bar2'],
      ['foo/bar0', 'foo/zed0'],

      // Level 1
      ['foo/bar1', 'foo/bar4'],
      ['foo/bar1', 'foo/bar5'],
      ['foo/bar2', 'foo/bar3'],
      ['foo/bar2', 'foo/bar9'],
      ['foo/zed0', 'foo/zed1'],

      // Level 2
      // Sort each level alphabetically.
      // Thus, foo/bar3 should be listed first,
      // although its parent is foo/bar2
      ['foo/bar3', 'foo/bar6'],
      ['foo/bar4', 'foo/bar7'],
      ['foo/bar5', 'foo/bar8'],
      ['foo/zed1', 'foo/zed2'],

      // Level 3
      ['foo/bar6', 'foo/bar10'],
      ['foo/bar7', 'foo/bar11'],
    ])
  })

  test('find-deps-empty-list', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })
    // console.log('RES', res)

    expect(res.deps).equal([])
  })

  test('find-deps-no-children', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar1', 'foo/bar2'],
          ['foo/bar2', 'foo/bar3'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })
    // console.log('RES', res)

    expect(res.deps).equal([])
  })

  test('find-deps-cycle', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar1', 'foo/bar2'],
          // Cycle back to root
          ['foo/bar2', 'foo/bar0'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })
    // console.log('RES', res)

    // Should only traverse once, ignoring the cycle
    expect(res.deps).equal([
      ['foo/bar0', 'foo/bar1'],
      ['foo/bar1', 'foo/bar2'],
    ])
  })

  test('find-deps-cycle-middle', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar1', 'foo/bar2'],
          ['foo/bar2', 'foo/bar3'],
          // Cycle bar1 -> bar2 -> bar3 -> bar1
          ['foo/bar3', 'foo/bar1'],
          ['foo/bar2', 'foo/bar4'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })

    // Each node visited only once despite cycle
    expect(res.deps).equal([
      ['foo/bar0', 'foo/bar1'],
      ['foo/bar1', 'foo/bar2'],
      ['foo/bar2', 'foo/bar3'],
      ['foo/bar2', 'foo/bar4'],
    ])
  })

  test('find-deps-linear', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar1', 'foo/bar2'],
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar3', 'foo/bar4'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })
    // console.log('RES', res)

    expect(res.deps).equal([
      ['foo/bar0', 'foo/bar1'],
      ['foo/bar1', 'foo/bar2'],
      ['foo/bar2', 'foo/bar3'],
      ['foo/bar3', 'foo/bar4'],
    ])
  })

  test('find-deps-duplicate', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          // Duplicate
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar1', 'foo/bar2'],
          // Duplicate
          ['foo/bar1', 'foo/bar2'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })

    expect(res.deps).equal([
      ['foo/bar0', 'foo/bar1'],
      ['foo/bar1', 'foo/bar2'],
    ])
  })

  test('find-deps-convergent', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar3'],
          // bar3 reachable from two paths
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar3', 'foo/bar4'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })
    // console.log('RES', res)

    // bar3 should only appear once (first path wins)
    expect(res.deps).equal([
      ['foo/bar0', 'foo/bar1'],
      ['foo/bar0', 'foo/bar2'],
      ['foo/bar1', 'foo/bar3'],
      ['foo/bar3', 'foo/bar4'],
    ])
  })

  test('find-deps-two-convergent', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar0', 'foo/bar3'],
          ['foo/bar1', 'foo/bar4'],
          // bar4 from two parents
          ['foo/bar2', 'foo/bar4'],
          ['foo/bar3', 'foo/bar5'],
          ['foo/bar4', 'foo/bar6'],
          // bar6 from two parents at different levels
          ['foo/bar5', 'foo/bar6'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })

    expect(res.deps).equal([
      ['foo/bar0', 'foo/bar1'],
      ['foo/bar0', 'foo/bar2'],
      ['foo/bar0', 'foo/bar3'],
      ['foo/bar1', 'foo/bar4'],
      ['foo/bar3', 'foo/bar5'],
      ['foo/bar4', 'foo/bar6'],
    ])
  })

  test('find-deps-self-ref', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          // Self loop
          ['foo/bar1', 'foo/bar1'],
          ['foo/bar1', 'foo/bar2'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })
    // console.log('RES', res)

    expect(res.deps).equal([
      ['foo/bar0', 'foo/bar1'],
      ['foo/bar1', 'foo/bar2'],
    ])
  })

  test('find-deps-all-default', async () => {
    const seneca = makeSeneca().use(Traverse)
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps')
    // console.log('RES', res)

    expect(res.deps).equal([])
  })

  test('find-deps-empty-list', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })
    // console.log('RES', res)

    expect(res.deps).equal([])
  })

  test('find-deps-l1', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar4'],
          ['foo/bar1', 'foo/bar5'],
          ['foo/bar3', 'foo/bar6'],
          ['foo/bar4', 'foo/bar7'],
          ['foo/bar5', 'foo/bar8'],
          ['foo/bar0', 'foo/zed0'],
          ['foo/zed0', 'foo/zed1'],
          ['foo/zed1', 'foo/zed2'],
          ['bar/baz0', 'bar/baz1'],
          ['qux/test', 'qux/prod'],
          ['foo/bar2', 'foo/bar9'],
          ['foo/bar6', 'foo/bar10'],
          ['foo/bar7', 'foo/bar11'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar1',
    })

    expect(res.deps).equal([
      // Level 0
      ['foo/bar1', 'foo/bar4'],
      ['foo/bar1', 'foo/bar5'],

      // Level 1
      ['foo/bar4', 'foo/bar7'],
      ['foo/bar5', 'foo/bar8'],

      // Level 2
      ['foo/bar7', 'foo/bar11'],
    ])
  })

  test('find-deps-l1-convergent', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar4'],
          ['foo/bar1', 'foo/bar5'],
          ['foo/bar3', 'foo/bar6'],
          ['foo/bar4', 'foo/bar7'],
          ['foo/bar5', 'foo/bar8'],
          ['foo/bar0', 'foo/zed0'],
          ['foo/zed0', 'foo/zed1'],
          ['foo/zed1', 'foo/zed2'],
          ['bar/baz0', 'bar/baz1'],
          ['qux/test', 'qux/prod'],
          ['foo/bar2', 'foo/bar9'],
          ['foo/bar6', 'foo/bar10'],
          ['foo/bar7', 'foo/bar11'],
          ['foo/bar4', 'foo/bar12'],
          // bar12 converges from bar4 and bar5
          ['foo/bar5', 'foo/bar12'],
          ['foo/bar12', 'foo/bar13'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar1',
    })

    expect(res.deps).equal([
      // Level 0
      ['foo/bar1', 'foo/bar4'],
      ['foo/bar1', 'foo/bar5'],

      // Level 1
      ['foo/bar4', 'foo/bar7'],
      ['foo/bar4', 'foo/bar12'],
      ['foo/bar5', 'foo/bar8'],

      // Level 2
      ['foo/bar7', 'foo/bar11'],
      ['foo/bar12', 'foo/bar13'],
    ])
  })

  test('find-deps-l1-cycle', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar4'],
          ['foo/bar1', 'foo/bar5'],
          ['foo/bar3', 'foo/bar6'],
          ['foo/bar4', 'foo/bar7'],
          ['foo/bar5', 'foo/bar8'],
          ['foo/bar0', 'foo/zed0'],
          ['foo/zed0', 'foo/zed1'],
          ['foo/zed1', 'foo/zed2'],
          ['bar/baz0', 'bar/baz1'],
          ['qux/test', 'qux/prod'],
          ['foo/bar2', 'foo/bar9'],
          ['foo/bar6', 'foo/bar10'],
          ['foo/bar7', 'foo/bar11'],
          // Cycle: bar1 -> bar4 -> bar7 -> bar1
          ['foo/bar7', 'foo/bar1'],
          ['foo/bar8', 'foo/bar12'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar1',
    })

    expect(res.deps).equal([
      // Level 0
      ['foo/bar1', 'foo/bar4'],
      ['foo/bar1', 'foo/bar5'],

      // Level 1
      ['foo/bar4', 'foo/bar7'],
      ['foo/bar5', 'foo/bar8'],

      // Level 2
      ['foo/bar7', 'foo/bar11'],
      ['foo/bar8', 'foo/bar12'],
    ])
  })

  test('find-deps-l2', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar4'],
          ['foo/bar1', 'foo/bar5'],
          ['foo/bar3', 'foo/bar6'],
          ['foo/bar4', 'foo/bar7'],
          ['foo/bar5', 'foo/bar8'],
          ['foo/bar0', 'foo/zed0'],
          ['foo/zed0', 'foo/zed1'],
          ['foo/zed1', 'foo/zed2'],
          ['bar/baz0', 'bar/baz1'],
          ['qux/test', 'qux/prod'],
          ['foo/bar2', 'foo/bar9'],
          ['foo/bar6', 'foo/bar10'],
          ['foo/bar7', 'foo/bar11'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar3',
    })
    // console.log('RES', res)

    expect(res.deps).equal([
      // Level 0
      ['foo/bar3', 'foo/bar6'],

      // Level 1
      ['foo/bar6', 'foo/bar10'],
    ])
  })

  test('find-deps-l2-convergent', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar4'],
          ['foo/bar1', 'foo/bar5'],
          ['foo/bar3', 'foo/bar6'],
          ['foo/bar4', 'foo/bar7'],
          ['foo/bar5', 'foo/bar8'],
          ['foo/bar0', 'foo/zed0'],
          ['foo/zed0', 'foo/zed1'],
          ['foo/zed1', 'foo/zed2'],
          ['bar/baz0', 'bar/baz1'],
          ['qux/test', 'qux/prod'],
          ['foo/bar2', 'foo/bar9'],
          ['foo/bar6', 'foo/bar10'],
          ['foo/bar7', 'foo/bar11'],
          ['foo/bar3', 'foo/bar12'],
          ['foo/bar6', 'foo/bar13'],
          ['foo/bar10', 'foo/bar14'],
          // bar14 converges from bar10 and bar12
          ['foo/bar12', 'foo/bar14'],
          ['foo/bar14', 'foo/bar15'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar3',
    })

    expect(res.deps).equal([
      // Level 0
      ['foo/bar3', 'foo/bar6'],
      ['foo/bar3', 'foo/bar12'],

      // Level 1
      ['foo/bar6', 'foo/bar10'],
      ['foo/bar6', 'foo/bar13'],
      ['foo/bar12', 'foo/bar14'],

      // Level 2
      ['foo/bar14', 'foo/bar15'],
    ])
  })

  test('find-deps-l2-cycle', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar4'],
          ['foo/bar1', 'foo/bar5'],
          ['foo/bar3', 'foo/bar6'],
          ['foo/bar4', 'foo/bar7'],
          ['foo/bar5', 'foo/bar8'],
          ['foo/bar0', 'foo/zed0'],
          ['foo/zed0', 'foo/zed1'],
          ['foo/zed1', 'foo/zed2'],
          ['bar/baz0', 'bar/baz1'],
          ['qux/test', 'qux/prod'],
          ['foo/bar2', 'foo/bar9'],
          ['foo/bar6', 'foo/bar10'],
          ['foo/bar7', 'foo/bar11'],
          ['foo/bar10', 'foo/bar12'],
          // Cycle: bar3 -> bar6 -> bar10 -> bar12 -> bar3
          ['foo/bar12', 'foo/bar3'],
          ['foo/bar10', 'foo/bar13'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar3',
    })

    expect(res.deps).equal([
      // Level 0
      ['foo/bar3', 'foo/bar6'],

      // Level 1
      ['foo/bar6', 'foo/bar10'],

      // Level 2
      ['foo/bar10', 'foo/bar12'],
      ['foo/bar10', 'foo/bar13'],
    ])
  })

  test('find-deps-l2-multi-level-convergent', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar4'],
          ['foo/bar1', 'foo/bar5'],
          ['foo/bar3', 'foo/bar6'],
          ['foo/bar4', 'foo/bar7'],
          ['foo/bar5', 'foo/bar8'],
          ['foo/bar0', 'foo/zed0'],
          ['foo/zed0', 'foo/zed1'],
          ['foo/zed1', 'foo/zed2'],
          ['bar/baz0', 'bar/baz1'],
          ['qux/test', 'qux/prod'],
          ['foo/bar2', 'foo/bar9'],
          ['foo/bar6', 'foo/bar10'],
          ['foo/bar7', 'foo/bar11'],
          ['foo/bar3', 'foo/bar12'],
          ['foo/bar3', 'foo/bar13'],
          ['foo/bar12', 'foo/bar14'],
          // Second path to bar14
          ['foo/bar13', 'foo/bar14'],
          // Third path to bar14
          ['foo/bar6', 'foo/bar14'],
          ['foo/bar14', 'foo/bar15'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar3',
    })

    expect(res.deps).equal([
      // Level 0
      ['foo/bar3', 'foo/bar6'],
      ['foo/bar3', 'foo/bar12'],
      ['foo/bar3', 'foo/bar13'],

      // Level 1
      ['foo/bar6', 'foo/bar10'],
      ['foo/bar12', 'foo/bar14'],

      // Level 2
      ['foo/bar14', 'foo/bar15'],
    ])
  })

  test('find-deps-single-cycle', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['A', 'B'],
          ['A', 'C'],
          ['C', 'E'],
          ['C', 'D'],
          ['E', 'G'],
          ['E', 'F'],
          ['F', 'H'],
          ['C', 'A'],
          ['N', 'M'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'C',
    })

    expect(res.deps).equal([
      // Level 0
      ['C', 'A'],
      ['C', 'D'],
      ['C', 'E'],

      // Level 1
      ['A', 'B'],
      ['E', 'F'],
      ['E', 'G'],

      // Level 2
      ['F', 'H'],
    ])
  })

  test('find-deps-single-missing-node', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['A', 'B'],
          ['B', 'C'],
          ['D', 'E'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'X',
    })

    // X has no children
    expect(res.deps).equal([])
  })

  test('find-deps-deep-linear-chain', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['node0', 'node1'],
          ['node1', 'node2'],
          ['node2', 'node3'],
          ['node3', 'node4'],
          ['node4', 'node5'],
          ['node5', 'node6'],
          ['node6', 'node7'],
          ['node7', 'node8'],
          ['node8', 'node9'],
          ['node9', 'node10'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'node0',
    })

    expect(res.deps).equal([
      ['node0', 'node1'],
      ['node1', 'node2'],
      ['node2', 'node3'],
      ['node3', 'node4'],
      ['node4', 'node5'],
      ['node5', 'node6'],
      ['node6', 'node7'],
      ['node7', 'node8'],
      ['node8', 'node9'],
      ['node9', 'node10'],
    ])
  })

  test('find-deps-binary-tree', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['A', 'B'],
          ['A', 'C'],
          ['B', 'D'],
          ['B', 'E'],
          ['C', 'F'],
          ['C', 'G'],
          ['D', 'H'],
          ['D', 'I'],
          ['E', 'J'],
          ['E', 'K'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'A',
    })

    expect(res.deps).equal([
      // Level 0
      ['A', 'B'],
      ['A', 'C'],

      // Level 1
      ['B', 'D'],
      ['B', 'E'],
      ['C', 'F'],
      ['C', 'G'],

      // Level 2
      ['D', 'H'],
      ['D', 'I'],
      ['E', 'J'],
      ['E', 'K'],
    ])
  })

  test('find-deps-diamond-pattern', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['A', 'B'],
          ['A', 'C'],
          ['B', 'D'],
          ['C', 'D'],
          ['D', 'E'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'A',
    })

    // D is reached first from B (alphabetically first)
    expect(res.deps).equal([
      // Level 0
      ['A', 'B'],
      ['A', 'C'],

      // Level 1 - D reached via B
      ['B', 'D'],

      // Level 2
      ['D', 'E'],
    ])
  })

  test('find-deps-mixed-alph-sort', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['root', 'node10'],
          ['root', 'node2'],
          ['root', 'node1'],
          ['root', 'node20'],
          ['node1', 'child2'],
          ['node2', 'child1'],
          ['node10', 'child10'],
          ['node20', 'child20'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'root',
    })

    // Natural sorting: node1, node2, node10, node20
    expect(res.deps).equal([
      // Level 0
      ['root', 'node1'],
      ['root', 'node2'],
      ['root', 'node10'],
      ['root', 'node20'],

      // Level 1
      ['node1', 'child2'],
      ['node2', 'child1'],
      ['node10', 'child10'],
      ['node20', 'child20'],
    ])
  })

  test('find-deps-all-nodes-converge-to-one', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['root', 'A'],
          ['root', 'B'],
          ['root', 'C'],
          ['A', 'target'],
          ['B', 'target'],
          ['C', 'target'],
          ['target', 'end'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'root',
    })

    // target reached first via A (alphabetically first)
    expect(res.deps).equal([
      // Level 0
      ['root', 'A'],
      ['root', 'B'],
      ['root', 'C'],

      // Level 1 - target via A
      ['A', 'target'],

      // Level 2
      ['target', 'end'],
    ])
  })

  test('find-deps-deep-10-levels-complex', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          // ========== LEVEL 0 → LEVEL 1 ==========
          ['foo', 'bar'],
          ['foo', 'zed'],
          ['foo', 'qux'],

          // ========== LEVEL 1 → LEVEL 2 ==========
          ['bar', 'bar1'],
          ['bar', 'bar2'],
          ['zed', 'zed1'],
          ['zed', 'zed2'],
          ['qux', 'qux1'],

          // ========== LEVEL 2 → LEVEL 3 ==========
          ['bar1', 'bar3'],
          ['bar1', 'bar4'],
          ['bar2', 'bar5'],
          ['zed1', 'zed3'],
          ['zed1', 'zed4'],
          ['zed2', 'zed5'],
          ['qux1', 'qux2'],

          // ========== LEVEL 3 → LEVEL 4 ==========
          ['bar3', 'bar6'],
          ['bar3', 'bar7'],
          ['bar4', 'bar8'],
          ['bar5', 'bar9'],
          ['zed3', 'zed6'],
          ['zed4', 'zed7'],
          ['zed5', 'zed8'],
          ['qux2', 'qux3'],

          // ========== LEVEL 4 → LEVEL 5 ==========
          ['bar6', 'bar10'],
          ['bar7', 'bar11'],
          ['bar8', 'bar12'],
          ['bar9', 'bar13'],
          ['zed6', 'zed9'],
          ['zed7', 'zed10'],
          ['zed8', 'zed11'],
          ['qux3', 'qux4'],

          // ========== LEVEL 5 → LEVEL 6 (switch to composed names) ==========
          ['bar10', 'foo/bar1'],
          ['bar10', 'foo/bar2'],
          ['bar11', 'foo/bar3'],
          ['bar12', 'foo/bar4'],
          ['bar13', 'foo/bar5'],
          ['zed9', 'foo/zed1'],
          ['zed10', 'foo/zed2'],
          ['zed11', 'foo/zed3'],
          // Cycle: qux4 → foo (already visited at level 0)
          ['qux4', 'foo'],
          ['qux4', 'foo/qux1'],

          // ========== LEVEL 6 → LEVEL 7 ==========
          ['foo/bar1', 'foo/bar6'],
          ['foo/bar1', 'foo/bar7'],
          ['foo/bar2', 'foo/bar8'],
          ['foo/bar3', 'foo/bar9'],
          ['foo/bar4', 'foo/bar10'],
          ['foo/bar5', 'foo/bar11'],
          ['foo/zed1', 'foo/zed4'],
          ['foo/zed2', 'foo/zed5'],
          ['foo/zed3', 'foo/zed6'],
          ['foo/qux1', 'foo/qux2'],

          // ========== LEVEL 7 → LEVEL 8 ==========
          ['foo/bar6', 'bar/foo1'],
          ['foo/bar7', 'bar/foo2'],
          ['foo/bar8', 'bar/foo3'],
          ['foo/bar9', 'bar/foo4'],
          ['foo/bar10', 'bar/foo5'],
          ['foo/bar11', 'bar/foo6'],
          ['foo/zed4', 'zed/foo1'],
          ['foo/zed5', 'zed/foo2'],
          // Convergent: foo/zed6 and foo/qux2 both point to zed/foo3
          ['foo/zed6', 'zed/foo3'],
          ['foo/qux2', 'zed/foo3'],

          // ========== LEVEL 8 → LEVEL 9 ==========
          ['bar/foo1', 'bar/foo7'],
          ['bar/foo2', 'bar/foo8'],
          ['bar/foo3', 'bar/foo9'],
          ['bar/foo4', 'bar/foo10'],
          ['bar/foo5', 'bar/foo11'],
          ['bar/foo6', 'bar/foo12'],
          ['zed/foo1', 'zed/foo4'],
          ['zed/foo2', 'zed/foo5'],
          ['zed/foo3', 'zed/foo6'],

          // ========== LEVEL 9 → LEVEL 10 ==========
          ['bar/foo7', 'qux/bar1'],
          ['bar/foo8', 'qux/bar2'],
          ['bar/foo9', 'qux/bar3'],
          ['bar/foo10', 'qux/bar4'],
          ['bar/foo11', 'qux/bar5'],
          ['bar/foo12', 'qux/bar6'],
          ['zed/foo4', 'qux/zed1'],
          ['zed/foo5', 'qux/zed2'],
          ['zed/foo6', 'qux/zed3'],

          // ========== LEVEL 10 → LEVEL 11 ==========
          ['qux/bar1', 'qux/bar7'],
          ['qux/bar2', 'qux/bar8'],
          ['qux/bar3', 'qux/bar9'],
          ['qux/bar4', 'qux/bar10'],
          ['qux/bar5', 'qux/bar11'],
          ['qux/bar6', 'qux/bar12'],
          ['qux/zed1', 'qux/zed4'],
          ['qux/zed2', 'qux/zed5'],
          ['qux/zed3', 'qux/zed6'],
        ],
      },
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo',
    })

    expect(res.deps).equal([
      // ========== LEVEL 0 ==========
      ['foo', 'bar'],
      ['foo', 'qux'],
      ['foo', 'zed'],

      // ========== LEVEL 1 ==========
      ['bar', 'bar1'],
      ['bar', 'bar2'],
      ['qux', 'qux1'],
      ['zed', 'zed1'],
      ['zed', 'zed2'],

      // ========== LEVEL 2 ==========
      ['bar1', 'bar3'],
      ['bar1', 'bar4'],
      ['bar2', 'bar5'],
      ['qux1', 'qux2'],
      ['zed1', 'zed3'],
      ['zed1', 'zed4'],
      ['zed2', 'zed5'],

      // ========== LEVEL 3 ==========
      ['bar3', 'bar6'],
      ['bar3', 'bar7'],
      ['bar4', 'bar8'],
      ['bar5', 'bar9'],
      ['qux2', 'qux3'],
      ['zed3', 'zed6'],
      ['zed4', 'zed7'],
      ['zed5', 'zed8'],

      // ========== LEVEL 4 ==========
      ['bar6', 'bar10'],
      ['bar7', 'bar11'],
      ['bar8', 'bar12'],
      ['bar9', 'bar13'],
      ['qux3', 'qux4'],
      ['zed6', 'zed9'],
      ['zed7', 'zed10'],
      ['zed8', 'zed11'],

      // ========== LEVEL 5 ==========
      ['bar10', 'foo/bar1'],
      ['bar10', 'foo/bar2'],
      ['bar11', 'foo/bar3'],
      ['bar12', 'foo/bar4'],
      ['bar13', 'foo/bar5'],
      // Note: qux4 → foo creates cycle (foo visited at level 0)
      ['qux4', 'foo/qux1'],
      ['zed9', 'foo/zed1'],
      ['zed10', 'foo/zed2'],
      ['zed11', 'foo/zed3'],

      // ========== LEVEL 6 ==========
      ['foo/bar1', 'foo/bar6'],
      ['foo/bar1', 'foo/bar7'],
      ['foo/bar2', 'foo/bar8'],
      ['foo/bar3', 'foo/bar9'],
      ['foo/bar4', 'foo/bar10'],
      ['foo/bar5', 'foo/bar11'],
      ['foo/qux1', 'foo/qux2'],
      ['foo/zed1', 'foo/zed4'],
      ['foo/zed2', 'foo/zed5'],
      ['foo/zed3', 'foo/zed6'],

      // ========== LEVEL 7 ==========
      ['foo/bar6', 'bar/foo1'],
      ['foo/bar7', 'bar/foo2'],
      ['foo/bar8', 'bar/foo3'],
      ['foo/bar9', 'bar/foo4'],
      ['foo/bar10', 'bar/foo5'],
      ['foo/bar11', 'bar/foo6'],
      ['foo/qux2', 'zed/foo3'],
      ['foo/zed4', 'zed/foo1'],
      ['foo/zed5', 'zed/foo2'],
      // Note: foo/zed6 → zed/foo3 is skipped because zed/foo3 was already visited via foo/qux2

      // ========== LEVEL 8 ==========
      ['bar/foo1', 'bar/foo7'],
      ['bar/foo2', 'bar/foo8'],
      ['bar/foo3', 'bar/foo9'],
      ['bar/foo4', 'bar/foo10'],
      ['bar/foo5', 'bar/foo11'],
      ['bar/foo6', 'bar/foo12'],
      ['zed/foo1', 'zed/foo4'],
      ['zed/foo2', 'zed/foo5'],
      ['zed/foo3', 'zed/foo6'],

      // ========== LEVEL 9 ==========
      ['bar/foo7', 'qux/bar1'],
      ['bar/foo8', 'qux/bar2'],
      ['bar/foo9', 'qux/bar3'],
      ['bar/foo10', 'qux/bar4'],
      ['bar/foo11', 'qux/bar5'],
      ['bar/foo12', 'qux/bar6'],
      ['zed/foo4', 'qux/zed1'],
      ['zed/foo5', 'qux/zed2'],
      ['zed/foo6', 'qux/zed3'],

      // ========== LEVEL 10 ==========
      ['qux/bar1', 'qux/bar7'],
      ['qux/bar2', 'qux/bar8'],
      ['qux/bar3', 'qux/bar9'],
      ['qux/bar4', 'qux/bar10'],
      ['qux/bar5', 'qux/bar11'],
      ['qux/bar6', 'qux/bar12'],
      ['qux/zed1', 'qux/zed4'],
      ['qux/zed2', 'qux/zed5'],
      ['qux/zed3', 'qux/zed6'],
    ])
  })
})

function makeSeneca(opts: any = {}) {
  const seneca = Seneca({ legacy: false }).test().use('promisify').use('entity')
  return seneca
}
