/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import Seneca from 'seneca'

// Shared helpers for the Traverse test suite.

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

export { sleep, makeSeneca }
