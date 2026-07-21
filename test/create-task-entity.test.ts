/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca } from './utils'

// createTaskEntity is transport-agnostic: reuse a method-preserving entity
// as-is, rehydrate a lossy plain object (e.g. AWS SQS). Pin both branches.
describe('Traverse: createTaskEntity transport handling', () => {
  async function setup() {
    const seneca = makeSeneca()
      .use(Traverse)
      .message('aim:task,cte:test', async function () {
        return { ok: true }
      })

    await seneca.ready()

    const run = await seneca.entity('sys/traverse').save$({
      status: 'active',
      total_tasks: 1,
      completed_tasks: 0,
      task_msg: 'aim:task,cte:test',
    })

    const task = await seneca.entity('sys/traversetask').save$({
      run_id: run.id,
      status: 'pending',
      task_msg: 'aim:task,cte:test',
      parent_id: 'p',
      child_id: 'c',
      parent_canon: 'foo/p',
      child_canon: 'foo/c',
      seq: 0,
    })

    return { seneca, run, task }
  }

  // Methods preserved: the live task is used directly, proven by its own save$
  // running (a rebuild would not touch it).
  test('method-preserving transport reuses the live task entity', async () => {
    const { seneca, task } = await setup()

    // Spy the entity's own save$ — only runs if returned as-is, not rebuilt.
    let ownSaveCalled = false
    const originalSave = task.save$.bind(task)
    ;(task as any).save$ = async function (...args: any[]) {
      ownSaveCalled = true
      return originalSave(...args)
    }

    await seneca.post('sys:traverse,on:task,do:execute', { task })

    expect(ownSaveCalled).equal(true)

    const reloaded = await seneca.entity('sys/traversetask').load$(task.id)
    expect(reloaded.status).equal('dispatched')
  })

  // Methods lost (plain JSON): must rehydrate so the status write persists.
  test('lossy transport (plain object) is rehydrated and persists', async () => {
    const { seneca, task } = await setup()

    const plain = { ...task.data$() }
    expect((plain as any).save$).equal(undefined)

    await seneca.post('sys:traverse,on:task,do:execute', { task: plain })

    const reloaded = await seneca.entity('sys/traversetask').load$(task.id)
    expect(reloaded.status).equal('dispatched')
  })
})
