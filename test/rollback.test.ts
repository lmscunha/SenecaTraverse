/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca, sleep, waitFor } from './utils'

describe('Traverse: atomic rollback', () => {
  test('run-completes', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: { parental: [['foo/s0', 'foo/s1']] },
      })
      .message('aim:task,run:test', async function (this: any, msg: any) {
        const taskEnt = msg.task
        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })
        return { ok: true }
      })

    await seneca.ready()

    await seneca.entity('foo/s1').save$({ s0_id: 'root1' })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/s0',
      rootEntityId: 'root1',
      taskMsg: 'aim:task,run:test',
    })

    expect(createRes.ok).equal(true)
    expect(createRes.tasksCreated).equal(2) // root + child
    expect(createRes.tasksFailed).equal(0)

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: createRes.run.id,
    })

    const run = await waitFor(
      () => seneca.entity('sys/traverse').load$(createRes.run.id),
      (r: any) => r.status === 'completed',
    )
    expect(run.status).equal('completed')
  })

  test('stop-halts-the-run', async () => {
    // A stop mid-run halts dispatch: not every task runs and the run ends
    // 'stopped', not 'completed'.
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
        await sleep(5)
        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })
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

    seneca.post('sys:traverse,on:run,do:start', { runId: createRes.run.id })

    // Stop only after at least one task has started dispatching.
    await waitFor(
      async () => dispatched.length,
      (n) => n >= 1,
    )
    await seneca.post('sys:traverse,on:run,do:stop', {
      runId: createRes.run.id,
    })

    // Settle: give any (erroneous) further dispatch a chance to appear.
    await sleep(100)

    const run = await seneca.entity('sys/traverse').load$(createRes.run.id)
    expect(run.status).equal('stopped')
    expect(dispatched.length).lessThan(4)
  })

  test('create-run-rolls-back-all-on-partial-failure', async () => {
    // Force one task save to fail; rollback must remove every created task AND
    // the run, returning ok:false with the failure count.
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

    const runs = await seneca.entity('sys/traverse').list$({})
    expect(runs.length).equal(0)

    const leaked = await seneca.entity('sys/traversetask').list$({})
    expect(leaked.length).equal(0)
  })

  test('create-run-no-leaked-tasks-on-success', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [
            ['foo/a0', 'foo/a1'],
            ['foo/a0', 'foo/a2'],
          ],
        },
      })
      .message('aim:task,rollback:test', async function (this: any, msg: any) {
        const taskEnt = msg.task
        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })
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
    expect(createRes.tasksCreated).equal(3) // root + 2 children
    expect(createRes.run.total_tasks).equal(3)

    const allTasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: createRes.run.id })
    expect(allTasks.length).equal(3)
  })
})
