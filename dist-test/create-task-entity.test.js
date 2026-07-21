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
// createTaskEntity is transport-agnostic: reuse a method-preserving entity
// as-is, rehydrate a lossy plain object (e.g. AWS SQS). Pin both branches.
(0, node_test_1.describe)('Traverse: createTaskEntity transport handling', () => {
    async function setup() {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default)
            .message('aim:task,cte:test', async function () {
            return { ok: true };
        });
        await seneca.ready();
        const run = await seneca.entity('sys/traverse').save$({
            status: 'active',
            total_tasks: 1,
            completed_tasks: 0,
            task_msg: 'aim:task,cte:test',
        });
        const task = await seneca.entity('sys/traversetask').save$({
            run_id: run.id,
            status: 'pending',
            task_msg: 'aim:task,cte:test',
            parent_id: 'p',
            child_id: 'c',
            parent_canon: 'foo/p',
            child_canon: 'foo/c',
            seq: 0,
        });
        return { seneca, run, task };
    }
    // Methods preserved: the live task is used directly, proven by its own save$
    // running (a rebuild would not touch it).
    (0, node_test_1.test)('method-preserving transport reuses the live task entity', async () => {
        const { seneca, task } = await setup();
        // Spy the entity's own save$ — only runs if returned as-is, not rebuilt.
        let ownSaveCalled = false;
        const originalSave = task.save$.bind(task);
        task.save$ = async function (...args) {
            ownSaveCalled = true;
            return originalSave(...args);
        };
        await seneca.post('sys:traverse,on:task,do:execute', { task });
        (0, code_1.expect)(ownSaveCalled).equal(true);
        const reloaded = await seneca.entity('sys/traversetask').load$(task.id);
        (0, code_1.expect)(reloaded.status).equal('dispatched');
    });
    // Methods lost (plain JSON): must rehydrate so the status write persists.
    (0, node_test_1.test)('lossy transport (plain object) is rehydrated and persists', async () => {
        const { seneca, task } = await setup();
        const plain = { ...task.data$() };
        (0, code_1.expect)(plain.save$).equal(undefined);
        await seneca.post('sys:traverse,on:task,do:execute', { task: plain });
        const reloaded = await seneca.entity('sys/traversetask').load$(task.id);
        (0, code_1.expect)(reloaded.status).equal('dispatched');
    });
});
//# sourceMappingURL=create-task-entity.test.js.map