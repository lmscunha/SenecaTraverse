"use strict";
/* Copyright © 2025 Seneca Project Contributors, MIT License. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const code_1 = require("@hapi/code");
const __1 = __importDefault(require(".."));
const support_1 = require("./support");
(0, node_test_1.describe)('Traverse: create run', () => {
    (0, node_test_1.test)('create-run', async () => {
        const seneca = (0, support_1.makeSeneca)()
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
            return;
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
        const res = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId: rootEntityId,
            taskMsg: 'aim:task,print:id',
        });
        (0, code_1.expect)(res.ok).true();
        (0, code_1.expect)(res.tasksCreated).equal(4);
        (0, code_1.expect)(res.tasksFailed).equal(0);
        const runEntRes = await seneca.entity('sys/traverse').list$();
        const runEnt = runEntRes[0];
        (0, code_1.expect)(res.run.id).equal(runEnt.id);
        (0, code_1.expect)(runEnt.root_entity).equal(rootEntity);
        (0, code_1.expect)(runEnt.root_id).equal(rootEntityId);
        (0, code_1.expect)(runEnt.status).equal('created');
        (0, code_1.expect)(runEnt.task_msg).equal('aim:task,print:id');
        (0, code_1.expect)(runEnt.total_tasks).equal(4);
    });
    (0, node_test_1.test)('create-run-empty-children', async () => {
        const seneca = (0, support_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [],
            },
        })
            .message('aim:task,print:id', async function (msg) {
            return;
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        const createRunRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,print:id',
        });
        (0, code_1.expect)(createRunRes.ok).true();
        (0, code_1.expect)(createRunRes.run).to.exist();
        (0, code_1.expect)(createRunRes.run.total_tasks).to.equal(1);
        (0, code_1.expect)(createRunRes.tasksCreated).to.equal(1);
        (0, code_1.expect)(createRunRes.tasksFailed).to.equal(0);
        (0, code_1.expect)(createRunRes.run.status).to.equal('created');
    });
    (0, node_test_1.test)('create-run-empty-children-no-root-execute', async () => {
        const seneca = (0, support_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [],
            },
            rootExecute: false,
        })
            .message('aim:task,print:id', async function (msg) {
            return;
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        const createRunRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,print:id',
        });
        (0, code_1.expect)(createRunRes.ok).true();
        (0, code_1.expect)(createRunRes.run).to.exist();
        (0, code_1.expect)(createRunRes.run.total_tasks).to.equal(0);
        (0, code_1.expect)(createRunRes.tasksCreated).to.equal(0);
        (0, code_1.expect)(createRunRes.tasksFailed).to.equal(0);
        (0, code_1.expect)(createRunRes.run.status).to.equal('created');
    });
    (0, node_test_1.test)('create-run-single-child', async () => {
        const seneca = (0, support_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [['foo/bar0', 'foo/bar1']],
            },
        })
            .message('aim:task,print:id', async function (msg) {
            return;
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const createRunRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,print:id',
        });
        (0, code_1.expect)(createRunRes.ok).true();
        (0, code_1.expect)(createRunRes.tasksCreated).to.equal(2);
        (0, code_1.expect)(createRunRes.tasksFailed).to.equal(0);
        (0, code_1.expect)(createRunRes.run.total_tasks).to.equal(2);
        const tasks = await seneca.entity('sys/traversetask').list$({
            run_id: createRunRes.run.id,
        });
        (0, code_1.expect)(tasks.length).to.equal(2);
        (0, code_1.expect)(tasks[0].status).to.equal('pending');
        (0, code_1.expect)(tasks[0].task_msg).to.equal('aim:task,print:id');
        (0, code_1.expect)(tasks[1].status).to.equal('pending');
        (0, code_1.expect)(tasks[1].task_msg).to.equal('aim:task,print:id');
    });
    (0, node_test_1.test)('create-run-nested-hierarchy', async () => {
        const seneca = (0, support_1.makeSeneca)()
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
            return;
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        // Level 1: Direct children of bar0
        const bar1Ent = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar2Ent = await seneca.entity('foo/bar2').save$({
            bar0_id: rootEntityId,
        });
        const zed0Ent = await seneca.entity('foo/zed0').save$({
            bar0_id: rootEntityId,
        });
        // Level 2: Children of bar1
        const bar4Ent = await seneca.entity('foo/bar4').save$({
            bar1_id: bar1Ent.id,
        });
        const bar5Ent = await seneca.entity('foo/bar5').save$({
            bar1_id: bar1Ent.id,
        });
        // Level 2: Children of bar2
        const bar3Ent = await seneca.entity('foo/bar3').save$({
            bar2_id: bar2Ent.id,
        });
        await seneca.entity('foo/bar9').save$({
            bar2_id: bar2Ent.id,
        });
        // Level 2: Children of zed0
        const zed1Ent = await seneca.entity('foo/zed1').save$({
            zed0_id: zed0Ent.id,
        });
        // Level 3: Children of bar3
        const bar6Ent = await seneca.entity('foo/bar6').save$({
            bar3_id: bar3Ent.id,
        });
        // Level 3: Children of bar4
        const bar7Ent = await seneca.entity('foo/bar7').save$({
            bar4_id: bar4Ent.id,
        });
        // Level 3: Children of bar5
        await seneca.entity('foo/bar8').save$({
            bar5_id: bar5Ent.id,
        });
        // Level 3: Children of zed1
        await seneca.entity('foo/zed2').save$({
            zed1_id: zed1Ent.id,
        });
        // Level 4: Children of bar6
        await seneca.entity('foo/bar10').save$({
            bar6_id: bar6Ent.id,
        });
        // Level 4: Children of bar7
        await seneca.entity('foo/bar11').save$({
            bar7_id: bar7Ent.id,
        });
        const createRunRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity,
            rootEntityId,
            taskMsg: 'aim:task,print:id',
        });
        (0, code_1.expect)(createRunRes.ok).true();
        (0, code_1.expect)(createRunRes.tasksCreated).to.equal(15);
        (0, code_1.expect)(createRunRes.tasksFailed).to.equal(0);
        (0, code_1.expect)(createRunRes.run.total_tasks).to.equal(15);
        const tasks = await seneca.entity('sys/traversetask').list$({
            run_id: createRunRes.run.id,
        });
        (0, code_1.expect)(tasks.length).to.equal(15);
    });
});
//# sourceMappingURL=create-run.test.js.map