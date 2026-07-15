/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca, sleep } from './utils'

// Barrier semantics: on:task,do:complete marks a task done (storing optional
// result/fragment) and routes run completion through the overridable
// on:run,do:claim pin, which emits on:run,did:complete exactly once.
describe('Traverse: complete task barrier', () => {
  test('complete-task-marks-done', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: { parental: [['foo/a0', 'foo/a1']] },
      })
      .message('aim:task,do:noop', async function () {
        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = 'r1'
    await seneca.entity('foo/a1').save$({ a0_id: rootEntityId })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/a0',
      rootEntityId,
      taskMsg: 'aim:task,do:noop',
    })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: createRes.run.id })

    const task = tasks[0]
    expect(task.status).equal('pending')

    const res = await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: task.id,
    })

    expect(res.ok).equal(true)

    const updated = await seneca.entity('sys/traversetask').load$(task.id)
    expect(updated.status).equal('done')
    expect(updated.done_at).to.exist()
  })

  test('complete-task-stores-result-and-fragment', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: { parental: [['foo/b0', 'foo/b1']] },
      })
      .message('aim:task,do:noop', async function () {
        return { ok: true }
      })

    await seneca.ready()

    await seneca.entity('foo/b1').save$({ b0_id: 'r2' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/b0',
      rootEntityId: 'r2',
      taskMsg: 'aim:task,do:noop',
    })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: createRes.run.id })

    const task = tasks[0]

    await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: task.id,
      result: { score: 42 },
      fragment: 'email@example.com',
    })

    const updated = await seneca.entity('sys/traversetask').load$(task.id)
    expect(updated.status).equal('done')
    expect(updated.result).equal({ score: 42 })
    expect(updated.fragment).equal('email@example.com')
  })

  test('complete-task-last-task-completes-run', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        rootExecute: false,
        relations: { parental: [['foo/c0', 'foo/c1']] },
      })
      .message('aim:task,do:noop', async function () {
        return { ok: true }
      })

    await seneca.ready()

    await seneca.entity('foo/c1').save$({ c0_id: 'r3' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/c0',
      rootEntityId: 'r3',
      taskMsg: 'aim:task,do:noop',
    })

    const run = createRes.run
    await seneca
      .entity('sys/traverse')
      .load$(run.id)
      .then((r: any) => {
        r.status = 'active'
        return r.save$()
      })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: run.id })

    expect(tasks.length).equal(1)

    await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: tasks[0].id,
    })

    const updatedRun = await seneca.entity('sys/traverse').load$(run.id)
    expect(updatedRun.status).equal('completed')
    expect(updatedRun.completed_at).to.exist()
  })

  test('complete-task-not-last-does-not-complete-run', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        rootExecute: false,
        relations: {
          parental: [
            ['foo/d0', 'foo/d1'],
            ['foo/d0', 'foo/d2'],
          ],
        },
      })
      .message('aim:task,do:noop', async function () {
        return { ok: true }
      })

    await seneca.ready()

    await seneca.entity('foo/d1').save$({ d0_id: 'r4' })
    await seneca.entity('foo/d2').save$({ d0_id: 'r4' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/d0',
      rootEntityId: 'r4',
      taskMsg: 'aim:task,do:noop',
    })

    const run = createRes.run
    await seneca
      .entity('sys/traverse')
      .load$(run.id)
      .then((r: any) => {
        r.status = 'active'
        return r.save$()
      })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: run.id })

    expect(tasks.length).equal(2)

    // Complete only the first task
    await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: tasks[0].id,
    })

    const updatedRun = await seneca.entity('sys/traverse').load$(run.id)
    expect(updatedRun.status).equal('active')
  })

  test('complete-task-did-complete-hook-fires', async () => {
    let didCompleteRun: any = null

    const seneca = makeSeneca()
      .use(Traverse, {
        rootExecute: false,
        relations: { parental: [['foo/e0', 'foo/e1']] },
      })
      .message('aim:task,do:noop', async function () {
        return { ok: true }
      })

    await seneca.ready()

    seneca.message(
      'sys:traverse,on:run,did:complete',
      async function (this: any, msg: any) {
        didCompleteRun = msg.run
        return { ok: true }
      },
    )

    await seneca.entity('foo/e1').save$({ e0_id: 'r5' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/e0',
      rootEntityId: 'r5',
      taskMsg: 'aim:task,do:noop',
    })

    const run = createRes.run
    await seneca
      .entity('sys/traverse')
      .load$(run.id)
      .then((r: any) => {
        r.status = 'active'
        return r.save$()
      })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: run.id })

    await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: tasks[0].id,
    })

    expect(didCompleteRun).to.exist()
    expect(didCompleteRun.id).equal(run.id)
    expect(didCompleteRun.status).equal('completed')
  })

  test('complete-task-did-complete-not-fired-when-not-last', async () => {
    let completionCount = 0

    const seneca = makeSeneca()
      .use(Traverse, {
        rootExecute: false,
        relations: {
          parental: [
            ['foo/f0', 'foo/f1'],
            ['foo/f0', 'foo/f2'],
          ],
        },
      })
      .message('aim:task,do:noop', async function () {
        return { ok: true }
      })

    await seneca.ready()

    seneca.message(
      'sys:traverse,on:run,did:complete',
      async function (this: any) {
        completionCount++
        return { ok: true }
      },
    )

    await seneca.entity('foo/f1').save$({ f0_id: 'r6' })
    await seneca.entity('foo/f2').save$({ f0_id: 'r6' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/f0',
      rootEntityId: 'r6',
      taskMsg: 'aim:task,do:noop',
    })

    const run = createRes.run
    await seneca
      .entity('sys/traverse')
      .load$(run.id)
      .then((r: any) => {
        r.status = 'active'
        return r.save$()
      })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: run.id })

    await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: tasks[0].id,
    })
    expect(completionCount).equal(0)

    await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: tasks[1].id,
    })
    expect(completionCount).equal(1)
  })

  test('complete-task-idempotent-no-double-completion', async () => {
    let completionCount = 0

    const seneca = makeSeneca()
      .use(Traverse, {
        rootExecute: false,
        relations: { parental: [['foo/g0', 'foo/g1']] },
      })
      .message('aim:task,do:noop', async function () {
        return { ok: true }
      })

    await seneca.ready()

    seneca.message(
      'sys:traverse,on:run,did:complete',
      async function (this: any) {
        completionCount++
        return { ok: true }
      },
    )

    await seneca.entity('foo/g1').save$({ g0_id: 'r7' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/g0',
      rootEntityId: 'r7',
      taskMsg: 'aim:task,do:noop',
    })

    const run = createRes.run
    await seneca
      .entity('sys/traverse')
      .load$(run.id)
      .then((r: any) => {
        r.status = 'active'
        return r.save$()
      })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: run.id })

    const task = tasks[0]

    // Call do:complete twice on the same task
    await seneca.post('sys:traverse,on:task,do:complete', { taskId: task.id })
    await seneca.post('sys:traverse,on:task,do:complete', { taskId: task.id })

    expect(completionCount).equal(1)
  })

  test('async-mode-completion-via-barrier', async () => {
    let didCompleteRun: any = null

    const seneca = makeSeneca()
      .use(Traverse, {
        mode: 'async',
        rootExecute: false,
        relations: {
          parental: [
            ['foo/h0', 'foo/h1'],
            ['foo/h0', 'foo/h2'],
          ],
        },
      })
      .message('aim:task,do:collect', async function (this: any, msg: any) {
        const taskEnt = msg.task
        // Worker calls do:complete directly (as remote workers would).
        await seneca.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
          fragment: taskEnt.child_id,
        })
        return { ok: true }
      })

    await seneca.ready()

    seneca.message(
      'sys:traverse,on:run,did:complete',
      async function (this: any, msg: any) {
        didCompleteRun = msg.run
        return { ok: true }
      },
    )

    // Override dispatch to NOT auto-complete (the worker does it via task_msg).
    seneca.message(
      'sys:traverse,do:dispatch,on:task',
      async function (this: any, msg: any) {
        const task = msg.task
        await seneca.post(task.task_msg, { task })
        return { ok: true }
      },
    )

    await seneca.entity('foo/h1').save$({ h0_id: 'r8' })
    await seneca.entity('foo/h2').save$({ h0_id: 'r8' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/h0',
      rootEntityId: 'r8',
      taskMsg: 'aim:task,do:collect',
    })

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: createRes.run.id,
    })

    await sleep(100)

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: createRes.run.id })

    for (const task of tasks) {
      expect(task.status).equal('done')
      expect(task.fragment).to.exist()
    }

    expect(didCompleteRun).to.exist()
    expect(didCompleteRun.status).equal('completed')
  })

  test('claim-pin-gates-did-complete', async () => {
    // Overriding on:run,do:claim to never claim must suppress did:complete even
    // when every task is done — proving the emission is gated by the claim pin
    // (the seam a distributed host swaps for an atomic conditional write).
    let completionCount = 0

    const seneca = makeSeneca()
      .use(Traverse, {
        rootExecute: false,
        relations: { parental: [['foo/i0', 'foo/i1']] },
      })
      .message('aim:task,do:noop', async function () {
        return { ok: true }
      })

    await seneca.ready()

    seneca.message(
      'sys:traverse,on:run,did:complete',
      async function (this: any) {
        completionCount++
        return { ok: true }
      },
    )

    seneca.message(
      'sys:traverse,on:run,do:claim',
      async function (this: any, msg: any) {
        return { ok: true, claimed: false, run: msg.run }
      },
    )

    await seneca.entity('foo/i1').save$({ i0_id: 'r9' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/i0',
      rootEntityId: 'r9',
      taskMsg: 'aim:task,do:noop',
    })

    const run = createRes.run
    await seneca
      .entity('sys/traverse')
      .load$(run.id)
      .then((r: any) => {
        r.status = 'active'
        return r.save$()
      })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: run.id })

    await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: tasks[0].id,
    })

    expect(completionCount).equal(0)
    const stillActive = await seneca.entity('sys/traverse').load$(run.id)
    expect(stillActive.status).equal('active')
  })

  test('async-mode-zero-tasks-completes', async () => {
    // A run with no tasks must still reach 'completed' (and fire did:complete)
    // in async mode; the dispatch loop never routes through the barrier.
    let didCompleteRun: any = null

    const seneca = makeSeneca()
      .use(Traverse, {
        mode: 'async',
        rootExecute: false,
        relations: { parental: [['foo/j0', 'foo/j1']] },
      })
      .message('aim:task,do:noop', async function () {
        return { ok: true }
      })

    await seneca.ready()

    seneca.message(
      'sys:traverse,on:run,did:complete',
      async function (this: any, msg: any) {
        didCompleteRun = msg.run
        return { ok: true }
      },
    )

    // No foo/j1 rows saved → zero children → zero tasks.
    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/j0',
      rootEntityId: 'r10',
      taskMsg: 'aim:task,do:noop',
    })

    expect(createRes.run.total_tasks).equal(0)

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: createRes.run.id,
    })

    await sleep(50)

    const run = await seneca.entity('sys/traverse').load$(createRes.run.id)
    expect(run.status).equal('completed')
    expect(didCompleteRun).to.exist()
    expect(didCompleteRun.id).equal(createRes.run.id)
  })
})
