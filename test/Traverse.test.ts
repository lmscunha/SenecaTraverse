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

    expect(res.deps).equal([
      ['foo/bar0', 'foo/bar1'],
      ['foo/bar1', 'foo/bar2'],
    ])
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

    expect(res.deps).equal([
      // Level 0
      ['foo/bar3', 'foo/bar6'],

      // Level 1
      ['foo/bar6', 'foo/bar10'],
    ])
  })
})

function makeSeneca(opts: any = {}) {
  const seneca = Seneca({ legacy: false }).test().use('promisify').use('entity')
  return seneca
}
