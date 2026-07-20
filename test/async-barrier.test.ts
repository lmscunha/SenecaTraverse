/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca } from './utils'

describe('Traverse: async completion barrier correctness', () => {
  // The engine drives one task in flight at a time: each completion is a
  // read-modify-write on the run's counter, and because completions never
  // overlap no increment is lost. Signal every task done and confirm the run
  // reaches exactly total_tasks and flips to completed.
  test('every completion advances the counter to total_tasks', async () => {
    const childCount = 40

    const seneca = makeSeneca()
      .use(Traverse, {
        mode: 'async',
        rootExecute: false,
        relations: { parental: [['race/root', 'race/child']] },
      })
      .message('aim:task,race:test', async function () {
        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = 'root-1'
    for (let i = 0; i < childCount; i++) {
      await seneca.entity('race/child').save$({ root_id: rootEntityId })
    }

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'race/root',
      rootEntityId,
      taskMsg: 'aim:task,race:test',
    })
    const runId = createRes.run.id

    await seneca.post('sys:traverse,on:run,do:start', { runId })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: runId })
    expect(tasks.length).equal(childCount)

    // Signal completions one after another — the plugin's contract (one task in
    // flight, no concurrent do:complete).
    for (const task of tasks) {
      await seneca.post('sys:traverse,on:task,do:complete', { taskId: task.id })
    }

    const run = await seneca.entity('sys/traverse').load$(runId)
    expect(run.completed_tasks).equal(childCount)
    expect(run.status).equal('completed')
  })

  // At-least-once transports may deliver the same completion more than once.
  // Duplicate signals for one task must not overcount the run.
  test('duplicate completion signals do not overcount', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        mode: 'async',
        rootExecute: false,
        relations: { parental: [['dup/root', 'dup/child']] },
      })
      .message('aim:task,dup:test', async function () {
        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = 'root-1'
    await seneca.entity('dup/child').save$({ root_id: rootEntityId })
    await seneca.entity('dup/child').save$({ root_id: rootEntityId })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'dup/root',
      rootEntityId,
      taskMsg: 'aim:task,dup:test',
    })
    const runId = createRes.run.id

    await seneca.post('sys:traverse,on:run,do:start', { runId })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: runId })
    expect(tasks.length).equal(2)

    // Complete the first task three times.
    for (let i = 0; i < 3; i++) {
      const res = await seneca.post('sys:traverse,on:task,do:complete', {
        taskId: tasks[0].id,
      })
      expect(res.doneTasks).equal(1)
      expect(res.run.status).equal('active')
    }

    // The second (distinct) task tips the run to completed at count 2, not more.
    const last = await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: tasks[1].id,
    })
    expect(last.doneTasks).equal(2)
    expect(last.run.status).equal('completed')

    const run = await seneca.entity('sys/traverse').load$(runId)
    expect(run.completed_tasks).equal(2)
  })

  // Over a real transport an entity arrives as a plain object without its
  // `save$`/`load$` methods. do:execute must rebuild a live entity so the
  // status write still persists.
  test('do:execute rehydrates a transport-serialized (plain) task', async () => {
    const dispatched: string[] = []

    const seneca = makeSeneca()
      .use(Traverse)
      .message('aim:task,hydrate:test', async function (this: any, msg: any) {
        dispatched.push(msg.task.id)
        return { ok: true }
      })

    await seneca.ready()

    const run = await seneca.entity('sys/traverse').save$({
      status: 'active',
      total_tasks: 1,
      completed_tasks: 0,
      task_msg: 'aim:task,hydrate:test',
    })

    const task = await seneca.entity('sys/traversetask').save$({
      run_id: run.id,
      status: 'pending',
      task_msg: 'aim:task,hydrate:test',
      parent_id: 'p',
      child_id: 'c',
      parent_canon: 'foo/p',
      child_canon: 'foo/c',
    })

    // Simulate transport: a plain data snapshot with no entity methods.
    const plain = { ...task.data$() }
    expect((plain as any).save$).equal(undefined)

    await seneca.post('sys:traverse,on:task,do:execute', { task: plain })

    // Persistence worked despite the plain input: status advanced and the
    // downstream task message received the task.
    const reloaded = await seneca.entity('sys/traversetask').load$(task.id)
    expect(reloaded.status).equal('dispatched')
    expect(dispatched).includes(task.id)
  })
})
