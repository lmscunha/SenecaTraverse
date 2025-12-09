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
                    // Level 0: root → simple names
                    ['root', 'alpha'],
                    ['root', 'beta'],
                    ['root', 'gamma'],
                    // Level 1: simple → mixed format
                    ['alpha', 'sys/config'],
                    ['alpha', 'A'],
                    ['beta', 'sys/auth'],
                    ['beta', 'lib/utils'],
                    ['gamma', 'B'],
                    // Level 2: mixed → namespaced with numbers
                    ['sys/config', 'app/module1'],
                    ['sys/config', 'app/module2'],
                    ['A', 'foo/bar1'],
                    ['sys/auth', 'auth/provider10'],
                    ['sys/auth', 'auth/provider2'],
                    ['lib/utils', 'C'],
                    ['B', 'foo/baz5'],
                    // Level 3: deeper nesting
                    ['app/module1', 'core/service10'],
                    ['app/module1', 'core/service2'],
                    ['app/module2', 'data/processor1'],
                    ['foo/bar1', 'foo/bar10'],
                    ['foo/bar1', 'foo/bar2'],
                    ['auth/provider2', 'auth/token/handler'],
                    ['auth/provider10', 'D'],
                    ['C', 'lib/helper3'],
                    ['foo/baz5', 'dead/end1'], // Dead end branch
                    // Level 4
                    ['core/service2', 'db/connection5'],
                    ['core/service2', 'db/connection50'],
                    ['core/service10', 'cache/redis'],
                    ['data/processor1', 'queue/worker1'],
                    ['data/processor1', 'queue/worker10'],
                    ['foo/bar2', 'E'],
                    ['foo/bar10', 'foo/bar100'],
                    ['auth/token/handler', 'security/validator'],
                    ['D', 'monitor/logger'],
                    ['lib/helper3', 'lib/helper30'],
                    // Dead end: dead/end1 has no children
                    // Level 5
                    ['db/connection5', 'pool/manager1'],
                    ['db/connection50', 'F'],
                    ['cache/redis', 'cache/redis/cluster'],
                    ['queue/worker1', 'task/executor2'],
                    ['queue/worker10', 'task/executor20'],
                    ['E', 'report/generator'],
                    ['foo/bar100', 'foo/bar1000'],
                    ['security/validator', 'G'],
                    ['monitor/logger', 'log/stream5'],
                    ['lib/helper30', 'lib/helper300'],
                    // Level 6
                    ['pool/manager1', 'resource/allocator'],
                    ['F', 'backup/service'],
                    ['cache/redis/cluster', 'node/shard1'],
                    ['cache/redis/cluster', 'node/shard10'],
                    ['task/executor2', 'H'],
                    ['task/executor20', 'event/handler'],
                    ['report/generator', 'pdf/renderer'],
                    ['foo/bar1000', 'final/component1'],
                    ['G', 'audit/trail'],
                    ['log/stream5', 'storage/bucket10'],
                    ['log/stream5', 'storage/bucket2'],
                    // Cycle: lib/helper300 → sys/config (already visited at level 1)
                    ['lib/helper300', 'sys/config'],
                    ['lib/helper300', 'metrics/collector'],
                    // Level 7
                    ['resource/allocator', 'I'],
                    ['backup/service', 'snapshot/manager'],
                    ['node/shard1', 'replica/node1'],
                    ['node/shard10', 'replica/node10'],
                    ['H', 'notification/service'],
                    ['event/handler', 'webhook/dispatcher'],
                    ['pdf/renderer', 'template/engine'],
                    ['final/component1', 'J'],
                    ['audit/trail', 'compliance/checker'],
                    ['storage/bucket2', 'archive/tier1'],
                    ['storage/bucket10', 'archive/tier10'],
                    ['metrics/collector', 'stats/aggregator'],
                    // Level 8
                    ['I', 'health/check'],
                    ['snapshot/manager', 'K'],
                    ['replica/node1', 'sync/protocol'],
                    ['replica/node10', 'sync/protocol'], // Convergent path
                    ['notification/service', 'email/sender'],
                    ['webhook/dispatcher', 'http/client'],
                    ['template/engine', 'render/pipeline'],
                    ['J', 'output/formatter'],
                    ['compliance/checker', 'policy/enforcer'],
                    ['archive/tier1', 'L'],
                    ['archive/tier10', 'cold/storage'],
                    ['stats/aggregator', 'dashboard/api'],
                    // Level 9
                    ['health/check', 'ping/service'],
                    ['K', 'recovery/manager'],
                    ['sync/protocol', 'consensus/algorithm'], // From convergent paths
                    ['email/sender', 'smtp/gateway'],
                    ['http/client', 'retry/logic'],
                    ['render/pipeline', 'M'],
                    ['output/formatter', 'serializer/json'],
                    ['policy/enforcer', 'rule/engine'],
                    ['L', 'tape/backup'],
                    ['cold/storage', 'glacier/vault'],
                    ['dashboard/api', 'visualization/service'],
                    // Level 10 (final level)
                    ['ping/service', 'endpoint/monitor'],
                    ['recovery/manager', 'failover/system'],
                    ['consensus/algorithm', 'raft/implementation'],
                    ['smtp/gateway', 'mail/queue'],
                    ['retry/logic', 'exponential/backoff'],
                    ['M', 'final/output'],
                    ['serializer/json', 'schema/validator'],
                    ['rule/engine', 'decision/tree'],
                    ['tape/backup', 'offsite/storage'],
                    ['glacier/vault', 'deep/archive'],
                    ['visualization/service', 'chart/renderer'],
                ],
            },
        });
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'root',
        });
        (0, code_1.expect)(res.deps).equal([
            // ========== LEVEL 0 ==========
            ['root', 'alpha'],
            ['root', 'beta'],
            ['root', 'gamma'],
            // ========== LEVEL 1 ==========
            ['alpha', 'A'],
            ['alpha', 'sys/config'],
            ['beta', 'lib/utils'],
            ['beta', 'sys/auth'],
            ['gamma', 'B'],
            // ========== LEVEL 2 ==========
            ['A', 'foo/bar1'],
            ['B', 'foo/baz5'],
            ['lib/utils', 'C'],
            ['sys/auth', 'auth/provider2'],
            ['sys/auth', 'auth/provider10'],
            ['sys/config', 'app/module1'],
            ['sys/config', 'app/module2'],
            // ========== LEVEL 3 ==========
            ['app/module1', 'core/service2'],
            ['app/module1', 'core/service10'],
            ['app/module2', 'data/processor1'],
            ['auth/provider2', 'auth/token/handler'],
            ['auth/provider10', 'D'],
            ['C', 'lib/helper3'],
            ['foo/bar1', 'foo/bar2'],
            ['foo/bar1', 'foo/bar10'],
            ['foo/baz5', 'dead/end1'],
            // ========== LEVEL 4 ==========
            ['auth/token/handler', 'security/validator'],
            ['core/service2', 'db/connection5'],
            ['core/service2', 'db/connection50'],
            ['core/service10', 'cache/redis'],
            ['D', 'monitor/logger'],
            ['data/processor1', 'queue/worker1'],
            ['data/processor1', 'queue/worker10'],
            ['foo/bar2', 'E'],
            ['foo/bar10', 'foo/bar100'],
            ['lib/helper3', 'lib/helper30'],
            // Note: dead/end1 has no children (dead end)
            // ========== LEVEL 5 ==========
            ['cache/redis', 'cache/redis/cluster'],
            ['db/connection5', 'pool/manager1'],
            ['db/connection50', 'F'],
            ['E', 'report/generator'],
            ['foo/bar100', 'foo/bar1000'],
            ['lib/helper30', 'lib/helper300'],
            ['monitor/logger', 'log/stream5'],
            ['queue/worker1', 'task/executor2'],
            ['queue/worker10', 'task/executor20'],
            ['security/validator', 'G'],
            // ========== LEVEL 6 ==========
            ['cache/redis/cluster', 'node/shard1'],
            ['cache/redis/cluster', 'node/shard10'],
            ['F', 'backup/service'],
            ['foo/bar1000', 'final/component1'],
            ['G', 'audit/trail'],
            // Note: lib/helper300 → sys/config creates cycle (sys/config visited at level 1)
            ['lib/helper300', 'metrics/collector'],
            ['log/stream5', 'storage/bucket2'],
            ['log/stream5', 'storage/bucket10'],
            ['pool/manager1', 'resource/allocator'],
            ['report/generator', 'pdf/renderer'],
            ['task/executor2', 'H'],
            ['task/executor20', 'event/handler'],
            // ========== LEVEL 7 ==========
            ['audit/trail', 'compliance/checker'],
            ['backup/service', 'snapshot/manager'],
            ['event/handler', 'webhook/dispatcher'],
            ['final/component1', 'J'],
            ['H', 'notification/service'],
            ['metrics/collector', 'stats/aggregator'],
            ['node/shard1', 'replica/node1'],
            ['node/shard10', 'replica/node10'],
            ['pdf/renderer', 'template/engine'],
            ['resource/allocator', 'I'],
            ['storage/bucket2', 'archive/tier1'],
            ['storage/bucket10', 'archive/tier10'],
            // ========== LEVEL 8 ==========
            ['archive/tier1', 'L'],
            ['archive/tier10', 'cold/storage'],
            ['compliance/checker', 'policy/enforcer'],
            ['I', 'health/check'],
            ['J', 'output/formatter'],
            ['notification/service', 'email/sender'],
            ['replica/node1', 'sync/protocol'],
            // Note: replica/node10 → sync/protocol (convergent - sync/protocol already visited)
            ['snapshot/manager', 'K'],
            ['stats/aggregator', 'dashboard/api'],
            ['template/engine', 'render/pipeline'],
            ['webhook/dispatcher', 'http/client'],
            // ========== LEVEL 9 ==========
            ['cold/storage', 'glacier/vault'],
            ['dashboard/api', 'visualization/service'],
            ['email/sender', 'smtp/gateway'],
            ['health/check', 'ping/service'],
            ['http/client', 'retry/logic'],
            ['K', 'recovery/manager'],
            ['L', 'tape/backup'],
            ['output/formatter', 'serializer/json'],
            ['policy/enforcer', 'rule/engine'],
            ['render/pipeline', 'M'],
            ['sync/protocol', 'consensus/algorithm'],
            // ========== LEVEL 10 ==========
            ['consensus/algorithm', 'raft/implementation'],
            ['glacier/vault', 'deep/archive'],
            ['M', 'final/output'],
            ['ping/service', 'endpoint/monitor'],
            ['recovery/manager', 'failover/system'],
            ['retry/logic', 'exponential/backoff'],
            ['rule/engine', 'decision/tree'],
            ['serializer/json', 'schema/validator'],
            ['smtp/gateway', 'mail/queue'],
            ['tape/backup', 'offsite/storage'],
            ['visualization/service', 'chart/renderer'],
        ]);
    });
    (0, node_test_1.test)('find-children', async () => {
        const seneca = makeSeneca().use(__2.default);
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
            relations: [
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
            relations: [],
        });
        (0, code_1.expect)(res.children).equal([]);
    });
    (0, node_test_1.test)('find-children-no-matching-entities', async () => {
        const seneca = makeSeneca().use(__2.default);
        await seneca.ready();
        const rootEntityId = '123';
        // Missing entities on data storage
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
            relations: [
                ['foo/bar0', 'foo/bar1'],
                ['foo/bar0', 'foo/bar2'],
            ],
        });
        (0, code_1.expect)(res.children).equal([]);
    });
    (0, node_test_1.test)('find-children-partial-tree', async () => {
        const seneca = makeSeneca().use(__2.default);
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
            relations: [
                ['foo/bar0', 'foo/bar1'],
                ['foo/bar0', 'foo/bar2'],
                ['foo/bar1', 'foo/bar3'],
                ['foo/bar1', 'foo/bar4'],
            ],
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
        const seneca = makeSeneca().use(__2.default);
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
            relations: [
                ['sys/user', 'user/settings'],
                ['sys/user', 'user/project'],
                ['user/project', 'project/release'],
            ],
        });
        (0, code_1.expect)(res.children).equal([
            {
                parent_id: rootEntityId,
                child_id: settingsEnt.id,
                parent_canon: 'sys/user',
                child_canon: 'user/settings',
            },
            {
                parent_id: rootEntityId,
                child_id: projectEnt.id,
                parent_canon: 'sys/user',
                child_canon: 'user/project',
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
        const seneca = makeSeneca().use(__2.default);
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
            relations: [
                ['foo/bar0', 'foo/bar1'],
                ['foo/bar0', 'foo/bar2'],
                ['foo/bar1', 'foo/bar3'],
            ],
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
        const seneca = makeSeneca().use(__2.default);
        await seneca.ready();
        const rootEntityId = '123';
        const bar1Ent = await seneca.entity('foo/bar1').save$({
            bar0_id: rootEntityId,
        });
        const res = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'foo/bar0',
            rootEntityId: rootEntityId,
            relations: [['foo/bar0', 'foo/bar1']],
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
        const seneca = makeSeneca().use(__2.default);
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
            relations: [
                ['foo/bar0', 'foo/bar1'],
                ['foo/bar1', 'foo/bar2'],
                ['foo/bar2', 'foo/bar3'],
                ['foo/bar3', 'foo/bar4'],
                ['foo/bar4', 'foo/bar5'],
            ],
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
            relations: [
                ['foo/bar0', 'foo/bar1'],
                ['foo/bar0', 'foo/bar2'],
                ['foo/bar1', 'foo/bar3'],
            ],
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
        const seneca = makeSeneca().use(__2.default);
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
            relations: [
                ['foo/bar0', 'foo/bar1'],
                ['foo/bar1', 'foo/bar2'],
            ],
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
        const seneca = makeSeneca().use(__2.default);
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
            relations: [
                ['foo/bar0', 'foo/bar1'],
                ['foo/bar1', 'foo/bar2'],
                ['foo/bar2', 'foo/bar3'],
            ],
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
});
function makeSeneca(opts = {}) {
    const seneca = (0, seneca_1.default)({ legacy: false }).test().use('promisify').use('entity');
    return seneca;
}
//# sourceMappingURL=Traverse.test.js.map