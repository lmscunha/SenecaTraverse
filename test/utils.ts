/* Copyright © 2025 Seneca Project Contributors, MIT License. */

import Seneca from 'seneca'

// Shared helpers for the Traverse test suite.

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function makeSeneca(_opts: any = {}) {
  const seneca = Seneca({ legacy: false }).test().use('promisify').use('entity')
  return seneca
}

export { sleep, makeSeneca }
