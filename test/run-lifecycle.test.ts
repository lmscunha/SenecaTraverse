/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca, sleep, waitFor } from './utils'

describe('Traverse: run lifecycle', () => {
  test('start-run', async () => {
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
      .message('aim:task,print:id', async function (this: any, msg: any) {
        const taskEnt = msg.task
        // console.log('task id: ', taskEnt.id)

        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })

        return { ok: true, a: 1 }
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

    const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId: rootEntityId,
      taskMsg: 'aim:task,print:id',
    })

    const runEnt = createTaskRes.run

    let tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    expect(tasks.length).equal(4)

    for (const task of tasks) {
      expect(task.status).equal('pending')
    }

    const startRunRes = await seneca.post('sys:traverse,on:run,do:start', {
      runId: runEnt.id,
    })

    expect(startRunRes.ok).true()

    await waitFor(
      () => seneca.entity('sys/traverse').load$(runEnt.id),
      (r: any) => r.status === 'completed',
    )

    tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    expect(tasks.length).equal(4)

    for (const task of tasks) {
      expect(task.status).equal('done')
    }
  })

  test('start-run-with-client-sleep', async () => {
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
      .message('aim:task,print:id', async function (this: any, msg: any) {
        const taskEnt = msg.task

        // Simulate some async work to increase chance of race conditions
        await sleep(Math.random() * 10)

        // Mark task as done
        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })

        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/bar0'

    // Create entities at level 1
    const bar1_ent = await seneca
      .entity('foo/bar1')
      .save$({ bar0_id: rootEntityId })
    const bar2_ent = await seneca
      .entity('foo/bar2')
      .save$({ bar0_id: rootEntityId })
    const zed0_ent = await seneca
      .entity('foo/zed0')
      .save$({ bar0_id: rootEntityId })

    // Create entities at level 2
    await seneca.entity('foo/bar4').save$({ bar1_id: bar1_ent.id })
    await seneca.entity('foo/bar5').save$({ bar1_id: bar1_ent.id })
    await seneca.entity('foo/bar3').save$({ bar2_id: bar2_ent.id })
    await seneca.entity('foo/bar9').save$({ bar2_id: bar2_ent.id })
    await seneca.entity('foo/zed1').save$({ zed0_id: zed0_ent.id })

    const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId: rootEntityId,
      taskMsg: 'aim:task,print:id',
    })

    const runEnt = createTaskRes.run

    let tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    expect(tasks.length).equal(9)

    for (const task of tasks) {
      expect(task.status).equal('pending')
    }

    const startRunRes = await seneca.post('sys:traverse,on:run,do:start', {
      runId: runEnt.id,
    })

    expect(startRunRes.ok).equal(true)

    // Wait for all tasks to complete
    await waitFor(
      () => seneca.entity('sys/traverse').load$(runEnt.id),
      (r: any) => r.status === 'completed',
    )

    tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    expect(tasks.length).equal(9)

    for (const task of tasks) {
      expect(task.status).equal('done')
    }

    // Sequential: no two tasks complete at the same instant.
    const timestamps = tasks.map((t: any) => t.done_at)
    expect(new Set(timestamps).size).equal(timestamps.length)

    // Topological order (default): shallower tasks (lower seq) complete first.
    const byCompletion = [...tasks].sort(
      (a: any, b: any) => a.done_at - b.done_at,
    )
    for (let i = 1; i < byCompletion.length; i++) {
      expect(byCompletion[i].seq >= byCompletion[i - 1].seq).equal(true)
    }

    const run = await seneca.entity('sys/traverse').load$(runEnt.id)
    expect(run.status).equal('completed')
  })

  test('start-run-no-children', async () => {
    const seneca = makeSeneca()
      .use(Traverse)
      .message('aim:task,empty:test', async function (this: any, msg: any) {
        const taskEnt = msg.task

        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })

        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/bar0'

    // Don't create any child entities

    const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,empty:test',
    })

    const runEnt = createTaskRes.run

    let tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    expect(tasks.length).equal(1) // Only root task
    expect(runEnt.total_tasks).equal(1)

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: runEnt.id,
    })

    await waitFor(
      () => seneca.entity('sys/traverse').load$(runEnt.id),
      (r: any) => r.status === 'completed',
    )

    tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    expect(tasks[0].status).equal('done')

    const run = await seneca.entity('sys/traverse').load$(runEnt.id)

    expect(run.status).equal('completed')
  })

  test('star-run-deep', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [
            ['foo/l0', 'foo/l1'],
            ['foo/l1', 'foo/l2'],
            ['foo/l2', 'foo/l3'],
            ['foo/l3', 'foo/l4'],
            ['foo/l4', 'foo/l5'],
          ],
        },
      })
      .message('aim:task,deep:test', async function (this: any, msg: any) {
        const taskEnt = msg.task

        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })
        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/l0'

    // Create a deep chain
    const l1 = await seneca.entity('foo/l1').save$({ l0_id: rootEntityId })
    const l2 = await seneca.entity('foo/l2').save$({ l1_id: l1.id })
    const l3 = await seneca.entity('foo/l3').save$({ l2_id: l2.id })
    const l4 = await seneca.entity('foo/l4').save$({ l3_id: l3.id })
    await seneca.entity('foo/l5').save$({ l4_id: l4.id })

    const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,deep:test',
    })

    const runEnt = createTaskRes.run

    let tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    expect(tasks.length).equal(6) // l0 + l1 + l2 + l3 + l4 + l5

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: runEnt.id,
    })

    await waitFor(
      () => seneca.entity('sys/traverse').load$(runEnt.id),
      (r: any) => r.status === 'completed',
    )

    tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    // Verify all done
    for (const task of tasks) {
      expect(task.status).equal('done')
    }

    // Topological order (default): each parent completes before its children.
    const bySeq = [...tasks].sort((a: any, b: any) => a.seq - b.seq)
    for (let i = 1; i < bySeq.length; i++) {
      expect(bySeq[i].done_at > bySeq[i - 1].done_at).equal(true)
    }

    const run = await seneca.entity('sys/traverse').load$(runEnt.id)
    expect(run.status).equal('completed')
  })

  test('stop-run', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar0', 'foo/bar2'],
            ['foo/bar0', 'foo/zed0'],
          ],
        },
      })
      .message('aim:task,print:id', async function (this: any, msg: any) {
        const taskEnt = msg.task
        // console.log('task id: ', taskEnt.id)

        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })

        return { ok: true, a: 1 }
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

    const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId: rootEntityId,
      taskMsg: 'aim:task,print:id',
    })

    const runEnt = createTaskRes.run

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: runEnt.id,
    })

    const stopRunRes = await seneca.post('sys:traverse,on:run,do:stop', {
      runId: runEnt.id,
    })

    expect(stopRunRes.ok).true()
    expect(stopRunRes.run.status).equal('stopped')
  })

  test('stop-run-block-completion', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [
            ['foo/l0', 'foo/l1'],
            ['foo/l1', 'foo/l2'],
            ['foo/l2', 'foo/l3'],
            ['foo/l3', 'foo/l4'],
            ['foo/l4', 'foo/l5'],
          ],
        },
      })
      .message('aim:task,deep:test', async function (this: any, msg: any) {
        const taskEnt = msg.task

        await sleep(Math.random() * 15)

        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })
        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/l0'

    const l1 = await seneca.entity('foo/l1').save$({ l0_id: rootEntityId })
    const l2 = await seneca.entity('foo/l2').save$({ l1_id: l1.id })
    const l3 = await seneca.entity('foo/l3').save$({ l2_id: l2.id })
    const l4 = await seneca.entity('foo/l4').save$({ l3_id: l3.id })
    await seneca.entity('foo/l5').save$({ l4_id: l4.id })

    const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,deep:test',
    })

    const runEnt = createTaskRes.run

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: runEnt.id,
    })

    await seneca.post('sys:traverse,on:run,do:stop', {
      runId: runEnt.id,
    })

    // Let the in-flight task settle; the chain must not advance past stop.
    await sleep(60)

    const tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    // Stop halts dispatch, so tasks remain pending and the run never completes.
    const pending = tasks.filter((t: any) => t.status === 'pending')
    expect(pending.length >= 1).equal(true)

    const run = await seneca.entity('sys/traverse').load$(runEnt.id)

    expect(run.status).equal('stopped')
  })

  test('restart-run', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar0', 'foo/bar2'],
            ['foo/bar0', 'foo/zed0'],
          ],
        },
      })
      .message('aim:task,deep:test', async function (this: any, msg: any) {
        const taskEnt = msg.task

        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })
        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/bar0'

    const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,deep:test',
    })

    const runEnt = createTaskRes.run

    const tasks = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })
    const originalIds = tasks.map((t: any) => t.id).sort()

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: runEnt.id,
    })

    await waitFor(
      () => seneca.entity('sys/traverse').load$(runEnt.id),
      (r: any) => r.status === 'completed',
    )

    const tasksRestart = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    // Verify all done, and no new tasks were created.
    tasksRestart.forEach((task: any) => {
      expect(task.status).equal('done')
    })
    expect(tasksRestart.map((t: any) => t.id).sort()).equal(originalIds)

    const run = await seneca.entity('sys/traverse').load$(runEnt.id)
    expect(run.status).equal('completed')
  })

  test('returns-before-tasks-complete', async () => {
    let executionCount = 0

    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [
            ['foo/a0', 'foo/a1'],
            ['foo/a0', 'foo/a2'],
          ],
        },
      })
      .message('aim:task,async:test', async function (this: any, msg: any) {
        await sleep(50)
        executionCount++
        // Host signals completion once the task's work is done.
        await this.post('sys:traverse,on:task,do:complete', {
          taskId: msg.task.id,
        })
        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/a0'

    await seneca.entity('foo/a1').save$({ a0_id: rootEntityId })
    await seneca.entity('foo/a2').save$({ a0_id: rootEntityId })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,async:test',
    })

    const runEnt = createRes.run

    const startedAt = Date.now()
    const startRes = await seneca.post('sys:traverse,on:run,do:start', {
      runId: runEnt.id,
    })
    const elapsed = Date.now() - startedAt

    expect(startRes.ok).equal(true)
    // returned before the 50 ms task delay — not awaiting tasks
    expect(elapsed).lessThan(40)
    expect(executionCount).equal(0)

    // Wait for background completion — tasks run serially (one in flight), so a
    // fixed sleep races a slow CI.
    const finalRun = await waitFor(
      () => seneca.entity('sys/traverse').load$(runEnt.id),
      (r: any) => r.status === 'completed',
    )

    expect(executionCount).equal(3) // root + 2 children

    // completion barrier: run finishes once every task reports done
    expect(finalRun.status).equal('completed')
    expect(finalRun.completed_at).exist()
  })

  test('completes-only-after-all-tasks-done', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [['foo/c0', 'foo/c1']],
        },
      })
      .message('aim:task,barrier:test', async function () {
        // Host drives completion explicitly, task-by-task.
        return { ok: true }
      })

    await seneca.ready()

    // Override dispatch so it does NOT auto-complete: the host (this test)
    // signals each task's completion by hand, exercising the barrier gate.
    seneca.message(
      'sys:traverse,do:dispatch,on:task',
      async function (this: any, msg: any) {
        await this.post(msg.task.task_msg, { task: msg.task })
        return { ok: true }
      },
    )

    const rootEntityId = '123'
    const rootEntity = 'foo/c0'

    await seneca.entity('foo/c1').save$({ c0_id: rootEntityId })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,barrier:test',
    })
    const runId = createRes.run.id

    await seneca.post('sys:traverse,on:run,do:start', { runId })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: runId })
    expect(tasks.length).equal(2) // root + 1 child

    // Complete the first task — run must stay active.
    const firstRes = await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: tasks[0].id,
    })
    expect(firstRes.ok).equal(true)
    const afterFirst = await seneca.entity('sys/traverse').load$(runId)
    expect(afterFirst.status).equal('active')

    // Complete the last task — run advances to completed.
    await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: tasks[1].id,
    })
    const afterLast = await seneca.entity('sys/traverse').load$(runId)
    expect(afterLast.status).equal('completed')
  })

  test('empty-run-completes-immediately', async () => {
    const seneca = makeSeneca().use(Traverse, {
      rootExecute: false,
      relations: { parental: [] },
    })
    await seneca.ready()

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'foo/d0',
      rootEntityId: '123',
      taskMsg: 'aim:task,noop:test',
    })
    expect(createRes.run.total_tasks).equal(0)

    const startRes = await seneca.post('sys:traverse,on:run,do:start', {
      runId: createRes.run.id,
    })
    expect(startRes.run.status).equal('completed')
  })

  // Reverse-BFS guarantee: a parent is never executed before its children. This
  // is what keeps a destructive task (e.g. delete) from stranding a dangling
  // reference — children are scrubbed before the parent that points at them.
  test('executes-children-before-parents', async () => {
    const executed: string[] = []

    const seneca = makeSeneca()
      .use(Traverse, {
        reverse: true,
        relations: {
          parental: [
            ['foo/e0', 'foo/e1'],
            ['foo/e1', 'foo/e2'],
          ],
        },
      })
      .message('aim:task,order:test', async function (this: any, msg: any) {
        const task = msg.task

        // Every deeper task must already be done when this one runs.
        const deeper = await this.entity('sys/traversetask').list$({
          run_id: task.run_id,
        })
        const violation = deeper.find(
          (t: any) => t.seq > task.seq && t.status !== 'done',
        )
        expect(violation).equal(undefined)

        executed.push(task.child_canon)

        await sleep(Math.random() * 10)
        await this.post('sys:traverse,on:task,do:complete', {
          taskId: task.id,
        })
        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/e0'

    const e1 = await seneca.entity('foo/e1').save$({ e0_id: rootEntityId })
    await seneca.entity('foo/e2').save$({ e1_id: e1.id })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,order:test',
    })

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: createRes.run.id,
    })

    await waitFor(
      () => seneca.entity('sys/traverse').load$(createRes.run.id),
      (r: any) => r.status === 'completed',
    )

    // Deepest-first: e2 (seq 2) then e1 (seq 1) then the root e0 (seq 0).
    expect(executed).equal(['foo/e2', 'foo/e1', 'foo/e0'])

    const run = await seneca.entity('sys/traverse').load$(createRes.run.id)
    expect(run.status).equal('completed')
  })

  test('complete-unknown-task', async () => {
    const seneca = makeSeneca().use(Traverse)
    await seneca.ready()

    // Idempotent: a completion for a missing task is a no-op ok — an
    // at-least-once transport may redeliver after cleanup, and that must not
    // become a poison message.
    const res = await seneca.post('sys:traverse,on:task,do:complete', {
      taskId: 'does-not-exist',
    })
    expect(res.ok).equal(true)
  })

  test('dispatch-pin-override', async () => {
    const dispatched: string[] = []

    const seneca = makeSeneca()
      .use(Traverse, {
        reverse: true,
        relations: {
          parental: [['foo/b0', 'foo/b1']],
        },
      })
      .message('aim:task,dispatch:test', async function () {
        return { ok: true }
      })

    await seneca.ready()

    // Override must register after ready() — Seneca loads plugins asynchronously,
    // so the plugin's handler is registered during ready(). A pre-ready .message()
    // call would be overwritten by the plugin. Hosts override the same way.
    // Signal completion so the level walk advances to the next (shallower) level.
    seneca.message(
      'sys:traverse,do:dispatch,on:task',
      async function (this: any, msg: any) {
        dispatched.push(msg.task.child_canon)
        await this.post('sys:traverse,on:task,do:complete', {
          taskId: msg.task.id,
        })
        return { ok: true }
      },
    )

    const rootEntityId = '123'
    const rootEntity = 'foo/b0'

    await seneca.entity('foo/b1').save$({ b0_id: rootEntityId })

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,dispatch:test',
    })

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: createRes.run.id,
    })

    await waitFor(
      async () => dispatched.length,
      (n) => n >= 2,
    )

    // Override intercepts every dispatch; default transport never called.
    // Reverse-BFS: the child (seq 1) dispatches before the root (seq 0).
    expect(dispatched).equal(['foo/b1', 'foo/b0'])
  })

  test('restart-run-previously-stopped', async () => {
    const seneca = makeSeneca()
      .use(Traverse, {
        relations: {
          parental: [
            ['foo/l0', 'foo/l1'],
            ['foo/l1', 'foo/l2'],
          ],
        },
      })
      .message('aim:task,done:test', async function (this: any, msg: any) {
        const taskEnt = msg.task

        // Delay so a stop issued right after start lands before completion.
        await sleep(20)
        await this.post('sys:traverse,on:task,do:complete', {
          taskId: taskEnt.id,
        })
        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = '123'
    const rootEntity = 'foo/l0'

    const l1 = await seneca.entity('foo/l1').save$({ l0_id: rootEntityId })
    await seneca.entity('foo/l2').save$({ l1_id: l1.id })

    const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity,
      rootEntityId,
      taskMsg: 'aim:task,done:test',
    })

    const runEnt = createTaskRes.run

    await seneca.post('sys:traverse,on:run,do:start', {
      runId: runEnt.id,
    })

    const tasksRunStart = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })
    expect(tasksRunStart.length).equal(3)

    await seneca.post('sys:traverse,on:run,do:stop', {
      runId: runEnt.id,
    })

    const tasksRunStop = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    // Stop halts dispatch: tasks remain pending, the run does not complete.
    const pending = tasksRunStop.filter((t: any) => t.status === 'pending')
    expect(pending.length >= 1).equal(true)

    const runStopRes = await seneca.entity('sys/traverse').load$(runEnt.id)

    expect(runStopRes.status).equal('stopped')

    // run the same process again
    await seneca.post('sys:traverse,on:run,do:start', {
      runId: runEnt.id,
    })

    await waitFor(
      () => seneca.entity('sys/traverse').load$(runEnt.id),
      (r: any) => r.status === 'completed',
    )

    const tasksRestart = await seneca.entity('sys/traversetask').list$({
      run_id: runEnt.id,
    })

    // number of tasks shouldn't change
    expect(tasksRestart.length).equal(tasksRunStart.length)

    // Verify all done
    tasksRestart.forEach((task: any) => {
      expect(task.status).equal('done')
    })
    expect(tasksRestart.map((t: any) => t.id).sort()).equal(
      tasksRunStart.map((t: any) => t.id).sort(),
    )

    // Topological order (default): each parent completes before its children.
    const bySeq = [...tasksRestart].sort((a: any, b: any) => a.seq - b.seq)
    for (let i = 1; i < bySeq.length; i++) {
      expect(bySeq[i].done_at > bySeq[i - 1].done_at).equal(true)
    }

    const run = await seneca.entity('sys/traverse').load$(runEnt.id)
    expect(run.status).equal('completed')
  })

  // awaitDispatch flushes the per-task do:execute (task-row save + transport
  // send) inside the do:start await instead of firing it and returning. Observe
  // it by making the dispatch handler slow: with awaitDispatch the dispatch has
  // already run when do:start resolves; by default it has not.
  test('await-dispatch-flushes-before-return', async () => {
    async function run(awaitDispatch: boolean): Promise<string[]> {
      const dispatched: string[] = []

      const seneca = makeSeneca().use(Traverse, {
        awaitDispatch,
        relations: { parental: [] },
      })

      await seneca.ready()

      seneca.message(
        'sys:traverse,do:dispatch,on:task',
        async function (this: any, msg: any) {
          // Slow send: a fire-and-forget dispatch is still pending here.
          await sleep(30)
          dispatched.push(msg.task.child_canon)
          await this.post('sys:traverse,on:task,do:complete', {
            taskId: msg.task.id,
          })
          return { ok: true }
        },
      )

      const rootEntityId = '123'
      const rootEntity = 'foo/b0'

      const createRes = await seneca.post('sys:traverse,on:run,do:create', {
        rootEntity,
        rootEntityId,
        taskMsg: 'aim:task,dispatch:test',
      })

      await seneca.post('sys:traverse,on:run,do:start', {
        runId: createRes.run.id,
      })

      // Sampled the instant do:start returns — no sleep.
      return dispatched
    }

    // awaitDispatch: do:start awaits the slow dispatch, so it has already run.
    expect(await run(true)).equal(['foo/b0'])

    // Default: do:start returns before the slow dispatch completes.
    expect(await run(false)).equal([])
  })
})
