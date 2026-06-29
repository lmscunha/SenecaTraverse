/* Copyright © 2025 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Seneca from 'seneca'

import Traverse from '..'

import { makeSeneca, sleep } from './support'

describe('Traverse: execute task', () => {
  test('execute-task', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar0', 'foo/bar2'],
            ['foo/bar0', 'foo/zed0'],
            ['foo/bar1', 'foo/bar4'],
            ['foo/bar1', 'foo/bar5'],
            ['foo/bar2', 'foo/bar3'],
            ['foo/bar2', 'foo/bar9'],
            ['foo/zed0', 'foo/zed1'],
            ['foo/bar3', 'foo/bar6'],
            ['foo/bar4', 'foo/bar7'],
            ['foo/bar5', 'foo/bar8'],
            ['foo/zed1', 'foo/zed2'],
            ['foo/bar6', 'foo/bar10'],
            ['foo/bar7', 'foo/bar11'],
          ],
        },
      })
      .message('aim:task,print:id', async function (msg: any) {
        const taskEnt = msg.task

        // console.log('task_id', taskEnt.id)

        taskEnt.status = 'done'
        await taskEnt.save$()
      })

    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/bar0'

    // only level 1 entities actually exist
    await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    await seneca.entity('foo/bar2').save$({
      bar0_id: rootEntityId,
    })

    await seneca.entity('foo/zed0').save$({
      bar0_id: rootEntityId,
    })

    await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId: rootEntityId,
      taskMsg: 'aim:task,print:id',
    })

    const taskList = await seneca.entity('sys/traversetask').list$()
    // console.log('task list ', taskList)
    const res = await seneca.post('sys:traverse,on:task,do:execute', {
      task: taskList[0],
    })

    expect(res.ok).equal(true)

    const taskEnt = await seneca
      .entity('sys/traversetask')
      .load$(taskList[0].id)

    expect(taskEnt.status).equal('done')
  })

  test('execute-task-double', async () => {
    let executionCount = 0

    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [['foo/bar0', 'foo/bar1']],
        },
      })
      .message('aim:task,count:test', async function (this: any, msg: any) {
        const taskEnt = msg.task
        executionCount++

        taskEnt.status = 'done'
        taskEnt.done_at = Date.now()
        await taskEnt.save$()

        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/bar0'

    await seneca.entity('foo/bar1').save$({ bar0_id: rootEntityId })

    const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,count:test',
    })

    const runEnt = createTaskRes.run

    const tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    const task = tasks[0]

    // Try to execute the same task twice manually
    const exec1 = seneca.post('sys:traverse,on:task,do:execute', { task })
    const exec2 = seneca.post('sys:traverse,on:task,do:execute', { task })

    await Promise.all([exec1, exec2])

    // TODO: improve async validation
    await sleep(50)

    expect(executionCount).equal(1)

    const updatedTask = await seneca.entity('sys/traversetask').load$(task.id)
    expect(updatedTask.status).equal('done')
  })
})
