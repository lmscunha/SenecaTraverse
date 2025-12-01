/* Copyright © 2025 Seneca Project Contributors, MIT License. */

type TraverseOptionsFull = {
  debug: boolean
  canon: {
    zone: string | undefined
    base: string | undefined
    name: string | undefined
  }
}

export type TraverseOptions = Partial<TraverseOptionsFull>

function Traverse(this: any, options: TraverseOptionsFull) {
  const seneca: any = this

  const { Default } = seneca.valid

  // TODO: entity needs exported util for this
  const canon =
    ('string' === typeof options.canon.zone ? options.canon.zone : '-') +
    '/' +
    ('string' === typeof options.canon.base ? options.canon.base : '-') +
    '/' +
    ('string' === typeof options.canon.name ? options.canon.name : '-')

  seneca.fix('sys:traverse')
  // .message('find:deps', msgFindDeps)
}

// Default options.
const defaults: TraverseOptionsFull = {
  // TODO: Enable debug logging
  debug: false,

  canon: {
    zone: undefined,
    base: 'sys',
    name: 'traverse',
  },
}

Object.assign(Traverse, { defaults })

export default Traverse

if ('undefined' !== typeof module) {
  module.exports = Traverse
}
