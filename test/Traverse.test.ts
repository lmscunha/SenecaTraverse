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
    const seneca = Seneca({ legacy: false })
      .test()
      .use('promisify')
      .use('entity')
      .use(Traverse, {
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

    await seneca.ready()

    const result = await seneca.post('sys:traverse,find:deps')
    // console.log('find deps result ', sortedDepsList)

    expect(result.deps).equal([
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
})
