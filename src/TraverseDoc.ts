/* Copyright © 2024 Seneca Project Contributors, MIT License. */

const docs = {
  messages: {
    msgFindDeps: {
      desc: 'Returns a sorted list of entity pairs starting from a given entity.',
    },
    msgFindChildren: {
      desc: 'Returns all discovered child instances with their parent relationship.',
    },
  },
}

export default docs

if ('undefined' !== typeof module) {
  module.exports = docs
}
