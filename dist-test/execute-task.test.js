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
(0, node_test_1.describe)('Traverse: execute task', () => {
    (0, node_test_1.test)('execute-task', async () => {
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
            // console.log('task_id', taskEnt.id)
            taskEnt.status = 'done';
            await taskEnt.save$();
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
        await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId: rootEntityId,
            taskMsg: 'aim:task,print:id',
        });
        const taskList = await seneca.entity('sys/traversetask').list$();
        // console.log('task list ', taskList)
        const res = await seneca.post('sys:traverse,on:task,do:execute', {
            task: taskList[0],
        });
        (0, code_1.expect)(res.ok).equal(true);
        const taskEnt = await seneca
            .entity('sys/traversetask')
            .load$(taskList[0].id);
        (0, code_1.expect)(taskEnt.status).equal('done');
    });
    (0, node_test_1.test)('execute-task-double', async () => {
        let executionCount = 0;
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [['foo/bar0', 'foo/bar1']],
            },
        })
            .message('aim:task,count:test', async function (msg) {
            const taskEnt = msg.task;
            executionCount++;
            taskEnt.status = 'done';
            taskEnt.done_at = Date.now();
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        await seneca.entity('foo/bar1').save$({ bar0_id: rootEntityId });
        const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,count:test',
        });
        const runEnt = createTaskRes.run;
        const tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        const task = tasks[0];
        // Try to execute the same task twice manually
        const exec1 = seneca.post('sys:traverse,on:task,do:execute', { task });
        const exec2 = seneca.post('sys:traverse,on:task,do:execute', { task });
        await Promise.all([exec1, exec2]);
        // TODO: improve async validation
        await (0, utils_1.sleep)(50);
        (0, code_1.expect)(executionCount).equal(1);
        const updatedTask = await seneca.entity('sys/traversetask').load$(task.id);
        (0, code_1.expect)(updatedTask.status).equal('done');
    });
});
//# sourceMappingURL=execute-task.test.js.map