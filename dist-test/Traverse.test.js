"use strict";
/* Copyright © 2025 Seneca Project Contributors, MIT License. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const code_1 = require("@hapi/code");
const seneca_1 = __importDefault(require("seneca"));
// import SenecaMsgTest from 'seneca-msg-test'
// import { Maintain } from '@seneca/maintain'
const __1 = __importDefault(require(".."));
const __2 = __importDefault(require(".."));
(0, node_test_1.describe)('Traverse', () => {
    (0, node_test_1.test)('load-plugin', async () => {
        (0, code_1.expect)(__1.default).exist();
        const seneca = (0, seneca_1.default)({ legacy: false })
            .test()
            .use('promisify')
            .use('entity')
            .use(__2.default);
        await seneca.ready();
        (0, code_1.expect)(seneca.find_plugin('Traverse')).exist();
    });
    (0, node_test_1.test)('find-deps', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar4'],
                    ['foo/bar1', 'foo/bar5'],
                    ['foo/bar3', 'foo/bar6'],
                    ['foo/bar4', 'foo/bar7'],
                    ['foo/bar5', 'foo/bar8'],
                    ['foo/bar0', 'foo/zed0'],
                    ['foo/zed0', 'foo/zed1'],
                    ['foo/zed1', 'foo/zed2'],
                    ['bar/baz0', 'bar/baz1'],
                    ['qux/test', 'qux/prod'],
                    ['foo/bar2', 'foo/bar9'],
                    ['foo/bar6', 'foo/bar10'],
                    ['foo/bar7', 'foo/bar11'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        // console.log('RES', res)
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar0', 'foo/bar2'],
            ['foo/bar0', 'foo/zed0'],
            // Level 1
            ['foo/bar1', 'foo/bar4'],
            ['foo/bar1', 'foo/bar5'],
            ['foo/bar2', 'foo/bar3'],
            ['foo/bar2', 'foo/bar9'],
            ['foo/zed0', 'foo/zed1'],
            // Level 2
            // Sort each level alphabetically.
            // Thus, foo/bar3 should be listed first,
            // although its parent is foo/bar2
            ['foo/bar3', 'foo/bar6'],
            ['foo/bar4', 'foo/bar7'],
            ['foo/bar5', 'foo/bar8'],
            ['foo/zed1', 'foo/zed2'],
            // Level 3
            ['foo/bar6', 'foo/bar10'],
            ['foo/bar7', 'foo/bar11'],
        ]);
    });
    (0, node_test_1.test)('find-deps-empty-list', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        // console.log('RES', res)
        (0, code_1.expect)(res.deps).equal([]);
    });
    (0, node_test_1.test)('find-deps-no-children', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar1', 'foo/bar2'],
                    ['foo/bar2', 'foo/bar3'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        // console.log('RES', res)
        (0, code_1.expect)(res.deps).equal([]);
    });
    (0, node_test_1.test)('find-deps-cycle', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar1', 'foo/bar2'],
                    // Cycle back to root
                    ['foo/bar2', 'foo/bar0'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        // console.log('RES', res)
        // Should only traverse once, ignoring the cycle
        (0, code_1.expect)(res.deps).equal([
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar1', 'foo/bar2'],
        ]);
    });
    (0, node_test_1.test)('find-deps-cycle-middle', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar1', 'foo/bar2'],
                    ['foo/bar2', 'foo/bar3'],
                    // Cycle bar1 -> bar2 -> bar3 -> bar1
                    ['foo/bar3', 'foo/bar1'],
                    ['foo/bar2', 'foo/bar4'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        // Each node visited only once despite cycle
        (0, code_1.expect)(res.deps).equal([
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar1', 'foo/bar2'],
            ['foo/bar2', 'foo/bar3'],
            ['foo/bar2', 'foo/bar4'],
        ]);
    });
    (0, node_test_1.test)('find-deps-linear', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar1', 'foo/bar2'],
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar3', 'foo/bar4'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        // console.log('RES', res)
        (0, code_1.expect)(res.deps).equal([
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar1', 'foo/bar2'],
            ['foo/bar2', 'foo/bar3'],
            ['foo/bar3', 'foo/bar4'],
        ]);
    });
    (0, node_test_1.test)('find-deps-duplicate', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    // Duplicate
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar1', 'foo/bar2'],
                    // Duplicate
                    ['foo/bar1', 'foo/bar2'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        (0, code_1.expect)(res.deps).equal([
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar1', 'foo/bar2'],
        ]);
    });
    (0, node_test_1.test)('find-deps-convergent', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar3'],
                    // bar3 reachable from two paths
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar3', 'foo/bar4'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        // console.log('RES', res)
        // bar3 should only appear once (first path wins)
        (0, code_1.expect)(res.deps).equal([
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar0', 'foo/bar2'],
            ['foo/bar1', 'foo/bar3'],
            ['foo/bar3', 'foo/bar4'],
        ]);
    });
    (0, node_test_1.test)('find-deps-two-convergent', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar0', 'foo/bar3'],
                    ['foo/bar1', 'foo/bar4'],
                    // bar4 from two parents
                    ['foo/bar2', 'foo/bar4'],
                    ['foo/bar3', 'foo/bar5'],
                    ['foo/bar4', 'foo/bar6'],
                    // bar6 from two parents at different levels
                    ['foo/bar5', 'foo/bar6'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        (0, code_1.expect)(res.deps).equal([
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar0', 'foo/bar2'],
            ['foo/bar0', 'foo/bar3'],
            ['foo/bar1', 'foo/bar4'],
            ['foo/bar3', 'foo/bar5'],
            ['foo/bar4', 'foo/bar6'],
        ]);
    });
    (0, node_test_1.test)('find-deps-self-ref', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    // Self loop
                    ['foo/bar1', 'foo/bar1'],
                    ['foo/bar1', 'foo/bar2'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        // console.log('RES', res)
        (0, code_1.expect)(res.deps).equal([
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar1', 'foo/bar2'],
        ]);
    });
    (0, node_test_1.test)('find-deps-all-default', async () => {
        const seneca = makeSeneca().use(__2.default);
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps');
        // console.log('RES', res)
        (0, code_1.expect)(res.deps).equal([]);
    });
    (0, node_test_1.test)('find-deps-empty-list', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
        });
        // console.log('RES', res)
        (0, code_1.expect)(res.deps).equal([]);
    });
    (0, node_test_1.test)('find-deps-l1', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar4'],
                    ['foo/bar1', 'foo/bar5'],
                    ['foo/bar3', 'foo/bar6'],
                    ['foo/bar4', 'foo/bar7'],
                    ['foo/bar5', 'foo/bar8'],
                    ['foo/bar0', 'foo/zed0'],
                    ['foo/zed0', 'foo/zed1'],
                    ['foo/zed1', 'foo/zed2'],
                    ['bar/baz0', 'bar/baz1'],
                    ['qux/test', 'qux/prod'],
                    ['foo/bar2', 'foo/bar9'],
                    ['foo/bar6', 'foo/bar10'],
                    ['foo/bar7', 'foo/bar11'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar1',
        });
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['foo/bar1', 'foo/bar4'],
            ['foo/bar1', 'foo/bar5'],
            // Level 1
            ['foo/bar4', 'foo/bar7'],
            ['foo/bar5', 'foo/bar8'],
            // Level 2
            ['foo/bar7', 'foo/bar11'],
        ]);
    });
    (0, node_test_1.test)('find-deps-l1-convergent', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar4'],
                    ['foo/bar1', 'foo/bar5'],
                    ['foo/bar3', 'foo/bar6'],
                    ['foo/bar4', 'foo/bar7'],
                    ['foo/bar5', 'foo/bar8'],
                    ['foo/bar0', 'foo/zed0'],
                    ['foo/zed0', 'foo/zed1'],
                    ['foo/zed1', 'foo/zed2'],
                    ['bar/baz0', 'bar/baz1'],
                    ['qux/test', 'qux/prod'],
                    ['foo/bar2', 'foo/bar9'],
                    ['foo/bar6', 'foo/bar10'],
                    ['foo/bar7', 'foo/bar11'],
                    ['foo/bar4', 'foo/bar12'],
                    // bar12 converges from bar4 and bar5
                    ['foo/bar5', 'foo/bar12'],
                    ['foo/bar12', 'foo/bar13'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar1',
        });
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['foo/bar1', 'foo/bar4'],
            ['foo/bar1', 'foo/bar5'],
            // Level 1
            ['foo/bar4', 'foo/bar7'],
            ['foo/bar4', 'foo/bar12'],
            ['foo/bar5', 'foo/bar8'],
            // Level 2
            ['foo/bar7', 'foo/bar11'],
            ['foo/bar12', 'foo/bar13'],
        ]);
    });
    (0, node_test_1.test)('find-deps-l1-cycle', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar4'],
                    ['foo/bar1', 'foo/bar5'],
                    ['foo/bar3', 'foo/bar6'],
                    ['foo/bar4', 'foo/bar7'],
                    ['foo/bar5', 'foo/bar8'],
                    ['foo/bar0', 'foo/zed0'],
                    ['foo/zed0', 'foo/zed1'],
                    ['foo/zed1', 'foo/zed2'],
                    ['bar/baz0', 'bar/baz1'],
                    ['qux/test', 'qux/prod'],
                    ['foo/bar2', 'foo/bar9'],
                    ['foo/bar6', 'foo/bar10'],
                    ['foo/bar7', 'foo/bar11'],
                    // Cycle: bar1 -> bar4 -> bar7 -> bar1
                    ['foo/bar7', 'foo/bar1'],
                    ['foo/bar8', 'foo/bar12'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar1',
        });
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['foo/bar1', 'foo/bar4'],
            ['foo/bar1', 'foo/bar5'],
            // Level 1
            ['foo/bar4', 'foo/bar7'],
            ['foo/bar5', 'foo/bar8'],
            // Level 2
            ['foo/bar7', 'foo/bar11'],
            ['foo/bar8', 'foo/bar12'],
        ]);
    });
    (0, node_test_1.test)('find-deps-l2', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar4'],
                    ['foo/bar1', 'foo/bar5'],
                    ['foo/bar3', 'foo/bar6'],
                    ['foo/bar4', 'foo/bar7'],
                    ['foo/bar5', 'foo/bar8'],
                    ['foo/bar0', 'foo/zed0'],
                    ['foo/zed0', 'foo/zed1'],
                    ['foo/zed1', 'foo/zed2'],
                    ['bar/baz0', 'bar/baz1'],
                    ['qux/test', 'qux/prod'],
                    ['foo/bar2', 'foo/bar9'],
                    ['foo/bar6', 'foo/bar10'],
                    ['foo/bar7', 'foo/bar11'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar3',
        });
        // console.log('RES', res)
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['foo/bar3', 'foo/bar6'],
            // Level 1
            ['foo/bar6', 'foo/bar10'],
        ]);
    });
    (0, node_test_1.test)('find-deps-l2-convergent', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar4'],
                    ['foo/bar1', 'foo/bar5'],
                    ['foo/bar3', 'foo/bar6'],
                    ['foo/bar4', 'foo/bar7'],
                    ['foo/bar5', 'foo/bar8'],
                    ['foo/bar0', 'foo/zed0'],
                    ['foo/zed0', 'foo/zed1'],
                    ['foo/zed1', 'foo/zed2'],
                    ['bar/baz0', 'bar/baz1'],
                    ['qux/test', 'qux/prod'],
                    ['foo/bar2', 'foo/bar9'],
                    ['foo/bar6', 'foo/bar10'],
                    ['foo/bar7', 'foo/bar11'],
                    ['foo/bar3', 'foo/bar12'],
                    ['foo/bar6', 'foo/bar13'],
                    ['foo/bar10', 'foo/bar14'],
                    // bar14 converges from bar10 and bar12
                    ['foo/bar12', 'foo/bar14'],
                    ['foo/bar14', 'foo/bar15'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar3',
        });
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['foo/bar3', 'foo/bar6'],
            ['foo/bar3', 'foo/bar12'],
            // Level 1
            ['foo/bar6', 'foo/bar10'],
            ['foo/bar6', 'foo/bar13'],
            ['foo/bar12', 'foo/bar14'],
            // Level 2
            ['foo/bar14', 'foo/bar15'],
        ]);
    });
    (0, node_test_1.test)('find-deps-l2-cycle', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar4'],
                    ['foo/bar1', 'foo/bar5'],
                    ['foo/bar3', 'foo/bar6'],
                    ['foo/bar4', 'foo/bar7'],
                    ['foo/bar5', 'foo/bar8'],
                    ['foo/bar0', 'foo/zed0'],
                    ['foo/zed0', 'foo/zed1'],
                    ['foo/zed1', 'foo/zed2'],
                    ['bar/baz0', 'bar/baz1'],
                    ['qux/test', 'qux/prod'],
                    ['foo/bar2', 'foo/bar9'],
                    ['foo/bar6', 'foo/bar10'],
                    ['foo/bar7', 'foo/bar11'],
                    ['foo/bar10', 'foo/bar12'],
                    // Cycle: bar3 -> bar6 -> bar10 -> bar12 -> bar3
                    ['foo/bar12', 'foo/bar3'],
                    ['foo/bar10', 'foo/bar13'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar3',
        });
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['foo/bar3', 'foo/bar6'],
            // Level 1
            ['foo/bar6', 'foo/bar10'],
            // Level 2
            ['foo/bar10', 'foo/bar12'],
            ['foo/bar10', 'foo/bar13'],
        ]);
    });
    (0, node_test_1.test)('find-deps-l2-multi-level-convergent', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar4'],
                    ['foo/bar1', 'foo/bar5'],
                    ['foo/bar3', 'foo/bar6'],
                    ['foo/bar4', 'foo/bar7'],
                    ['foo/bar5', 'foo/bar8'],
                    ['foo/bar0', 'foo/zed0'],
                    ['foo/zed0', 'foo/zed1'],
                    ['foo/zed1', 'foo/zed2'],
                    ['bar/baz0', 'bar/baz1'],
                    ['qux/test', 'qux/prod'],
                    ['foo/bar2', 'foo/bar9'],
                    ['foo/bar6', 'foo/bar10'],
                    ['foo/bar7', 'foo/bar11'],
                    ['foo/bar3', 'foo/bar12'],
                    ['foo/bar3', 'foo/bar13'],
                    ['foo/bar12', 'foo/bar14'],
                    // Second path to bar14
                    ['foo/bar13', 'foo/bar14'],
                    // Third path to bar14
                    ['foo/bar6', 'foo/bar14'],
                    ['foo/bar14', 'foo/bar15'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar3',
        });
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['foo/bar3', 'foo/bar6'],
            ['foo/bar3', 'foo/bar12'],
            ['foo/bar3', 'foo/bar13'],
            // Level 1
            ['foo/bar6', 'foo/bar10'],
            ['foo/bar12', 'foo/bar14'],
            // Level 2
            ['foo/bar14', 'foo/bar15'],
        ]);
    });
    (0, node_test_1.test)('find-deps-single-cycle', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['A', 'B'],
                    ['A', 'C'],
                    ['C', 'E'],
                    ['C', 'D'],
                    ['E', 'G'],
                    ['E', 'F'],
                    ['F', 'H'],
                    ['C', 'A'],
                    ['N', 'M'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'C',
        });
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['C', 'A'],
            ['C', 'D'],
            ['C', 'E'],
            // Level 1
            ['A', 'B'],
            ['E', 'F'],
            ['E', 'G'],
            // Level 2
            ['F', 'H'],
        ]);
    });
    (0, node_test_1.test)('find-deps-single-missing-node', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['A', 'B'],
                    ['B', 'C'],
                    ['D', 'E'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'X',
        });
        // X has no children
        (0, code_1.expect)(res.deps).equal([]);
    });
    (0, node_test_1.test)('find-deps-deep-linear-chain', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['node0', 'node1'],
                    ['node1', 'node2'],
                    ['node2', 'node3'],
                    ['node3', 'node4'],
                    ['node4', 'node5'],
                    ['node5', 'node6'],
                    ['node6', 'node7'],
                    ['node7', 'node8'],
                    ['node8', 'node9'],
                    ['node9', 'node10'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'node0',
        });
        (0, code_1.expect)(res.deps).equal([
            ['node0', 'node1'],
            ['node1', 'node2'],
            ['node2', 'node3'],
            ['node3', 'node4'],
            ['node4', 'node5'],
            ['node5', 'node6'],
            ['node6', 'node7'],
            ['node7', 'node8'],
            ['node8', 'node9'],
            ['node9', 'node10'],
        ]);
    });
    (0, node_test_1.test)('find-deps-binary-tree', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['A', 'B'],
                    ['A', 'C'],
                    ['B', 'D'],
                    ['B', 'E'],
                    ['C', 'F'],
                    ['C', 'G'],
                    ['D', 'H'],
                    ['D', 'I'],
                    ['E', 'J'],
                    ['E', 'K'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'A',
        });
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['A', 'B'],
            ['A', 'C'],
            // Level 1
            ['B', 'D'],
            ['B', 'E'],
            ['C', 'F'],
            ['C', 'G'],
            // Level 2
            ['D', 'H'],
            ['D', 'I'],
            ['E', 'J'],
            ['E', 'K'],
        ]);
    });
    (0, node_test_1.test)('find-deps-diamond-pattern', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['A', 'B'],
                    ['A', 'C'],
                    ['B', 'D'],
                    ['C', 'D'],
                    ['D', 'E'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'A',
        });
        // D is reached first from B (alphabetically first)
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['A', 'B'],
            ['A', 'C'],
            // Level 1 - D reached via B
            ['B', 'D'],
            // Level 2
            ['D', 'E'],
        ]);
    });
    (0, node_test_1.test)('find-deps-mixed-alph-sort', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['root', 'node10'],
                    ['root', 'node2'],
                    ['root', 'node1'],
                    ['root', 'node20'],
                    ['node1', 'child2'],
                    ['node2', 'child1'],
                    ['node10', 'child10'],
                    ['node20', 'child20'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'root',
        });
        // Natural sorting: node1, node2, node10, node20
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['root', 'node1'],
            ['root', 'node2'],
            ['root', 'node10'],
            ['root', 'node20'],
            // Level 1
            ['node1', 'child2'],
            ['node2', 'child1'],
            ['node10', 'child10'],
            ['node20', 'child20'],
        ]);
    });
    (0, node_test_1.test)('find-deps-all-nodes-converge-to-one', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['root', 'A'],
                    ['root', 'B'],
                    ['root', 'C'],
                    ['A', 'target'],
                    ['B', 'target'],
                    ['C', 'target'],
                    ['target', 'end'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'root',
        });
        // target reached first via A (alphabetically first)
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['root', 'A'],
            ['root', 'B'],
            ['root', 'C'],
            // Level 1 - target via A
            ['A', 'target'],
            // Level 2
            ['target', 'end'],
        ]);
    });
    (0, node_test_1.test)('find-deps-deep-10-levels-complex', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    // ========== LEVEL 0 → LEVEL 1 ==========
                    ['foo', 'bar'],
                    ['foo', 'zed'],
                    ['foo', 'qux'],
                    // ========== LEVEL 1 → LEVEL 2 ==========
                    ['bar', 'bar1'],
                    ['bar', 'bar2'],
                    ['zed', 'zed1'],
                    ['zed', 'zed2'],
                    ['qux', 'qux1'],
                    // ========== LEVEL 2 → LEVEL 3 ==========
                    ['bar1', 'bar3'],
                    ['bar1', 'bar4'],
                    ['bar2', 'bar5'],
                    ['zed1', 'zed3'],
                    ['zed1', 'zed4'],
                    ['zed2', 'zed5'],
                    ['qux1', 'qux2'],
                    // ========== LEVEL 3 → LEVEL 4 ==========
                    ['bar3', 'bar6'],
                    ['bar3', 'bar7'],
                    ['bar4', 'bar8'],
                    ['bar5', 'bar9'],
                    ['zed3', 'zed6'],
                    ['zed4', 'zed7'],
                    ['zed5', 'zed8'],
                    ['qux2', 'qux3'],
                    // ========== LEVEL 4 → LEVEL 5 ==========
                    ['bar6', 'bar10'],
                    ['bar7', 'bar11'],
                    ['bar8', 'bar12'],
                    ['bar9', 'bar13'],
                    ['zed6', 'zed9'],
                    ['zed7', 'zed10'],
                    ['zed8', 'zed11'],
                    ['qux3', 'qux4'],
                    // ========== LEVEL 5 → LEVEL 6 (switch to composed names) ==========
                    ['bar10', 'foo/bar1'],
                    ['bar10', 'foo/bar2'],
                    ['bar11', 'foo/bar3'],
                    ['bar12', 'foo/bar4'],
                    ['bar13', 'foo/bar5'],
                    ['zed9', 'foo/zed1'],
                    ['zed10', 'foo/zed2'],
                    ['zed11', 'foo/zed3'],
                    // Cycle: qux4 → foo (already visited at level 0)
                    ['qux4', 'foo'],
                    ['qux4', 'foo/qux1'],
                    // ========== LEVEL 6 → LEVEL 7 ==========
                    ['foo/bar1', 'foo/bar6'],
                    ['foo/bar1', 'foo/bar7'],
                    ['foo/bar2', 'foo/bar8'],
                    ['foo/bar3', 'foo/bar9'],
                    ['foo/bar4', 'foo/bar10'],
                    ['foo/bar5', 'foo/bar11'],
                    ['foo/zed1', 'foo/zed4'],
                    ['foo/zed2', 'foo/zed5'],
                    ['foo/zed3', 'foo/zed6'],
                    ['foo/qux1', 'foo/qux2'],
                    // ========== LEVEL 7 → LEVEL 8 ==========
                    ['foo/bar6', 'bar/foo1'],
                    ['foo/bar7', 'bar/foo2'],
                    ['foo/bar8', 'bar/foo3'],
                    ['foo/bar9', 'bar/foo4'],
                    ['foo/bar10', 'bar/foo5'],
                    ['foo/bar11', 'bar/foo6'],
                    ['foo/zed4', 'zed/foo1'],
                    ['foo/zed5', 'zed/foo2'],
                    // Convergent: foo/zed6 and foo/qux2 both point to zed/foo3
                    ['foo/zed6', 'zed/foo3'],
                    ['foo/qux2', 'zed/foo3'],
                    // ========== LEVEL 8 → LEVEL 9 ==========
                    ['bar/foo1', 'bar/foo7'],
                    ['bar/foo2', 'bar/foo8'],
                    ['bar/foo3', 'bar/foo9'],
                    ['bar/foo4', 'bar/foo10'],
                    ['bar/foo5', 'bar/foo11'],
                    ['bar/foo6', 'bar/foo12'],
                    ['zed/foo1', 'zed/foo4'],
                    ['zed/foo2', 'zed/foo5'],
                    ['zed/foo3', 'zed/foo6'],
                    // ========== LEVEL 9 → LEVEL 10 ==========
                    ['bar/foo7', 'qux/bar1'],
                    ['bar/foo8', 'qux/bar2'],
                    ['bar/foo9', 'qux/bar3'],
                    ['bar/foo10', 'qux/bar4'],
                    ['bar/foo11', 'qux/bar5'],
                    ['bar/foo12', 'qux/bar6'],
                    ['zed/foo4', 'qux/zed1'],
                    ['zed/foo5', 'qux/zed2'],
                    ['zed/foo6', 'qux/zed3'],
                    // ========== LEVEL 10 → LEVEL 11 ==========
                    ['qux/bar1', 'qux/bar7'],
                    ['qux/bar2', 'qux/bar8'],
                    ['qux/bar3', 'qux/bar9'],
                    ['qux/bar4', 'qux/bar10'],
                    ['qux/bar5', 'qux/bar11'],
                    ['qux/bar6', 'qux/bar12'],
                    ['qux/zed1', 'qux/zed4'],
                    ['qux/zed2', 'qux/zed5'],
                    ['qux/zed3', 'qux/zed6'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo',
        });
        (0, code_1.expect)(res.deps).equal([
            // ========== LEVEL 0 ==========
            ['foo', 'bar'],
            ['foo', 'qux'],
            ['foo', 'zed'],
            // ========== LEVEL 1 ==========
            ['bar', 'bar1'],
            ['bar', 'bar2'],
            ['qux', 'qux1'],
            ['zed', 'zed1'],
            ['zed', 'zed2'],
            // ========== LEVEL 2 ==========
            ['bar1', 'bar3'],
            ['bar1', 'bar4'],
            ['bar2', 'bar5'],
            ['qux1', 'qux2'],
            ['zed1', 'zed3'],
            ['zed1', 'zed4'],
            ['zed2', 'zed5'],
            // ========== LEVEL 3 ==========
            ['bar3', 'bar6'],
            ['bar3', 'bar7'],
            ['bar4', 'bar8'],
            ['bar5', 'bar9'],
            ['qux2', 'qux3'],
            ['zed3', 'zed6'],
            ['zed4', 'zed7'],
            ['zed5', 'zed8'],
            // ========== LEVEL 4 ==========
            ['bar6', 'bar10'],
            ['bar7', 'bar11'],
            ['bar8', 'bar12'],
            ['bar9', 'bar13'],
            ['qux3', 'qux4'],
            ['zed6', 'zed9'],
            ['zed7', 'zed10'],
            ['zed8', 'zed11'],
            // ========== LEVEL 5 ==========
            ['bar10', 'foo/bar1'],
            ['bar10', 'foo/bar2'],
            ['bar11', 'foo/bar3'],
            ['bar12', 'foo/bar4'],
            ['bar13', 'foo/bar5'],
            // Note: qux4 → foo creates cycle (foo visited at level 0)
            ['qux4', 'foo/qux1'],
            ['zed9', 'foo/zed1'],
            ['zed10', 'foo/zed2'],
            ['zed11', 'foo/zed3'],
            // ========== LEVEL 6 ==========
            ['foo/bar1', 'foo/bar6'],
            ['foo/bar1', 'foo/bar7'],
            ['foo/bar2', 'foo/bar8'],
            ['foo/bar3', 'foo/bar9'],
            ['foo/bar4', 'foo/bar10'],
            ['foo/bar5', 'foo/bar11'],
            ['foo/qux1', 'foo/qux2'],
            ['foo/zed1', 'foo/zed4'],
            ['foo/zed2', 'foo/zed5'],
            ['foo/zed3', 'foo/zed6'],
            // ========== LEVEL 7 ==========
            ['foo/bar6', 'bar/foo1'],
            ['foo/bar7', 'bar/foo2'],
            ['foo/bar8', 'bar/foo3'],
            ['foo/bar9', 'bar/foo4'],
            ['foo/bar10', 'bar/foo5'],
            ['foo/bar11', 'bar/foo6'],
            ['foo/qux2', 'zed/foo3'],
            ['foo/zed4', 'zed/foo1'],
            ['foo/zed5', 'zed/foo2'],
            // Note: foo/zed6 → zed/foo3 is skipped because zed/foo3 was already visited via foo/qux2
            // ========== LEVEL 8 ==========
            ['bar/foo1', 'bar/foo7'],
            ['bar/foo2', 'bar/foo8'],
            ['bar/foo3', 'bar/foo9'],
            ['bar/foo4', 'bar/foo10'],
            ['bar/foo5', 'bar/foo11'],
            ['bar/foo6', 'bar/foo12'],
            ['zed/foo1', 'zed/foo4'],
            ['zed/foo2', 'zed/foo5'],
            ['zed/foo3', 'zed/foo6'],
            // ========== LEVEL 9 ==========
            ['bar/foo7', 'qux/bar1'],
            ['bar/foo8', 'qux/bar2'],
            ['bar/foo9', 'qux/bar3'],
            ['bar/foo10', 'qux/bar4'],
            ['bar/foo11', 'qux/bar5'],
            ['bar/foo12', 'qux/bar6'],
            ['zed/foo4', 'qux/zed1'],
            ['zed/foo5', 'qux/zed2'],
            ['zed/foo6', 'qux/zed3'],
            // ========== LEVEL 10 ==========
            ['qux/bar1', 'qux/bar7'],
            ['qux/bar2', 'qux/bar8'],
            ['qux/bar3', 'qux/bar9'],
            ['qux/bar4', 'qux/bar10'],
            ['qux/bar5', 'qux/bar11'],
            ['qux/bar6', 'qux/bar12'],
            ['qux/zed1', 'qux/zed4'],
            ['qux/zed2', 'qux/zed5'],
            ['qux/zed3', 'qux/zed6'],
        ]);
    });
    (0, node_test_1.test)('find-children', async () => {
        const seneca = makeSeneca().use(__2.default, {
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
        });
        await seneca.ready();
        const rootEntityId = '123';
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
        const bar9Ent = await seneca.entity('foo/bar9').save$({
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
        const bar8Ent = await seneca.entity('foo/bar8').save$({
            bar5_id: bar5Ent.id,
        });
        // Level 3: Children of zed1
        const zed2Ent = await seneca.entity('foo/zed2').save$({
            zed1_id: zed1Ent.id,
        });
        // Level 4: Children of bar6
        const bar10Ent = await seneca.entity('foo/bar10').save$({
            bar6_id: bar6Ent.id,
        });
        // Level 4: Children of bar7
        const bar11Ent = await seneca.entity('foo/bar11').save$({
            bar7_id: bar7Ent.id,
        });
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
        });
        (0, code_1.expect)(res.children).equal([
            // Level 1
            {
                parent_id: rootEntityId,
                child_id: bar1Ent.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            {
                parent_id: rootEntityId,
                child_id: bar2Ent.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar2',
            },
            {
                parent_id: rootEntityId,
                child_id: zed0Ent.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/zed0',
            },
            // Level 2
            {
                parent_id: bar1Ent.id,
                child_id: bar4Ent.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar4',
            },
            {
                parent_id: bar1Ent.id,
                child_id: bar5Ent.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar5',
            },
            {
                parent_id: bar2Ent.id,
                child_id: bar3Ent.id,
                parent_canon: 'foo/bar2',
                child_canon: 'foo/bar3',
            },
            {
                parent_id: bar2Ent.id,
                child_id: bar9Ent.id,
                parent_canon: 'foo/bar2',
                child_canon: 'foo/bar9',
            },
            {
                parent_id: zed0Ent.id,
                child_id: zed1Ent.id,
                parent_canon: 'foo/zed0',
                child_canon: 'foo/zed1',
            },
            // Level 3
            {
                parent_id: bar3Ent.id,
                child_id: bar6Ent.id,
                parent_canon: 'foo/bar3',
                child_canon: 'foo/bar6',
            },
            {
                parent_id: bar4Ent.id,
                child_id: bar7Ent.id,
                parent_canon: 'foo/bar4',
                child_canon: 'foo/bar7',
            },
            {
                parent_id: bar5Ent.id,
                child_id: bar8Ent.id,
                parent_canon: 'foo/bar5',
                child_canon: 'foo/bar8',
            },
            {
                parent_id: zed1Ent.id,
                child_id: zed2Ent.id,
                parent_canon: 'foo/zed1',
                child_canon: 'foo/zed2',
            },
            // Level 4
            {
                parent_id: bar6Ent.id,
                child_id: bar10Ent.id,
                parent_canon: 'foo/bar6',
                child_canon: 'foo/bar10',
            },
            {
                parent_id: bar7Ent.id,
                child_id: bar11Ent.id,
                parent_canon: 'foo/bar7',
                child_canon: 'foo/bar11',
            },
        ]);
    });
    (0, node_test_1.test)('find-children-empty-relations', async () => {
        const seneca = makeSeneca().use(__2.default);
        await seneca.ready();
        const rootEntityId = '123';
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
        });
        (0, code_1.expect)(res.children).equal([]);
    });
    (0, node_test_1.test)('find-children-no-matching-entities', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                ],
            },
        });
        await seneca.ready();
        const rootEntityId = '123';
        // Missing entities on data storage
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
        });
        (0, code_1.expect)(res.children).equal([]);
    });
    (0, node_test_1.test)('find-children-partial-tree', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar3'],
                    ['foo/bar1', 'foo/bar4'],
                ],
            },
        });
        await seneca.ready();
        const rootEntityId = '123';
        // Only create bar1 and bar3, not bar2 or bar4
        const bar1Ent = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar3Ent = await seneca.entity('foo/bar3').save$({
            bar1_id: bar1Ent.id,
        });
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
        });
        // Should only return entities that exist in the data storage
        (0, code_1.expect)(res.children).equal([
            {
                parent_id: rootEntityId,
                child_id: bar1Ent.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            {
                parent_id: bar1Ent.id,
                child_id: bar3Ent.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar3',
            },
        ]);
    });
    (0, node_test_1.test)('find-children-default-root-entity', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['sys/user', 'user/settings'],
                    ['sys/user', 'user/project'],
                    ['user/project', 'project/release'],
                ],
            },
        });
        await seneca.ready();
        const rootEntityId = 'user-456';
        const settingsEnt = await seneca.entity('user/settings').save$({
            user_id: rootEntityId,
        });
        const projectEnt = await seneca.entity('user/project').save$({
            user_id: rootEntityId,
        });
        const releaseEnt = await seneca.entity('project/release').save$({
            project_id: projectEnt.id,
        });
        const res = await seneca.post('sys:traverse,find:children', {
            // rootEntity omitted - should default to 'sys/user'
            rootEntityId: rootEntityId,
        });
        (0, code_1.expect)(res.children).equal([
            {
                parent_id: rootEntityId,
                child_id: projectEnt.id,
                parent_canon: 'sys/user',
                child_canon: 'user/project',
            },
            {
                parent_id: rootEntityId,
                child_id: settingsEnt.id,
                parent_canon: 'sys/user',
                child_canon: 'user/settings',
            },
            {
                parent_id: projectEnt.id,
                child_id: releaseEnt.id,
                parent_canon: 'user/project',
                child_canon: 'project/release',
            },
        ]);
    });
    (0, node_test_1.test)('find-children-avoid-wrong-children', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar3'],
                ],
            },
        });
        await seneca.ready();
        const rootEntityId = '123';
        const bar1Ent = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar2Ent = await seneca.entity('foo/bar2').save$({
            bar0_id: rootEntityId,
        });
        // Create bar3 entities but with another parent_id
        await seneca.entity('foo/bar3').save$({
            bar1_id: '456',
        });
        await seneca.entity('foo/bar3').save$({
            bar1_id: '789',
        });
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
        });
        // Should not include other parent children
        (0, code_1.expect)(res.children).equal([
            {
                parent_id: rootEntityId,
                child_id: bar1Ent.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            {
                parent_id: rootEntityId,
                child_id: bar2Ent.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar2',
            },
        ]);
    });
    (0, node_test_1.test)('find-children-single-entity-tree', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [['foo/bar0', 'foo/bar1']],
            },
        });
        await seneca.ready();
        const rootEntityId = '123';
        const bar1Ent = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
        });
        (0, code_1.expect)(res.children).equal([
            {
                parent_id: rootEntityId,
                child_id: bar1Ent.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
        ]);
    });
    (0, node_test_1.test)('find-children-deep-linear-chain', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar1', 'foo/bar2'],
                    ['foo/bar2', 'foo/bar3'],
                    ['foo/bar3', 'foo/bar4'],
                    ['foo/bar4', 'foo/bar5'],
                ],
            },
        });
        await seneca.ready();
        const rootEntityId = '123';
        const bar1Ent = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar2Ent = await seneca.entity('foo/bar2').save$({
            bar1_id: bar1Ent.id,
        });
        const bar3Ent = await seneca.entity('foo/bar3').save$({
            bar2_id: bar2Ent.id,
        });
        const bar4Ent = await seneca.entity('foo/bar4').save$({
            bar3_id: bar3Ent.id,
        });
        const bar5Ent = await seneca.entity('foo/bar5').save$({
            bar4_id: bar4Ent.id,
        });
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
        });
        (0, code_1.expect)(res.children).equal([
            {
                parent_id: rootEntityId,
                child_id: bar1Ent.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            {
                parent_id: bar1Ent.id,
                child_id: bar2Ent.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar2',
            },
            {
                parent_id: bar2Ent.id,
                child_id: bar3Ent.id,
                parent_canon: 'foo/bar2',
                child_canon: 'foo/bar3',
            },
            {
                parent_id: bar3Ent.id,
                child_id: bar4Ent.id,
                parent_canon: 'foo/bar3',
                child_canon: 'foo/bar4',
            },
            {
                parent_id: bar4Ent.id,
                child_id: bar5Ent.id,
                parent_canon: 'foo/bar4',
                child_canon: 'foo/bar5',
            },
        ]);
    });
    (0, node_test_1.test)('find-children-custom-key', async () => {
        const seneca = makeSeneca().use(__2.default, {
            customRef: {
                'foo/bar2': 'custom0_id',
                'foo/bar3': 'custom1_test',
            },
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                    ['foo/bar1', 'foo/bar3'],
                ],
            },
        });
        await seneca.ready();
        const rootEntityId = '123';
        const bar1Ent = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar2Ent = await seneca.entity('foo/bar2').save$({
            custom0_id: rootEntityId,
        });
        const bar3Ent = await seneca.entity('foo/bar3').save$({
            custom1_test: bar1Ent.id,
        });
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
        });
        (0, code_1.expect)(res.children).equal([
            {
                parent_id: rootEntityId,
                child_id: bar1Ent.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            {
                parent_id: rootEntityId,
                child_id: bar2Ent.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar2',
            },
            {
                parent_id: bar1Ent.id,
                child_id: bar3Ent.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar3',
            },
        ]);
    });
    (0, node_test_1.test)('find-children-multi-inst', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar1', 'foo/bar2'],
                ],
            },
        });
        await seneca.ready();
        const rootEntityId = '123';
        const bar1Ent1 = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar1Ent2 = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar1Ent3 = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar2Ent1 = await seneca.entity('foo/bar2').save$({
            bar1_id: bar1Ent1.id,
        });
        const bar2Ent2 = await seneca.entity('foo/bar2').save$({
            bar1_id: bar1Ent2.id,
        });
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
        });
        (0, code_1.expect)(res.children).equal([
            {
                parent_id: rootEntityId,
                child_id: bar1Ent1.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            {
                parent_id: rootEntityId,
                child_id: bar1Ent2.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            {
                parent_id: rootEntityId,
                child_id: bar1Ent3.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            {
                parent_id: bar1Ent1.id,
                child_id: bar2Ent1.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar2',
            },
            {
                parent_id: bar1Ent2.id,
                child_id: bar2Ent2.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar2',
            },
        ]);
    });
    (0, node_test_1.test)('find-children-multiple-inst-multi-levels', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar1', 'foo/bar2'],
                    ['foo/bar2', 'foo/bar3'],
                ],
            },
        });
        await seneca.ready();
        const rootEntityId = '123';
        const bar1Ent1 = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar1Ent2 = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar1Ent3 = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const bar2Ent1_1 = await seneca.entity('foo/bar2').save$({
            bar1_id: bar1Ent1.id,
        });
        const bar2Ent1_2 = await seneca.entity('foo/bar2').save$({
            bar1_id: bar1Ent1.id,
        });
        const bar2Ent2_1 = await seneca.entity('foo/bar2').save$({
            bar1_id: bar1Ent2.id,
        });
        const bar2Ent2_2 = await seneca.entity('foo/bar2').save$({
            bar1_id: bar1Ent2.id,
        });
        const bar2Ent3_1 = await seneca.entity('foo/bar2').save$({
            bar1_id: bar1Ent3.id,
        });
        const bar3Ent1_1_1 = await seneca.entity('foo/bar3').save$({
            bar2_id: bar2Ent1_1.id,
        });
        const bar3Ent1_1_2 = await seneca.entity('foo/bar3').save$({
            bar2_id: bar2Ent1_1.id,
        });
        const bar3Ent2_2_1 = await seneca.entity('foo/bar3').save$({
            bar2_id: bar2Ent2_2.id,
        });
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
        });
        (0, code_1.expect)(res.children).equal([
            // Level 1: All bar1 children of bar0
            {
                parent_id: rootEntityId,
                child_id: bar1Ent1.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            {
                parent_id: rootEntityId,
                child_id: bar1Ent2.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            {
                parent_id: rootEntityId,
                child_id: bar1Ent3.id,
                parent_canon: 'foo/bar0',
                child_canon: 'foo/bar1',
            },
            // Level 2: All bar2 children of bar1Ent1
            {
                parent_id: bar1Ent1.id,
                child_id: bar2Ent1_1.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar2',
            },
            {
                parent_id: bar1Ent1.id,
                child_id: bar2Ent1_2.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar2',
            },
            // Level 2: All bar2 children of bar1Ent2
            {
                parent_id: bar1Ent2.id,
                child_id: bar2Ent2_1.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar2',
            },
            {
                parent_id: bar1Ent2.id,
                child_id: bar2Ent2_2.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar2',
            },
            // Level 2: All bar2 children of bar1Ent3
            {
                parent_id: bar1Ent3.id,
                child_id: bar2Ent3_1.id,
                parent_canon: 'foo/bar1',
                child_canon: 'foo/bar2',
            },
            // Level 3: All bar3 children of bar2Ent1_1
            {
                parent_id: bar2Ent1_1.id,
                child_id: bar3Ent1_1_1.id,
                parent_canon: 'foo/bar2',
                child_canon: 'foo/bar3',
            },
            {
                parent_id: bar2Ent1_1.id,
                child_id: bar3Ent1_1_2.id,
                parent_canon: 'foo/bar2',
                child_canon: 'foo/bar3',
            },
            // Level 3: All bar3 children of bar2Ent2_2
            {
                parent_id: bar2Ent2_2.id,
                child_id: bar3Ent2_2_1.id,
                parent_canon: 'foo/bar2',
                child_canon: 'foo/bar3',
            },
        ]);
    });
    (0, node_test_1.test)('find-children-single-cycle', async () => {
        const seneca = makeSeneca().use(__2.default, {
            relations: {
                parental: [
                    ['A', 'B'],
                    ['A', 'C'],
                    ['C', 'E'],
                    ['C', 'D'],
                    ['E', 'G'],
                    ['E', 'F'],
                    ['F', 'H'],
                    ['C', 'A'],
                    ['N', 'M'],
                ],
            },
        });
        await seneca.ready();
        let rootEntityId = '123';
        const aEnt = await seneca.entity('A').save$({
            C_id: rootEntityId,
        });
        const cEnt = await seneca.entity('C').save$({
            id: rootEntityId,
            A_id: aEnt.id,
        });
        const bEnt = await seneca.entity('B').save$({
            A_id: aEnt.id,
        });
        const dEnt = await seneca.entity('D').save$({
            C_id: cEnt.id,
        });
        const eEnt = await seneca.entity('E').save$({
            C_id: cEnt.id,
        });
        const fEnt = await seneca.entity('F').save$({
            E_id: eEnt.id,
        });
        const gEnt = await seneca.entity('G').save$({
            E_id: eEnt.id,
        });
        const hEnt = await seneca.entity('H').save$({
            F_id: fEnt.id,
        });
        const nEnt = await seneca.entity('N').save$();
        await seneca.entity('M').save$({
            N_id: nEnt.id,
        });
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'C',
            rootEntityId: cEnt.id,
        });
        // Should traverse from C,
        // including C->A but NOT A->C
        (0, code_1.expect)(res.children).equal([
            {
                parent_id: rootEntityId,
                child_id: aEnt.id,
                parent_canon: 'C',
                child_canon: 'A',
            },
            {
                parent_id: rootEntityId,
                child_id: dEnt.id,
                parent_canon: 'C',
                child_canon: 'D',
            },
            {
                parent_id: rootEntityId,
                child_id: eEnt.id,
                parent_canon: 'C',
                child_canon: 'E',
            },
            {
                parent_id: aEnt.id,
                child_id: bEnt.id,
                parent_canon: 'A',
                child_canon: 'B',
            },
            {
                parent_id: eEnt.id,
                child_id: fEnt.id,
                parent_canon: 'E',
                child_canon: 'F',
            },
            {
                parent_id: eEnt.id,
                child_id: gEnt.id,
                parent_canon: 'E',
                child_canon: 'G',
            },
            {
                parent_id: fEnt.id,
                child_id: hEnt.id,
                parent_canon: 'F',
                child_canon: 'H',
            },
        ]);
    });
    (0, node_test_1.test)('create-run', async () => {
        const seneca = makeSeneca()
            .use(__2.default, {
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
        const seneca = makeSeneca()
            .use(__2.default, {
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
        const seneca = makeSeneca()
            .use(__2.default, {
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
        const seneca = makeSeneca()
            .use(__2.default, {
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
        const seneca = makeSeneca()
            .use(__2.default, {
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
    (0, node_test_1.test)('execute-task', async () => {
        const seneca = makeSeneca()
            .use(__2.default, {
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
        const seneca = makeSeneca()
            .use(__2.default, {
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
        await sleep(50);
        (0, code_1.expect)(executionCount).equal(1);
        const updatedTask = await seneca.entity('sys/traversetask').load$(task.id);
        (0, code_1.expect)(updatedTask.status).equal('done');
    });
    (0, node_test_1.test)('start-run', async () => {
        const seneca = makeSeneca()
            .use(__2.default, {
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
        await sleep(50);
        tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasks.length).equal(4);
        for (const task of tasks) {
            (0, code_1.expect)(task.status).equal('done');
        }
    });
    (0, node_test_1.test)('start-run-with-client-sleep', async () => {
        const seneca = makeSeneca()
            .use(__2.default, {
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
            await sleep(Math.random() * 10);
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
        await sleep(200);
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
        const seneca = makeSeneca()
            .use(__2.default)
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
        await sleep(50);
        tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasks[0].status).equal('done');
        const run = await seneca.entity('sys/traverse').load$(runEnt.id);
        (0, code_1.expect)(run.status).equal('completed');
    });
    (0, node_test_1.test)('star-run-deep', async () => {
        const seneca = makeSeneca()
            .use(__2.default, {
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
            await sleep(Math.random() * 15);
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
        await sleep(300);
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
        const seneca = makeSeneca()
            .use(__2.default, {
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
        const seneca = makeSeneca()
            .use(__2.default, {
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
            await sleep(Math.random() * 15);
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
        const seneca = makeSeneca()
            .use(__2.default, {
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
            await sleep(Math.random() * 15);
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
        await sleep(100);
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
    (0, node_test_1.test)('restart-run-previously-stopped', async () => {
        const seneca = makeSeneca()
            .use(__2.default, {
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
            await sleep(Math.random() * 15);
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
        const tasksRunStart = await seneca.entity('sys/traversetask').list$({
            run_id: runEnt.id,
        });
        (0, code_1.expect)(tasksRunStart.length).equal(6);
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
        await sleep(100);
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
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function makeSeneca(opts = {}) {
    const seneca = (0, seneca_1.default)({ legacy: false }).test().use('promisify').use('entity');
    return seneca;
}
//# sourceMappingURL=Traverse.test.js.map