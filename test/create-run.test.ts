/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca } from './utils'

describe('Traverse: create run', () => {
  test('create-run', async () => {
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
        return
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

    const res = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId: rootEntityId,
      taskMsg: 'aim:task,print:id',
    })

    expect(res.ok).true()
    expect(res.tasksCreated).equal(4)
    expect(res.tasksFailed).equal(0)

    const runEntRes = await seneca.entity('sys/traverse').list$()
    const runEnt = runEntRes[0]

    expect(res.run.id).equal(runEnt.id)

    expect(runEnt.root_entity).equal(rootEntity)
    expect(runEnt.root_id).equal(rootEntityId)
    expect(runEnt.status).equal('created')
    expect(runEnt.task_msg).equal('aim:task,print:id')
    expect(runEnt.total_tasks).equal(4)
  })

  test('create-run-empty-children', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [],
        },
      })
      .message('aim:task,print:id', async function (msg: any) {
        return
      })
    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/bar0'

    const createRunRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,print:id',
    })

    expect(createRunRes.ok).true()
    expect(createRunRes.run).to.exist()
    expect(createRunRes.run.total_tasks).to.equal(1)
    expect(createRunRes.tasksCreated).to.equal(1)
    expect(createRunRes.tasksFailed).to.equal(0)
    expect(createRunRes.run.status).to.equal('created')
  })

  test('create-run-empty-children-no-root-execute', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [],
        },
        rootExecute: false,
      })
      .message('aim:task,print:id', async function (msg: any) {
        return
      })
    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/bar0'

    const createRunRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,print:id',
    })

    expect(createRunRes.ok).true()
    expect(createRunRes.run).to.exist()
    expect(createRunRes.run.total_tasks).to.equal(0)
    expect(createRunRes.tasksCreated).to.equal(0)
    expect(createRunRes.tasksFailed).to.equal(0)
    expect(createRunRes.run.status).to.equal('created')
  })

  test('create-run-single-child', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [['foo/bar0', 'foo/bar1']],
        },
      })
      .message('aim:task,print:id', async function (msg: any) {
        return
      })
    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/bar0'

    await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const createRunRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,print:id',
    })

    expect(createRunRes.ok).true()
    expect(createRunRes.tasksCreated).to.equal(2)
    expect(createRunRes.tasksFailed).to.equal(0)
    expect(createRunRes.run.total_tasks).to.equal(2)

    const tasks = await seneca.entity('sys/traversetask').list$({
      run_id: createRunRes.run.id,
    })
    expect(tasks.length).to.equal(2)
    expect(tasks[0].status).to.equal('pending')
    expect(tasks[0].task_msg).to.equal('aim:task,print:id')
    expect(tasks[1].status).to.equal('pending')
    expect(tasks[1].task_msg).to.equal('aim:task,print:id')
  })

  test('create-run-nested-hierarchy', async () => {
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
        return
      })
    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/bar0'

    // Level 1: Direct children of bar0
    const bar1Ent = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })
    const bar2Ent = await seneca.entity('foo/bar2').save$({
      bar0_id: rootEntityId,
    })
    const zed0Ent = await seneca.entity('foo/zed0').save$({
      bar0_id: rootEntityId,
    })

    // Level 2: Children of bar1
    const bar4Ent = await seneca.entity('foo/bar4').save$({
      bar1_id: bar1Ent.id,
    })
    const bar5Ent = await seneca.entity('foo/bar5').save$({
      bar1_id: bar1Ent.id,
    })

    // Level 2: Children of bar2
    const bar3Ent = await seneca.entity('foo/bar3').save$({
      bar2_id: bar2Ent.id,
    })
    await seneca.entity('foo/bar9').save$({
      bar2_id: bar2Ent.id,
    })

    // Level 2: Children of zed0
    const zed1Ent = await seneca.entity('foo/zed1').save$({
      zed0_id: zed0Ent.id,
    })

    // Level 3: Children of bar3
    const bar6Ent = await seneca.entity('foo/bar6').save$({
      bar3_id: bar3Ent.id,
    })

    // Level 3: Children of bar4
    const bar7Ent = await seneca.entity('foo/bar7').save$({
      bar4_id: bar4Ent.id,
    })

    // Level 3: Children of bar5
    await seneca.entity('foo/bar8').save$({
      bar5_id: bar5Ent.id,
    })

    // Level 3: Children of zed1
    await seneca.entity('foo/zed2').save$({
      zed1_id: zed1Ent.id,
    })

    // Level 4: Children of bar6
    await seneca.entity('foo/bar10').save$({
      bar6_id: bar6Ent.id,
    })

    // Level 4: Children of bar7
    await seneca.entity('foo/bar11').save$({
      bar7_id: bar7Ent.id,
    })

    const createRunRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,print:id',
    })

    expect(createRunRes.ok).true()
    expect(createRunRes.tasksCreated).to.equal(15)
    expect(createRunRes.tasksFailed).to.equal(0)
    expect(createRunRes.run.total_tasks).to.equal(15)

    const tasks = await seneca.entity('sys/traversetask').list$({
      run_id: createRunRes.run.id,
    })
    expect(tasks.length).to.equal(15)
  })
})
