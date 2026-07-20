"use strict";
/* Copyright © 2026 Seneca Project Contributors, MIT License. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = sleep;
exports.makeSeneca = makeSeneca;
const seneca_1 = __importDefault(require("seneca"));
// Shared helpers for the Traverse test suite.
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function makeSeneca(opts = {}) {
    // quiet → undead:true keeps the instance alive after a deliberately-failed
    // entity op (the rollback test) so the awaited save$ still rejects for
    // Promise.allSettled instead of aborting the process.
    const senecaOpts = { legacy: false };
    if (opts.quiet) {
        senecaOpts.debug = { undead: true };
    }
    const seneca = (0, seneca_1.default)(senecaOpts).test().use('promisify').use('entity');
    return seneca;
}
//# sourceMappingURL=utils.js.map