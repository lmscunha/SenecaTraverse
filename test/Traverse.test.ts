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

  test('find-deps-default-root', async () => {
    const seneca = makeSeneca().use(Traverse)
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar3'],
          ['sys/user', 'foo/bar1'],
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
    // console.log('RES', res)

    expect(res.deps).equal([
      // Level 0
      ['sys/user', 'foo/bar1'],

      // Level 1
      ['foo/bar1', 'foo/bar4'],
      ['foo/bar1', 'foo/bar5'],

      // Level 2
      ['foo/bar4', 'foo/bar7'],
      ['foo/bar5', 'foo/bar8'],

      // Level 3
      ['foo/bar7', 'foo/bar11'],
    ])
  })

  test('find-deps-all-custom', async () => {
    const seneca = makeSeneca().use(Traverse)
    await seneca.ready()

    const res = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
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
      ['foo/bar3', 'foo/bar6'],
      ['foo/bar4', 'foo/bar7'],
      ['foo/bar5', 'foo/bar8'],
      ['foo/zed1', 'foo/zed2'],

      // Level 3
      ['foo/bar6', 'foo/bar10'],
      ['foo/bar7', 'foo/bar11'],
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

  test('find-children', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar0', 'foo/zed0'],
          ['foo/bar1', 'foo/bar4'],
          ['foo/bar1', 'foo/bar5'],
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar2', 'foo/bar9'],
          ['foo/zed0', 'foo/zed1'],
          ['foo/bar3', 'foo/bar6'],
          ['foo/bar4', 'foo/bar7'],
          ['foo/bar5', 'foo/bar8'],
          ['foo/zed1', 'foo/zed2'],
          ['foo/bar6', 'foo/bar10'],
          ['foo/bar7', 'foo/bar11'],
        ],
      },
    })
    await seneca.ready()

    const resFindDeps = await seneca.post('sys:traverse,find:deps', {
      rootEntity: 'foo/bar0',
    })

    const rootEntityId = '123'

    // Level 1: Direct children of bar0
    const bar1Ent = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar2Ent = await seneca.entity('foo/bar2').save$({
      bar0_id: rootEntityId,
    })

    const zed0Ent = await seneca.entity('foo/zed0').save$({
      bar0_id: rootEntityId,
    })

    // Level 2: Children of bar1
    const bar4Ent = await seneca.entity('foo/bar4').save$({
      bar1_id: bar1Ent.id,
    })

    const bar5Ent = await seneca.entity('foo/bar5').save$({
      bar1_id: bar1Ent.id,
    })

    // Level 2: Children of bar2
    const bar3Ent = await seneca.entity('foo/bar3').save$({
      bar2_id: bar2Ent.id,
    })

    const bar9Ent = await seneca.entity('foo/bar9').save$({
      bar2_id: bar2Ent.id,
    })

    // Level 2: Children of zed0
    const zed1Ent = await seneca.entity('foo/zed1').save$({
      zed0_id: zed0Ent.id,
    })

    // Level 3: Children of bar3
    const bar6Ent = await seneca.entity('foo/bar6').save$({
      bar3_id: bar3Ent.id,
    })

    // Level 3: Children of bar4
    const bar7Ent = await seneca.entity('foo/bar7').save$({
      bar4_id: bar4Ent.id,
    })

    // Level 3: Children of bar5
    const bar8Ent = await seneca.entity('foo/bar8').save$({
      bar5_id: bar5Ent.id,
    })

    // Level 3: Children of zed1
    const zed2Ent = await seneca.entity('foo/zed2').save$({
      zed1_id: zed1Ent.id,
    })

    // Level 4: Children of bar6
    const bar10Ent = await seneca.entity('foo/bar10').save$({
      bar6_id: bar6Ent.id,
    })

    // Level 4: Children of bar7
    const bar11Ent = await seneca.entity('foo/bar11').save$({
      bar7_id: bar7Ent.id,
    })

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
      relations: resFindDeps.deps,
    })

    expect(res.children).equal([
      // Level 1
      {
        parent_id: rootEntityId,
        child_id: bar1Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: rootEntityId,
        child_id: bar2Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar2',
      },
      {
        parent_id: rootEntityId,
        child_id: zed0Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/zed0',
      },
      // Level 2
      {
        parent_id: bar1Ent.id,
        child_id: bar4Ent.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar4',
      },
      {
        parent_id: bar1Ent.id,
        child_id: bar5Ent.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar5',
      },
      {
        parent_id: bar2Ent.id,
        child_id: bar3Ent.id,
        parent_canon: 'foo/bar2',
        child_canon: 'foo/bar3',
      },
      {
        parent_id: bar2Ent.id,
        child_id: bar9Ent.id,
        parent_canon: 'foo/bar2',
        child_canon: 'foo/bar9',
      },
      {
        parent_id: zed0Ent.id,
        child_id: zed1Ent.id,
        parent_canon: 'foo/zed0',
        child_canon: 'foo/zed1',
      },
      // Level 3
      {
        parent_id: bar3Ent.id,
        child_id: bar6Ent.id,
        parent_canon: 'foo/bar3',
        child_canon: 'foo/bar6',
      },
      {
        parent_id: bar4Ent.id,
        child_id: bar7Ent.id,
        parent_canon: 'foo/bar4',
        child_canon: 'foo/bar7',
      },
      {
        parent_id: bar5Ent.id,
        child_id: bar8Ent.id,
        parent_canon: 'foo/bar5',
        child_canon: 'foo/bar8',
      },
      {
        parent_id: zed1Ent.id,
        child_id: zed2Ent.id,
        parent_canon: 'foo/zed1',
        child_canon: 'foo/zed2',
      },
      // Level 4
      {
        parent_id: bar6Ent.id,
        child_id: bar10Ent.id,
        parent_canon: 'foo/bar6',
        child_canon: 'foo/bar10',
      },
      {
        parent_id: bar7Ent.id,
        child_id: bar11Ent.id,
        parent_canon: 'foo/bar7',
        child_canon: 'foo/bar11',
      },
    ])
  })

  test('find-children-empty-relations', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [],
      },
    })
    await seneca.ready()

    const rootEntityId = '123'

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
      relations: [],
    })

    expect(res.children).equal([])
  })
})

function makeSeneca(opts: any = {}) {
  const seneca = Seneca({ legacy: false }).test().use('promisify').use('entity')
  return seneca
}
