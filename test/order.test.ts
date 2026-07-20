/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Traverse from '..'

import { makeSeneca, sleep } from './utils'

// A linear chain root(l0) → l1 → l2. Returns the tasks sorted by seq once the
// run completes.
async function runChain(reverse: boolean) {
  const opts: any = {
    relations: {
      parental: [
        ['foo/l0', 'foo/l1'],
        ['foo/l1', 'foo/l2'],
      ],
    },
  }
  if (reverse) opts.reverse = true

  const seneca = makeSeneca()
    .use(Traverse, opts)
    .message('aim:task,order:test', async function (this: any, msg: any) {
      await this.post('sys:traverse,on:task,do:complete', {
        taskId: msg.task.id,
      })
      return { ok: true }
    })

  await seneca.ready()

  const l1 = await seneca.entity('foo/l1').save$({ l0_id: 'root1' })
  await seneca.entity('foo/l2').save$({ l1_id: l1.id })

  const createRes = await seneca.post('sys:traverse,on:run,do:create', {
    rootEntity: 'foo/l0',
    rootEntityId: 'root1',
    taskMsg: 'aim:task,order:test',
  })

  await seneca.post('sys:traverse,on:run,do:start', {
    runId: createRes.run.id,
  })
  await sleep(150)

  const run = await seneca.entity('sys/traverse').load$(createRes.run.id)
  expect(run.status).equal('completed')

  const tasks = await seneca
    .entity('sys/traversetask')
    .list$({ run_id: createRes.run.id })
  return tasks.sort((a: any, b: any) => a.seq - b.seq)
}

describe('Traverse: execution order', () => {
  test('default-topological-order-parent-before-children', async () => {
    const bySeq = await runChain(false)

    // Default: root (seq 0) completes first, then each deeper level.
    for (let i = 1; i < bySeq.length; i++) {
      expect(bySeq[i].done_at > bySeq[i - 1].done_at).equal(true)
    }
  })

  test('reverse-order-children-before-parent', async () => {
    const bySeq = await runChain(true)

    // reverse:true — deepest (seq 2) completes first, root last.
    for (let i = 1; i < bySeq.length; i++) {
      expect(bySeq[i].done_at < bySeq[i - 1].done_at).equal(true)
    }
  })

  test('invalid-message-property-rejected', async () => {
    const seneca = makeSeneca().use(Traverse)
    await seneca.ready()

    // do:start requires a string runId; shape rejects a missing/mistyped one.
    let threw = false
    try {
      await seneca.post('sys:traverse,on:run,do:start', { runId: 123 })
    } catch (e) {
      threw = true
    }
    expect(threw).equal(true)
  })
})
