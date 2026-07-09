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
function makeSeneca(_opts = {}) {
    const seneca = (0, seneca_1.default)({ legacy: false }).test().use('promisify').use('entity');
    return seneca;
}
//# sourceMappingURL=utils.js.map