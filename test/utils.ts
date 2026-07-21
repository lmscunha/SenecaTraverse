/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import Seneca from 'seneca'

// Shared helpers for the Traverse test suite.

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Poll `fn` until `ok` returns true (or the timeout elapses), then return the
// last value. Replaces fixed-duration sleeps when waiting for background state
// (tasks run one-in-flight, out-of-band): returns as soon as the condition
// holds instead of always burning a fixed wait, and won't race a slow CI.
async function waitFor<T>(
  fn: () => Promise<T>,
  ok: (v: T) => boolean,
  {
    timeout = 2000,
    interval = 20,
  }: { timeout?: number; interval?: number } = {},
): Promise<T> {
  const start = Date.now()
  let v = await fn()
  while (!ok(v) && Date.now() - start < timeout) {
    await sleep(interval)
    v = await fn()
  }
  return v
}

function makeSeneca(opts: any = {}) {
  // quiet → undead:true keeps the instance alive after a deliberately-failed
  // entity op (the rollback test) so the awaited save$ still rejects for
  // Promise.allSettled instead of aborting the process.
  const senecaOpts: any = { legacy: false }
  if (opts.quiet) {
    senecaOpts.debug = { undead: true }
  }
  const seneca = Seneca(senecaOpts).test().use('promisify').use('entity')
  return seneca
}

export { sleep, waitFor, makeSeneca }
