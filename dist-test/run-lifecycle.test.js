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
(0, node_test_1.describe)('Traverse: run lifecycle', () => {
    (0, node_test_1.test)('start-run', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar0', 'foo/zed0'],
                    ['foo/bar1', 'foo/bar4'],
                    ['foo/bar1', 'foo/bar5'],
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar2', 'foo/bar9'],
                    ['foo/zed0', 'foo/zed1'],
                    ['foo/bar3', 'foo/bar6'],
                    ['foo/bar4', 'foo/bar7'],
                    ['foo/bar5', 'foo/bar8'],
                    ['foo/zed1', 'foo/zed2'],
                    ['foo/bar6', 'foo/bar10'],
                    ['foo/bar7', 'foo/bar11'],
                ],
            },
        })
            .message('aim:task,print:id', async function (msg) {
            const taskEnt = msg.task;
            // console.log('task id: ', taskEnt.id)
            taskEnt.status = 'done';
            await taskEnt.save$();
            return { ok: true, a: 1 };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        // only level 1 entities actually exist
        await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        await seneca.entity('foo/bar2').save$({
            bar0_id: rootEntityId,
        });
        await seneca.entity('foo/zed0').save$({
            bar0_id: rootEntityId,
        });
        const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId: rootEntityId,
            taskMsg: 'aim:task,print:id',
        });
        const runEnt = createTaskRes.run;
        let tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasks.length).equal(4);
        for (const task of tasks) {
            (0, code_1.expect)(task.status).equal('pending');
        }
        const startRunRes = await seneca.post('sys:traverse,on:run,do:start', {
            runId: runEnt.id,
        });
        (0, code_1.expect)(startRunRes.ok).true();
        // TODO: improve async validation
        await (0, utils_1.sleep)(50);
        tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasks.length).equal(4);
        for (const task of tasks) {
            (0, code_1.expect)(task.status).equal('done');
        }
    });
    (0, node_test_1.test)('start-run-with-client-sleep', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar0', 'foo/zed0'],
                    ['foo/bar1', 'foo/bar4'],
                    ['foo/bar1', 'foo/bar5'],
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar2', 'foo/bar9'],
                    ['foo/zed0', 'foo/zed1'],
                    ['foo/bar3', 'foo/bar6'],
                    ['foo/bar4', 'foo/bar7'],
                    ['foo/bar5', 'foo/bar8'],
                    ['foo/zed1', 'foo/zed2'],
                    ['foo/bar6', 'foo/bar10'],
                    ['foo/bar7', 'foo/bar11'],
                ],
            },
        })
            .message('aim:task,print:id', async function (msg) {
            const taskEnt = msg.task;
            // Simulate some async work to increase chance of race conditions
            await (0, utils_1.sleep)(Math.random() * 10);
            // Mark task as done
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        // Create entities at level 1
        const bar1_ent = await seneca
            .entity('foo/bar1')
            .save$({ bar0_id: rootEntityId });
        const bar2_ent = await seneca
            .entity('foo/bar2')
            .save$({ bar0_id: rootEntityId });
        const zed0_ent = await seneca
            .entity('foo/zed0')
            .save$({ bar0_id: rootEntityId });
        // Create entities at level 2
        await seneca.entity('foo/bar4').save$({ bar1_id: bar1_ent.id });
        await seneca.entity('foo/bar5').save$({ bar1_id: bar1_ent.id });
        await seneca.entity('foo/bar3').save$({ bar2_id: bar2_ent.id });
        await seneca.entity('foo/bar9').save$({ bar2_id: bar2_ent.id });
        await seneca.entity('foo/zed1').save$({ zed0_id: zed0_ent.id });
        const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId: rootEntityId,
            taskMsg: 'aim:task,print:id',
        });
        const runEnt = createTaskRes.run;
        let tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasks.length).equal(9);
        for (const task of tasks) {
            (0, code_1.expect)(task.status).equal('pending');
        }
        const startRunRes = await seneca.post('sys:traverse,on:run,do:start', {
            runId: runEnt.id,
        });
        (0, code_1.expect)(startRunRes.ok).equal(true);
        // Wait for all tasks to complete
        // TODO: improve async validation
        await (0, utils_1.sleep)(200);
        tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasks.length).equal(9);
        for (const task of tasks) {
            (0, code_1.expect)(task.status).equal('done');
        }
        for (let i = 1; i < tasks.length; i++) {
            const prevTask = tasks[i - 1];
            const currentTask = tasks[i];
            const isSequential = currentTask.done_at >= prevTask.done_at;
            (0, code_1.expect)(isSequential).equal(true);
        }
        const timestamps = tasks.map((t) => t.done_at);
        const uniqueTimestamps = new Set(timestamps);
        (0, code_1.expect)(uniqueTimestamps.size).equal(timestamps.length);
        const run = await seneca.entity('sys/traverse').load$(runEnt.id);
        (0, code_1.expect)(run.status).equal('completed');
    });
    (0, node_test_1.test)('start-run-no-children', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default)
            .message('aim:task,empty:test', async function (msg) {
            const taskEnt = msg.task;
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        // Don't create any child entities
        const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,empty:test',
        });
        const runEnt = createTaskRes.run;
        let tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasks.length).equal(1); // Only root task
        (0, code_1.expect)(runEnt.total_tasks).equal(1);
        await seneca.post('sys:traverse,on:run,do:start', {
            runId: runEnt.id,
        });
        // TODO: improve async validation
        await (0, utils_1.sleep)(50);
        tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasks[0].status).equal('done');
        const run = await seneca.entity('sys/traverse').load$(runEnt.id);
        (0, code_1.expect)(run.status).equal('completed');
    });
    (0, node_test_1.test)('star-run-deep', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [
                    ['foo/l0', 'foo/l1'],
                    ['foo/l1', 'foo/l2'],
                    ['foo/l2', 'foo/l3'],
                    ['foo/l3', 'foo/l4'],
                    ['foo/l4', 'foo/l5'],
                ],
            },
        })
            .message('aim:task,deep:test', async function (msg) {
            const taskEnt = msg.task;
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/l0';
        // Create a deep chain
        const l1 = await seneca.entity('foo/l1').save$({ l0_id: rootEntityId });
        const l2 = await seneca.entity('foo/l2').save$({ l1_id: l1.id });
        const l3 = await seneca.entity('foo/l3').save$({ l2_id: l2.id });
        const l4 = await seneca.entity('foo/l4').save$({ l3_id: l3.id });
        await seneca.entity('foo/l5').save$({ l4_id: l4.id });
        const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,deep:test',
        });
        const runEnt = createTaskRes.run;
        let tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasks.length).equal(6); // l0 + l1 + l2 + l3 + l4 + l5
        await seneca.post('sys:traverse,on:run,do:start', {
            runId: runEnt.id,
        });
        // TODO: improve async validation
        await (0, utils_1.sleep)(150);
        tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        // Verify all done
        for (const task of tasks) {
            (0, code_1.expect)(task.status).equal('done');
        }
        // Verify strict sequential order
        for (let i = 1; i < tasks.length; i++) {
            const isSequential = tasks[i].done_at > tasks[i - 1].done_at;
            (0, code_1.expect)(isSequential).equal(true);
        }
        const run = await seneca.entity('sys/traverse').load$(runEnt.id);
        (0, code_1.expect)(run.status).equal('completed');
    });
    (0, node_test_1.test)('stop-run', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar0', 'foo/zed0'],
                ],
            },
        })
            .message('aim:task,print:id', async function (msg) {
            const taskEnt = msg.task;
            // console.log('task id: ', taskEnt.id)
            taskEnt.status = 'done';
            await taskEnt.save$();
            return { ok: true, a: 1 };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        // only level 1 entities actually exist
        await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        await seneca.entity('foo/bar2').save$({
            bar0_id: rootEntityId,
        });
        await seneca.entity('foo/zed0').save$({
            bar0_id: rootEntityId,
        });
        const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId: rootEntityId,
            taskMsg: 'aim:task,print:id',
        });
        const runEnt = createTaskRes.run;
        await seneca.post('sys:traverse,on:run,do:start', {
            runId: runEnt.id,
        });
        const stopRunRes = await seneca.post('sys:traverse,on:run,do:stop', {
            runId: runEnt.id,
        });
        (0, code_1.expect)(stopRunRes.ok).true();
        (0, code_1.expect)(stopRunRes.run.status).equal('stopped');
    });
    (0, node_test_1.test)('stop-run-block-completion', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [
                    ['foo/l0', 'foo/l1'],
                    ['foo/l1', 'foo/l2'],
                    ['foo/l2', 'foo/l3'],
                    ['foo/l3', 'foo/l4'],
                    ['foo/l4', 'foo/l5'],
                ],
            },
        })
            .message('aim:task,deep:test', async function (msg) {
            const taskEnt = msg.task;
            await (0, utils_1.sleep)(Math.random() * 15);
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/l0';
        const l1 = await seneca.entity('foo/l1').save$({ l0_id: rootEntityId });
        const l2 = await seneca.entity('foo/l2').save$({ l1_id: l1.id });
        const l3 = await seneca.entity('foo/l3').save$({ l2_id: l2.id });
        const l4 = await seneca.entity('foo/l4').save$({ l3_id: l3.id });
        await seneca.entity('foo/l5').save$({ l4_id: l4.id });
        const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,deep:test',
        });
        const runEnt = createTaskRes.run;
        await seneca.post('sys:traverse,on:run,do:start', {
            runId: runEnt.id,
        });
        await seneca.post('sys:traverse,on:run,do:stop', {
            runId: runEnt.id,
        });
        const tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        const lastTask = tasks[tasks.length - 1];
        (0, code_1.expect)(lastTask.status).equal('pending');
        const run = await seneca.entity('sys/traverse').load$(runEnt.id);
        (0, code_1.expect)(run.status).equal('stopped');
    });
    (0, node_test_1.test)('restart-run', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar0', 'foo/zed0'],
                ],
            },
        })
            .message('aim:task,deep:test', async function (msg) {
            const taskEnt = msg.task;
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,deep:test',
        });
        const runEnt = createTaskRes.run;
        const tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        const flipTaskState = (state) => state === 'done' ? 'failed' : 'done';
        tasks.forEach(async (task) => {
            // save incomplete state
            const state = flipTaskState('done');
            task.status = state;
            await task.save$();
        });
        // run the same process again to complete all tasks
        await seneca.post('sys:traverse,on:run,do:start', {
            runId: runEnt.id,
        });
        // TODO: improve async validation
        await (0, utils_1.sleep)(100);
        const tasksRestart = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        // Verify all done
        tasksRestart.forEach((task) => {
            (0, code_1.expect)(task.status).equal('done');
        });
        const run = await seneca.entity('sys/traverse').load$(runEnt.id);
        (0, code_1.expect)(run.status).equal('completed');
    });
    (0, node_test_1.test)('async-mode-returns-before-tasks-complete', async () => {
        let executionCount = 0;
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            mode: 'async',
            relations: {
                parental: [
                    ['foo/a0', 'foo/a1'],
                    ['foo/a0', 'foo/a2'],
                ],
            },
        })
            .message('aim:task,async:test', async function (msg) {
            await (0, utils_1.sleep)(50);
            executionCount++;
            // Host signals completion once the task's work is done.
            await this.post('sys:traverse,on:task,do:complete', {
                taskId: msg.task.id,
            });
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/a0';
        await seneca.entity('foo/a1').save$({ a0_id: rootEntityId });
        await seneca.entity('foo/a2').save$({ a0_id: rootEntityId });
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,async:test',
        });
        const runEnt = createRes.run;
        const startedAt = Date.now();
        const startRes = await seneca.post('sys:traverse,on:run,do:start', {
            runId: runEnt.id,
        });
        const elapsed = Date.now() - startedAt;
        (0, code_1.expect)(startRes.ok).equal(true);
        // returned before the 50 ms task delay — not awaiting tasks
        (0, code_1.expect)(elapsed).lessThan(40);
        (0, code_1.expect)(executionCount).equal(0);
        // wait for tasks to complete in background
        await (0, utils_1.sleep)(200);
        (0, code_1.expect)(executionCount).equal(3); // root + 2 children
        // completion barrier: run finishes once every task reports done
        const finalRun = await seneca.entity('sys/traverse').load$(runEnt.id);
        (0, code_1.expect)(finalRun.status).equal('completed');
        (0, code_1.expect)(finalRun.completed_at).exist();
    });
    (0, node_test_1.test)('async-mode-completes-only-after-all-tasks-done', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            mode: 'async',
            relations: {
                parental: [['foo/c0', 'foo/c1']],
            },
        })
            .message('aim:task,barrier:test', async function () {
            // Host drives completion explicitly, task-by-task.
            return { ok: true };
        });
        await seneca.ready();
        // Override dispatch so it does NOT auto-complete: the host (this test)
        // signals each task's completion by hand, exercising the barrier gate.
        seneca.message('sys:traverse,do:dispatch,on:task', async function (msg) {
            await this.post(msg.task.task_msg, { task: msg.task });
            return { ok: true };
        });
        const rootEntityId = '123';
        const rootEntity = 'foo/c0';
        await seneca.entity('foo/c1').save$({ c0_id: rootEntityId });
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,barrier:test',
        });
        const runId = createRes.run.id;
        await seneca.post('sys:traverse,on:run,do:start', { runId });
        const tasks = await seneca
            .entity('sys/traversetask')
            .list$({ run_id: runId });
        (0, code_1.expect)(tasks.length).equal(2); // root + 1 child
        // Complete the first task — run must stay active.
        const firstRes = await seneca.post('sys:traverse,on:task,do:complete', {
            taskId: tasks[0].id,
        });
        (0, code_1.expect)(firstRes.ok).equal(true);
        const afterFirst = await seneca.entity('sys/traverse').load$(runId);
        (0, code_1.expect)(afterFirst.status).equal('active');
        // Complete the last task — run advances to completed.
        await seneca.post('sys:traverse,on:task,do:complete', {
            taskId: tasks[1].id,
        });
        const afterLast = await seneca.entity('sys/traverse').load$(runId);
        (0, code_1.expect)(afterLast.status).equal('completed');
    });
    (0, node_test_1.test)('async-mode-empty-run-completes-immediately', async () => {
        const seneca = (0, utils_1.makeSeneca)().use(__1.default, {
            mode: 'async',
            rootExecute: false,
            relations: { parental: [] },
        });
        await seneca.ready();
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'foo/d0',
            rootEntityId: '123',
            taskMsg: 'aim:task,noop:test',
        });
        (0, code_1.expect)(createRes.run.total_tasks).equal(0);
        const startRes = await seneca.post('sys:traverse,on:run,do:start', {
            runId: createRes.run.id,
        });
        (0, code_1.expect)(startRes.run.status).equal('completed');
    });
    // Reverse-BFS guarantee: a parent is never executed before its children. This
    // is what keeps a destructive task (e.g. delete) from stranding a dangling
    // reference — children are scrubbed before the parent that points at them.
    (0, node_test_1.test)('async-mode-executes-children-before-parents', async () => {
        const executed = [];
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            mode: 'async',
            relations: {
                parental: [
                    ['foo/e0', 'foo/e1'],
                    ['foo/e1', 'foo/e2'],
                ],
            },
        })
            .message('aim:task,order:test', async function (msg) {
            const task = msg.task;
            // Every deeper task must already be done when this one runs.
            const deeper = await this.entity('sys/traversetask').list$({
                run_id: task.run_id,
            });
            const violation = deeper.find((t) => t.seq > task.seq && t.status !== 'done');
            (0, code_1.expect)(violation).equal(undefined);
            executed.push(task.child_canon);
            await (0, utils_1.sleep)(Math.random() * 10);
            await this.post('sys:traverse,on:task,do:complete', {
                taskId: task.id,
            });
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/e0';
        const e1 = await seneca.entity('foo/e1').save$({ e0_id: rootEntityId });
        await seneca.entity('foo/e2').save$({ e1_id: e1.id });
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,order:test',
        });
        await seneca.post('sys:traverse,on:run,do:start', {
            runId: createRes.run.id,
        });
        await (0, utils_1.sleep)(150);
        // Deepest-first: e2 (seq 2) then e1 (seq 1) then the root e0 (seq 0).
        (0, code_1.expect)(executed).equal(['foo/e2', 'foo/e1', 'foo/e0']);
        const run = await seneca.entity('sys/traverse').load$(createRes.run.id);
        (0, code_1.expect)(run.status).equal('completed');
    });
    (0, node_test_1.test)('async-mode-complete-unknown-task', async () => {
        const seneca = (0, utils_1.makeSeneca)().use(__1.default, { mode: 'async' });
        await seneca.ready();
        // Idempotent: a completion for a missing task is a no-op ok — an
        // at-least-once transport may redeliver after cleanup, and that must not
        // become a poison message.
        const res = await seneca.post('sys:traverse,on:task,do:complete', {
            taskId: 'does-not-exist',
        });
        (0, code_1.expect)(res.ok).equal(true);
    });
    (0, node_test_1.test)('async-mode-dispatch-pin-override', async () => {
        const dispatched = [];
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            mode: 'async',
            relations: {
                parental: [['foo/b0', 'foo/b1']],
            },
        })
            .message('aim:task,dispatch:test', async function () {
            return { ok: true };
        });
        await seneca.ready();
        // Override must register after ready() — Seneca loads plugins asynchronously,
        // so the plugin's handler is registered during ready(). A pre-ready .message()
        // call would be overwritten by the plugin. Hosts override the same way.
        // Signal completion so the level walk advances to the next (shallower) level.
        seneca.message('sys:traverse,do:dispatch,on:task', async function (msg) {
            dispatched.push(msg.task.child_canon);
            await this.post('sys:traverse,on:task,do:complete', {
                taskId: msg.task.id,
            });
            return { ok: true };
        });
        const rootEntityId = '123';
        const rootEntity = 'foo/b0';
        await seneca.entity('foo/b1').save$({ b0_id: rootEntityId });
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,dispatch:test',
        });
        await seneca.post('sys:traverse,on:run,do:start', {
            runId: createRes.run.id,
        });
        await (0, utils_1.sleep)(50);
        // Override intercepts every dispatch; default transport never called.
        // Reverse-BFS: the child (seq 1) dispatches before the root (seq 0).
        (0, code_1.expect)(dispatched).equal(['foo/b1', 'foo/b0']);
    });
    (0, node_test_1.test)('restart-run-previously-stopped', async () => {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [
                    ['foo/l0', 'foo/l1'],
                    ['foo/l1', 'foo/l2'],
                ],
            },
        })
            .message('aim:task,done:test', async function (msg) {
            const taskEnt = msg.task;
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/l0';
        const l1 = await seneca.entity('foo/l1').save$({ l0_id: rootEntityId });
        await seneca.entity('foo/l2').save$({ l1_id: l1.id });
        const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,done:test',
        });
        const runEnt = createTaskRes.run;
        await seneca.post('sys:traverse,on:run,do:start', {
            runId: runEnt.id,
        });
        const tasksRunStart = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasksRunStart.length).equal(3);
        await seneca.post('sys:traverse,on:run,do:stop', {
            runId: runEnt.id,
        });
        const tasksRunStop = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        const lastTask = tasksRunStop[tasksRunStop.length - 1];
        (0, code_1.expect)(lastTask.status).equal('pending');
        const runStopRes = await seneca.entity('sys/traverse').load$(runEnt.id);
        (0, code_1.expect)(runStopRes.status).equal('stopped');
        // run the same process again
        await seneca.post('sys:traverse,on:run,do:start', {
            runId: runEnt.id,
        });
        // TODO: improve async validation
        await (0, utils_1.sleep)(100);
        const tasksRestart = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        // number of tasks shouldn't change
        (0, code_1.expect)(tasksRestart.length).equal(tasksRunStart.length);
        // Verify all done
        tasksRestart.forEach((task, idx) => {
            (0, code_1.expect)(task.status).equal('done');
            // verity no new task was created
            (0, code_1.expect)(task.id).equal(tasksRunStart[idx].id);
        });
        // Verify strict sequential order
        for (let i = 1; i < tasksRestart.length; i++) {
            const isSequential = tasksRestart[i].done_at > tasksRestart[i - 1].done_at;
            (0, code_1.expect)(isSequential).equal(true);
        }
        const run = await seneca.entity('sys/traverse').load$(runEnt.id);
        (0, code_1.expect)(run.status).equal('completed');
    });
});
//# sourceMappingURL=run-lifecycle.test.js.map