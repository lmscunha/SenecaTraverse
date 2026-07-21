/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca } from './utils'

// `task_msg` is an arbitrary Seneca pattern; the allowlist closes the
// message-injection vector for untrusted `do:create` callers.
describe('Traverse: task_msg allowlist', () => {
  test('rejects a task_msg outside the allowlist', async () => {
    const seneca = makeSeneca().use(Traverse, {
      taskMsgAllow: ['aim:task,allowed:test'],
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/x',
      rootEntityId: '1',
      taskMsg: 'sys:secret,do:exfiltrate',
    })

    expect(res.ok).equal(false)
    expect(res.why).equal('task-msg-not-allowed')

    // No run should have been created for a rejected pattern.
    const runs = await seneca.entity('sys/traverse').list$()
    expect(runs.length).equal(0)
  })

  test('accepts a task_msg present in the allowlist', async () => {
    const seneca = makeSeneca().use(Traverse, {
      rootExecute: false,
      taskMsgAllow: ['aim:task,allowed:test'],
    })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/x',
      rootEntityId: '1',
      taskMsg: 'aim:task,allowed:test',
    })

    expect(res.ok).equal(true)
    expect(res.run.task_msg).equal('aim:task,allowed:test')
  })

  test('empty allowlist (default) allows any task_msg', async () => {
    const seneca = makeSeneca().use(Traverse, { rootExecute: false })
    await seneca.ready()

    const res = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/x',
      rootEntityId: '1',
      taskMsg: 'anything:goes',
    })

    expect(res.ok).equal(true)
  })
})
