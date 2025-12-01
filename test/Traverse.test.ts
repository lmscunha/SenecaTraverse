/* Copyright © 2025 Seneca Project Contributors, MIT License. */

import Seneca from 'seneca'
// import SenecaMsgTest from 'seneca-msg-test'
// import { Maintain } from '@seneca/maintain'

import TraverseDoc from '../src/TraverseDoc'
import Traverse from '../src/Traverse'

describe('Traverse', () => {
  test('load-plugin', async () => {
    expect(TraverseDoc).toBeDefined()
    const seneca = Seneca({ legacy: false })
      .test()
      .use('promisify')
      .use('entity')
      .use(Traverse)
    await seneca.ready()
  })
})
