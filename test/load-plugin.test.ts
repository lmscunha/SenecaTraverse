/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Seneca from 'seneca'

import Traverse from '..'
const TraverseDoc = Traverse

describe('Traverse: load plugin', () => {
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
})
