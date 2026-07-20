/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca } from './utils'

// Completion must not scan the task table. The async driver finds the next task
// by walking `seq` down from `max_seq` with an indexed `load$` per level (keyed
// lookup), never `list$`-ing all tasks. These tests assert zero task-table
// `list$` calls during the completion phase, independent of run size — a
// regression to per-completion scanning would make the count scale with n.
describe('Traverse: completion performs no task-table scans', () => {
  async function measureCompletionScans(childCount: number) {
    const seneca = makeSeneca()
      .use(Traverse, {
        mode: 'async',
        rootExecute: false,
        relations: { parental: [['perf/root', 'perf/child']] },
      })
      .message('aim:task,perf:test', async function () {
        return { ok: true }
      })

    await seneca.ready()

    const rootEntityId = 'root-1'

    for (let i = 0; i < childCount; i++) {
      await seneca.entity('perf/child').save$({ root_id: rootEntityId })
    }

    const createRes = await seneca.post('sys:traverse,on:run,do:create', {
      rootEntity: 'perf/root',
      rootEntityId,
      taskMsg: 'aim:task,perf:test',
    })
    const runId = createRes.run.id
    expect(createRes.run.total_tasks).equal(childCount)

    await seneca.post('sys:traverse,on:run,do:start', { runId })

    const tasks = await seneca
      .entity('sys/traversetask')
      .list$({ run_id: runId })
    expect(tasks.length).equal(childCount)

    // Instrument only the completion phase: count list$ against the task table.
    const proto = Object.getPrototypeOf(seneca.entity('sys/traversetask'))
    const origList = proto.list$
    let taskListCalls = 0
    proto.list$ = function (this: any, ...args: any[]) {
      const canon =
        typeof this.canon$ === 'function' ? this.canon$({ string: true }) : ''
      if (String(canon).includes('traversetask')) {
        taskListCalls++
      }
      return origList.apply(this, args)
    }

    try {
      for (const task of tasks) {
        await seneca.post('sys:traverse,on:task,do:complete', {
          taskId: task.id,
        })
      }
    } finally {
      proto.list$ = origList
    }

    const finalRun = await seneca.entity('sys/traverse').load$(runId)
    expect(finalRun.status).equal('completed')
    expect(finalRun.completed_tasks).equal(childCount)

    return taskListCalls
  }

  test('completion does no task-table list$ (keyed lookup, not scan)', async () => {
    const small = await measureCompletionScans(10)
    const large = await measureCompletionScans(60)

    // The driver uses indexed load$ by seq, never list$ on the task table.
    expect(small).equal(0)
    expect(large).equal(0)
  })
})
