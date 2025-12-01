"use strict";
/* Copyright © 2025 Seneca Project Contributors, MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
function Traverse(options) {
    const seneca = this;
    const { Default } = seneca.valid;
    // TODO: entity needs exported util for this
    const canon = ('string' === typeof options.canon.zone ? options.canon.zone : '-') +
        '/' +
        ('string' === typeof options.canon.base ? options.canon.base : '-') +
        '/' +
        ('string' === typeof options.canon.name ? options.canon.name : '-');
    seneca.fix('sys:traverse');
    // .message('find:deps', msgFindDeps)
}
// Default options.
const defaults = {
    // TODO: Enable debug logging
    debug: false,
    canon: {
        zone: undefined,
        base: 'sys',
        name: 'traverse',
    },
};
Object.assign(Traverse, { defaults });
exports.default = Traverse;
if ('undefined' !== typeof module) {
    module.exports = Traverse;
}
//# sourceMappingURL=Traverse.js.map