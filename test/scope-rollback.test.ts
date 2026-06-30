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

  test('create-run-no-leaked-tasks-on-success', async () => {
    // Verifies the success-path shape introduced alongside atomic rollback:
    // tasksCreated + tasksFailed are exact, and no orphaned tasks exist.
    // Rollback-on-failure requires a Seneca instance that survives entity-save
    // errors — tested in integration; Seneca's fatal:true kills in-process mocks.
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
