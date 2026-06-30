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
(0, node_test_1.describe)('Traverse: scope option + atomic rollback', () => {
    (0, node_test_1.test)('scope-principal-default', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: { parental: [['foo/s0', 'foo/s1']] },
        })
            .message('aim:task,scope:test', async function (msg) {
            const taskEnt = msg.task;
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        await seneca.entity('foo/s1').save$({ s0_id: 'root1' });
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'foo/s0',
            rootEntityId: 'root1',
            taskMsg: 'aim:task,scope:test',
        });
        (0, code_1.expect)(createRes.ok).equal(true);
        (0, code_1.expect)(createRes.tasksCreated).equal(2); // root + child
        (0, code_1.expect)(createRes.tasksFailed).equal(0);
        await seneca.post('sys:traverse,on:run,do:start', { runId: createRes.run.id });
        await (0, utils_1.sleep)(50);
        const run = await seneca.entity('sys/traverse').load$(createRes.run.id);
        (0, code_1.expect)(run.status).equal('completed');
    });
    (0, node_test_1.test)('scope-root-option-accepted', async () => {
        // In the test environment seneca.root === seneca so this is a smoke test
        // that scope:'root' option does not break the plugin.
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            scope: 'root',
            relations: { parental: [['foo/r0', 'foo/r1']] },
        })
            .message('aim:task,root:test', async function (msg) {
            const taskEnt = msg.task;
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        await seneca.entity('foo/r1').save$({ r0_id: 'root2' });
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'foo/r0',
            rootEntityId: 'root2',
            taskMsg: 'aim:task,root:test',
        });
        (0, code_1.expect)(createRes.ok).equal(true);
        (0, code_1.expect)(createRes.tasksCreated).equal(2);
        await seneca.post('sys:traverse,on:run,do:start', { runId: createRes.run.id });
        await (0, utils_1.sleep)(50);
        const run = await seneca.entity('sys/traverse').load$(createRes.run.id);
        (0, code_1.expect)(run.status).equal('completed');
    });
    (0, node_test_1.test)('stop-detection-uses-run-entity', async () => {
        // Verify that processRunTasks reloads the run entity (sys/traverse),
        // not the task's parent entity, to detect concurrent stops.
        const dispatched = [];
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [
                    ['foo/d0', 'foo/d1'],
                    ['foo/d1', 'foo/d2'],
                    ['foo/d2', 'foo/d3'],
                ],
            },
        })
            .message('aim:task,stop:test', async function (msg) {
            dispatched.push(msg.task.child_canon);
            const taskEnt = msg.task;
            // Slow task to allow stop to race
            await (0, utils_1.sleep)(5);
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        const d1 = await seneca.entity('foo/d1').save$({ d0_id: 'root3' });
        const d2 = await seneca.entity('foo/d2').save$({ d1_id: d1.id });
        await seneca.entity('foo/d3').save$({ d2_id: d2.id });
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'foo/d0',
            rootEntityId: 'root3',
            taskMsg: 'aim:task,stop:test',
        });
        (0, code_1.expect)(createRes.tasksCreated).equal(4); // root + d1 + d2 + d3
        // Start run (returns immediately in sync mode, runs tasks in background)
        seneca.post('sys:traverse,on:run,do:start', { runId: createRes.run.id });
        // Stop after first task has time to begin but before all tasks finish
        await (0, utils_1.sleep)(10);
        await seneca.post('sys:traverse,on:run,do:stop', { runId: createRes.run.id });
        await (0, utils_1.sleep)(100);
        const run = await seneca.entity('sys/traverse').load$(createRes.run.id);
        // Must be stopped, not completed — stop-detection must have halted the loop
        (0, code_1.expect)(run.status).equal('stopped');
        // Not all tasks dispatched
        (0, code_1.expect)(dispatched.length).lessThan(4);
    });
    (0, node_test_1.test)('create-run-no-leaked-tasks-on-success', async () => {
        // Verifies the success-path shape introduced alongside atomic rollback:
        // tasksCreated + tasksFailed are exact, and no orphaned tasks exist.
        // Rollback-on-failure requires a Seneca instance that survives entity-save
        // errors — tested in integration; Seneca's fatal:true kills in-process mocks.
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: { parental: [['foo/a0', 'foo/a1'], ['foo/a0', 'foo/a2']] },
        })
            .message('aim:task,rollback:test', async function (msg) {
            const taskEnt = msg.task;
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        await seneca.entity('foo/a1').save$({ a0_id: 'root4' });
        await seneca.entity('foo/a2').save$({ a0_id: 'root4' });
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'foo/a0',
            rootEntityId: 'root4',
            taskMsg: 'aim:task,rollback:test',
        });
        (0, code_1.expect)(createRes.ok).equal(true);
        (0, code_1.expect)(createRes.tasksFailed).equal(0);
        // root + 2 children
        (0, code_1.expect)(createRes.tasksCreated).equal(3);
        (0, code_1.expect)(createRes.run.total_tasks).equal(3);
        // No orphaned tasks outside this run
        const allTasks = await seneca
            .entity('sys/traversetask')
            .list$({ run_id: createRes.run.id });
        (0, code_1.expect)(allTasks.length).equal(3);
    });
});
//# sourceMappingURL=scope-rollback.test.js.map