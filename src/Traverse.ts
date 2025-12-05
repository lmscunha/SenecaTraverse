/* Copyright © 2025 Seneca Project Contributors, MIT License. */

type TraverseOptionsFull = {
  debug: boolean
}

export type TraverseOptions = Partial<TraverseOptionsFull>

function Traverse(this: any, options: TraverseOptionsFull) {
  const seneca: any = this

  const { Default } = seneca.valid

  seneca.fix('sys:traverse')
  // .message('find:deps', msgFindDeps)
}

// Default options.
const defaults: TraverseOptionsFull = {
  // TODO: Enable debug logging
  debug: false,
}

Object.assign(Traverse, { defaults })

export default Traverse

if ('undefined' !== typeof module) {
  module.exports = Traverse
}
