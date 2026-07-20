/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca } from './utils'

// The async completion barrier must cost O(1) work per completion, not O(n).
// The previous implementation counted done tasks with a `list$` table scan on
// every `do:complete`, making a full run O(n^2). These tests assert the
// completion phase performs a bounded (constant) number of task table scans,
// independent of the run size — a regression to per-completion scanning would
// make the counts scale with n and fail.
describe('Traverse: completion barrier performance', () => {
  // Count `list$` calls against the sys/traversetask table by wrapping the
  // shared entity prototype. Returns { taskListCalls } for the completion phase
  // only (create/start scans are excluded by resetting before completing).
  async function measureCompletionScans(childCount: number) {
    const seneca = makeSeneca()
      .use(Traverse, {
        mode: 'async',
        rootExecute: false,
        relations: { parental: [['perf/root', 'perf/child']] },
      })
      // Host drives completion explicitly; no work in the task itself.
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

    // Instrument only the completion phase.
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
      // Always restore the shared prototype so other tests are unaffected.
      proto.list$ = origList
    }

    const finalRun = await seneca.entity('sys/traverse').load$(runId)
    expect(finalRun.status).equal('completed')
    expect(finalRun.completed_tasks).equal(childCount)

    return taskListCalls
  }

  test('completion performs no per-task table scans (constant, not linear)', async () => {
    const small = await measureCompletionScans(10)
    const large = await measureCompletionScans(60)

    // Counter-based completion never scans the task table on `do:complete`.
    expect(small).equal(0)
    expect(large).equal(0)

    // The decisive non-quadratic assertion: scan count does not grow with the
    // number of completions. Per-completion scanning would yield small≈10,
    // large≈60 (linear per completion => quadratic per run).
    expect(large).equal(small)
  })
})
