"use strict";
/* Copyright © 2026 Seneca Project Contributors, MIT License. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = sleep;
exports.waitFor = waitFor;
exports.makeSeneca = makeSeneca;
const seneca_1 = __importDefault(require("seneca"));
// Shared helpers for the Traverse test suite.
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// Poll `fn` until `ok` returns true (or the timeout elapses), then return the
// last value. Replaces fixed-duration sleeps when waiting for background state
// (tasks run one-in-flight, out-of-band): returns as soon as the condition
// holds instead of always burning a fixed wait, and won't race a slow CI.
async function waitFor(fn, ok, { timeout = 2000, interval = 20, } = {}) {
    const start = Date.now();
    let v = await fn();
    while (!ok(v) && Date.now() - start < timeout) {
        await sleep(interval);
        v = await fn();
    }
    return v;
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