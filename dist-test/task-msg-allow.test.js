"use strict";
/* Copyright © 2026 Seneca Project Contributors, MIT License. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const code_1 = require("@hapi/code");
const __1 = __importDefault(require(".."));
const utils_1 = require("./utils");
// `task_msg` is dispatched as an arbitrary Seneca pattern, so an untrusted
// caller of `do:create` could otherwise schedule any action. The allowlist
// option closes that message-injection vector.
(0, node_test_1.describe)('Traverse: task_msg allowlist', () => {
    (0, node_test_1.test)('rejects a task_msg outside the allowlist', async () => {
        const seneca = (0, utils_1.makeSeneca)().use(__1.default, {
            taskMsgAllow: ['aim:task,allowed:test'],
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'foo/x',
            rootEntityId: '1',
            taskMsg: 'sys:secret,do:exfiltrate',
        });
        (0, code_1.expect)(res.ok).equal(false);
        (0, code_1.expect)(res.why).equal('task-msg-not-allowed');
        // No run should have been created for a rejected pattern.
        const runs = await seneca.entity('sys/traverse').list$();
        (0, code_1.expect)(runs.length).equal(0);
    });
    (0, node_test_1.test)('accepts a task_msg present in the allowlist', async () => {
        const seneca = (0, utils_1.makeSeneca)().use(__1.default, {
            rootExecute: false,
            taskMsgAllow: ['aim:task,allowed:test'],
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'foo/x',
            rootEntityId: '1',
            taskMsg: 'aim:task,allowed:test',
        });
        (0, code_1.expect)(res.ok).equal(true);
        (0, code_1.expect)(res.run.task_msg).equal('aim:task,allowed:test');
    });
    (0, node_test_1.test)('empty allowlist (default) allows any task_msg', async () => {
        const seneca = (0, utils_1.makeSeneca)().use(__1.default, { rootExecute: false });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'foo/x',
            rootEntityId: '1',
            taskMsg: 'anything:goes',
        });
        (0, code_1.expect)(res.ok).equal(true);
    });
});
//# sourceMappingURL=task-msg-allow.test.js.map