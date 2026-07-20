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
(0, node_test_1.describe)('Traverse: atomic rollback', () => {
    (0, node_test_1.test)('run-completes', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: { parental: [['foo/s0', 'foo/s1']] },
        })
            .message('aim:task,run:test', async function (msg) {
            const taskEnt = msg.task;
            await this.post('sys:traverse,on:task,do:complete', {
                taskId: taskEnt.id,
            });
            return { ok: true };
        });
        await seneca.ready();
        await seneca.entity('foo/s1').save$({ s0_id: 'root1' });
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'foo/s0',
            rootEntityId: 'root1',
            taskMsg: 'aim:task,run:test',
        });
        (0, code_1.expect)(createRes.ok).equal(true);
        (0, code_1.expect)(createRes.tasksCreated).equal(2); // root + child
        (0, code_1.expect)(createRes.tasksFailed).equal(0);
        await seneca.post('sys:traverse,on:run,do:start', {
            runId: createRes.run.id,
        });
        await (0, utils_1.sleep)(50);
        const run = await seneca.entity('sys/traverse').load$(createRes.run.id);
        (0, code_1.expect)(run.status).equal('completed');
    });
    (0, node_test_1.test)('stop-halts-the-run', async () => {
        // A stop mid-run halts dispatch: not every task runs and the run ends
        // 'stopped', not 'completed'.
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
            await (0, utils_1.sleep)(5);
            await this.post('sys:traverse,on:task,do:complete', {
                taskId: taskEnt.id,
            });
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
        seneca.post('sys:traverse,on:run,do:start', { runId: createRes.run.id });
        await (0, utils_1.sleep)(10);
        await seneca.post('sys:traverse,on:run,do:stop', {
            runId: createRes.run.id,
        });
        await (0, utils_1.sleep)(100);
        const run = await seneca.entity('sys/traverse').load$(createRes.run.id);
        (0, code_1.expect)(run.status).equal('stopped');
        (0, code_1.expect)(dispatched.length).lessThan(4);
    });
    (0, node_test_1.test)('create-run-rolls-back-all-on-partial-failure', async () => {
        // Force one task save to fail; atomic rollback must remove every created
        // task AND the run, returning ok:false with the failure count. A
        // callback-style reply(err) is a caught rejection (Promise.allSettled), not
        // a fatal process abort.
        const seneca = (0, utils_1.makeSeneca)({ quiet: true })
            .use(__1.default, {
            rootExecute: false,
            relations: {
                parental: [
                    ['foo/m0', 'foo/m1'],
                    ['foo/m0', 'foo/m2'],
                ],
            },
        })
            .message('aim:task,rollback:fail', async function () {
            return { ok: true };
        });
        await seneca.ready();
        seneca.add('sys:entity,cmd:save,name:traversetask', function (msg, reply) {
            if (msg.ent && msg.ent.child_canon === 'foo/m2') {
                return reply(new Error('forced-save-failure'));
            }
            return this.prior(msg, reply);
        });
        await seneca.entity('foo/m1').save$({ m0_id: 'root5' });
        await seneca.entity('foo/m2').save$({ m0_id: 'root5' });
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'foo/m0',
            rootEntityId: 'root5',
            taskMsg: 'aim:task,rollback:fail',
        });
        (0, code_1.expect)(createRes.ok).equal(false);
        (0, code_1.expect)(createRes.why).equal('task-create-failed');
        (0, code_1.expect)(createRes.tasksCreated).equal(0);
        (0, code_1.expect)(createRes.tasksFailed).equal(1);
        const runs = await seneca.entity('sys/traverse').list$({});
        (0, code_1.expect)(runs.length).equal(0);
        const leaked = await seneca.entity('sys/traversetask').list$({});
        (0, code_1.expect)(leaked.length).equal(0);
    });
    (0, node_test_1.test)('create-run-no-leaked-tasks-on-success', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [
                    ['foo/a0', 'foo/a1'],
                    ['foo/a0', 'foo/a2'],
                ],
            },
        })
            .message('aim:task,rollback:test', async function (msg) {
            const taskEnt = msg.task;
            await this.post('sys:traverse,on:task,do:complete', {
                taskId: taskEnt.id,
            });
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
        (0, code_1.expect)(createRes.tasksCreated).equal(3); // root + 2 children
        (0, code_1.expect)(createRes.run.total_tasks).equal(3);
        const allTasks = await seneca
            .entity('sys/traversetask')
            .list$({ run_id: createRes.run.id });
        (0, code_1.expect)(allTasks.length).equal(3);
    });
});
//# sourceMappingURL=rollback.test.js.map