/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca, sleep } from './utils'

describe('Traverse: scope option + atomic rollback', () => {
  test('scope-principal-default', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: { parental: [['foo/s0', 'foo/s1']] },
      })
      .message('aim:task,scope:test', async function (this: any, msg: any) {
        const taskEnt = msg.task
        taskEnt.status = 'done'
        taskEnt.done_at = Date.now()
        await taskEnt.save$()
        return { ok: true }
      })

    await seneca.ready()

    await seneca.entity('foo/s1').save$({ s0_id: 'root1' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/s0',
      rootEntityId: 'root1',
      taskMsg: 'aim:task,scope:test',
    })

    expect(createRes.ok).equal(true)
    expect(createRes.tasksCreated).equal(2) // root + child
    expect(createRes.tasksFailed).equal(0)

    await seneca.post('sys:traverse,on:run,do:start', { runId: createRes.run.id })
    await sleep(50)

    const run = await seneca.entity('sys/traverse').load$(createRes.run.id)
    expect(run.status).equal('completed')
  })

  test('scope-root-option-accepted', async () => {
    // In the test environment seneca.root === seneca so this is a smoke test
    // that scope:'root' option does not break the plugin.
    const seneca = makeSeneca()
      .use(Traverse, {
        scope: 'root',
        relations: { parental: [['foo/r0', 'foo/r1']] },
      })
      .message('aim:task,root:test', async function (this: any, msg: any) {
        const taskEnt = msg.task
        taskEnt.status = 'done'
        taskEnt.done_at = Date.now()
        await taskEnt.save$()
        return { ok: true }
      })

    await seneca.ready()

    await seneca.entity('foo/r1').save$({ r0_id: 'root2' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/r0',
      rootEntityId: 'root2',
      taskMsg: 'aim:task,root:test',
    })

    expect(createRes.ok).equal(true)
    expect(createRes.tasksCreated).equal(2)

    await seneca.post('sys:traverse,on:run,do:start', { runId: createRes.run.id })
    await sleep(50)

    const run = await seneca.entity('sys/traverse').load$(createRes.run.id)
    expect(run.status).equal('completed')
  })

  test('stop-detection-uses-run-entity', async () => {
    // Verify that processRunTasks reloads the run entity (sys/traverse),
    // not the task's parent entity, to detect concurrent stops.
    const dispatched: string[] = []

    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [
            ['foo/d0', 'foo/d1'],
            ['foo/d1', 'foo/d2'],
            ['foo/d2', 'foo/d3'],
          ],
        },
      })
      .message('aim:task,stop:test', async function (this: any, msg: any) {
        dispatched.push(msg.task.child_canon)
        const taskEnt = msg.task
        // Slow task to allow stop to race
        await sleep(5)
        taskEnt.status = 'done'
        taskEnt.done_at = Date.now()
        await taskEnt.save$()
        return { ok: true }
      })

    await seneca.ready()

    const d1 = await seneca.entity('foo/d1').save$({ d0_id: 'root3' })
    const d2 = await seneca.entity('foo/d2').save$({ d1_id: d1.id })
    await seneca.entity('foo/d3').save$({ d2_id: d2.id })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/d0',
      rootEntityId: 'root3',
      taskMsg: 'aim:task,stop:test',
    })

    expect(createRes.tasksCreated).equal(4) // root + d1 + d2 + d3

    // Start run (returns immediately in sync mode, runs tasks in background)
    seneca.post('sys:traverse,on:run,do:start', { runId: createRes.run.id })

    // Stop after first task has time to begin but before all tasks finish
    await sleep(10)
    await seneca.post('sys:traverse,on:run,do:stop', { runId: createRes.run.id })

    await sleep(100)

    const run = await seneca.entity('sys/traverse').load$(createRes.run.id)
    // Must be stopped, not completed — stop-detection must have halted the loop
    expect(run.status).equal('stopped')

    // Not all tasks dispatched
    expect(dispatched.length).lessThan(4)
  })

  test('create-run-rolls-back-all-on-partial-failure', async () => {
    // Force a single task save to fail; atomic rollback must remove every task
    // already created AND the run, returning ok:false with the failure count.
    // Overriding sys:entity,cmd:save (not throwing inside a plugin handler) keeps
    // the error a caught promise rejection rather than a fatal process abort.
    const seneca = makeSeneca({ quiet: true })
      .use(Traverse, {
        rootExecute: false,
        relations: {
          parental: [
            ['foo/m0', 'foo/m1'],
            ['foo/m0', 'foo/m2'],
          ],
        },
      })
      .message('aim:task,rollback:fail', async function () {
        return { ok: true }
      })

    await seneca.ready()

    // Reject the save of exactly one child task; let every other save through.
    // Callback-style reply(err) is a normal (non-fatal) action error: it rejects
    // the save$ promise the plugin awaits via Promise.allSettled, without the
    // fatal abort a thrown error would trigger.
    seneca.add(
      'sys:entity,cmd:save,name:traversetask',
      function (this: any, msg: any, reply: any) {
        if (msg.ent && msg.ent.child_canon === 'foo/m2') {
          return reply(new Error('forced-save-failure'))
        }
        return this.prior(msg, reply)
      },
    )

    await seneca.entity('foo/m1').save$({ m0_id: 'root5' })
    await seneca.entity('foo/m2').save$({ m0_id: 'root5' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/m0',
      rootEntityId: 'root5',
      taskMsg: 'aim:task,rollback:fail',
    })

    expect(createRes.ok).equal(false)
    expect(createRes.why).equal('task-create-failed')
    expect(createRes.tasksCreated).equal(0)
    expect(createRes.tasksFailed).equal(1)

    // Run removed — no run rows survive the rollback.
    const runs = await seneca.entity('sys/traverse').list$({})
    expect(runs.length).equal(0)

    // No leaked tasks — the successfully-created m1 task was rolled back too.
    const leaked = await seneca.entity('sys/traversetask').list$({})
    expect(leaked.length).equal(0)
  })

  test('create-run-no-leaked-tasks-on-success', async () => {
    // Verifies the success-path shape introduced alongside atomic rollback:
    // tasksCreated + tasksFailed are exact, and no orphaned tasks exist.
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: { parental: [['foo/a0', 'foo/a1'], ['foo/a0', 'foo/a2']] },
      })
      .message('aim:task,rollback:test', async function (this: any, msg: any) {
        const taskEnt = msg.task
        taskEnt.status = 'done'
        taskEnt.done_at = Date.now()
        await taskEnt.save$()
        return { ok: true }
      })

    await seneca.ready()

    await seneca.entity('foo/a1').save$({ a0_id: 'root4' })
    await seneca.entity('foo/a2').save$({ a0_id: 'root4' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/a0',
      rootEntityId: 'root4',
      taskMsg: 'aim:task,rollback:test',
    })

    expect(createRes.ok).equal(true)
    expect(createRes.tasksFailed).equal(0)
    // root + 2 children
    expect(createRes.tasksCreated).equal(3)
    expect(createRes.run.total_tasks).equal(3)

    // No orphaned tasks outside this run
    const allTasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: createRes.run.id })
    expect(allTasks.length).equal(3)
  })
})
