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
    (0, node_test_1.test)('find-deps-default-root', async () => {
        const seneca = makeSeneca().use(__2.default);
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar3'],
                    ['sys/user', 'foo/bar1'],
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
        // console.log('RES', res)
        (0, code_1.expect)(res.deps).equal([
            // Level 0
            ['sys/user', 'foo/bar1'],
            // Level 1
            ['foo/bar1', 'foo/bar4'],
            ['foo/bar1', 'foo/bar5'],
            // Level 2
            ['foo/bar4', 'foo/bar7'],
            ['foo/bar5', 'foo/bar8'],
            // Level 3
            ['foo/bar7', 'foo/bar11'],
        ]);
    });
    (0, node_test_1.test)('find-deps-all-custom', async () => {
        const seneca = makeSeneca().use(__2.default);
        await seneca.ready();
        const res = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'foo/bar0',
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
            ['foo/bar3', 'foo/bar6'],
            ['foo/bar4', 'foo/bar7'],
            ['foo/bar5', 'foo/bar8'],
            ['foo/zed1', 'foo/zed2'],
            // Level 3
            ['foo/bar6', 'foo/bar10'],
            ['foo/bar7', 'foo/bar11'],
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
    // test('find-deps-l1-convergent', async () => {
    //   const seneca = makeSeneca().use(Traverse, {
    //     relations: {
    //       parental: [
    //         ['foo/bar2', 'foo/bar3'],
    //         ['foo/bar0', 'foo/bar1'],
    //         ['foo/bar0', 'foo/bar2'],
    //         ['foo/bar1', 'foo/bar4'],
    //         ['foo/bar1', 'foo/bar5'],
    //         ['foo/bar3', 'foo/bar6'],
    //         ['foo/bar4', 'foo/bar7'],
    //         ['foo/bar5', 'foo/bar8'],
    //         ['foo/bar0', 'foo/zed0'],
    //         ['foo/zed0', 'foo/zed1'],
    //         ['foo/zed1', 'foo/zed2'],
    //         ['bar/baz0', 'bar/baz1'],
    //         ['qux/test', 'qux/prod'],
    //         ['foo/bar2', 'foo/bar9'],
    //         ['foo/bar6', 'foo/bar10'],
    //         ['foo/bar7', 'foo/bar11'],
    //         // Add convergent paths from bar1
    //         ['foo/bar4', 'foo/bar12'],
    //         ['foo/bar5', 'foo/bar12'], // bar12 converges from bar4 and bar5
    //         ['foo/bar12', 'foo/bar13'],
    //       ],
    //     },
    //   })
    //   await seneca.ready()
    //
    //   const res = await seneca.post('sys:traverse,find:deps', {
    //     rootEntity: 'foo/bar1',
    //   })
    //
    //   expect(res.deps).equal([
    //     // Level 0
    //     ['foo/bar1', 'foo/bar4'],
    //     ['foo/bar1', 'foo/bar5'],
    //
    //     // Level 1
    //     ['foo/bar4', 'foo/bar7'],
    //     ['foo/bar4', 'foo/bar12'],
    //     ['foo/bar5', 'foo/bar8'],
    //
    //     // Level 2
    //     ['foo/bar7', 'foo/bar11'],
    //     ['foo/bar12', 'foo/bar13'],
    //   ])
    // })
    //
    // test('find-deps-l1-cycle', async () => {
    //   const seneca = makeSeneca().use(Traverse, {
    //     relations: {
    //       parental: [
    //         ['foo/bar2', 'foo/bar3'],
    //         ['foo/bar0', 'foo/bar1'],
    //         ['foo/bar0', 'foo/bar2'],
    //         ['foo/bar1', 'foo/bar4'],
    //         ['foo/bar1', 'foo/bar5'],
    //         ['foo/bar3', 'foo/bar6'],
    //         ['foo/bar4', 'foo/bar7'],
    //         ['foo/bar5', 'foo/bar8'],
    //         ['foo/bar0', 'foo/zed0'],
    //         ['foo/zed0', 'foo/zed1'],
    //         ['foo/zed1', 'foo/zed2'],
    //         ['bar/baz0', 'bar/baz1'],
    //         ['qux/test', 'qux/prod'],
    //         ['foo/bar2', 'foo/bar9'],
    //         ['foo/bar6', 'foo/bar10'],
    //         ['foo/bar7', 'foo/bar11'],
    //         // Add cycle back to bar1
    //         ['foo/bar7', 'foo/bar1'], // Cycle: bar1 -> bar4 -> bar7 -> bar1
    //         ['foo/bar8', 'foo/bar12'],
    //       ],
    //     },
    //   })
    //   await seneca.ready()
    //
    //   const res = await seneca.post('sys:traverse,find:deps', {
    //     rootEntity: 'foo/bar1',
    //   })
    //
    //   // bar1 already visited, so cycle is ignored
    //   expect(res.deps).equal([
    //     // Level 0
    //     ['foo/bar1', 'foo/bar4'],
    //     ['foo/bar1', 'foo/bar5'],
    //
    //     // Level 1
    //     ['foo/bar4', 'foo/bar7'],
    //     ['foo/bar5', 'foo/bar8'],
    //
    //     // Level 2
    //     ['foo/bar7', 'foo/bar11'],
    //     ['foo/bar8', 'foo/bar12'],
    //   ])
    // })
    //
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
    // test('find-deps-l2-convergent', async () => {
    //   const seneca = makeSeneca().use(Traverse, {
    //     relations: {
    //       parental: [
    //         ['foo/bar2', 'foo/bar3'],
    //         ['foo/bar0', 'foo/bar1'],
    //         ['foo/bar0', 'foo/bar2'],
    //         ['foo/bar1', 'foo/bar4'],
    //         ['foo/bar1', 'foo/bar5'],
    //         ['foo/bar3', 'foo/bar6'],
    //         ['foo/bar4', 'foo/bar7'],
    //         ['foo/bar5', 'foo/bar8'],
    //         ['foo/bar0', 'foo/zed0'],
    //         ['foo/zed0', 'foo/zed1'],
    //         ['foo/zed1', 'foo/zed2'],
    //         ['bar/baz0', 'bar/baz1'],
    //         ['qux/test', 'qux/prod'],
    //         ['foo/bar2', 'foo/bar9'],
    //         ['foo/bar6', 'foo/bar10'],
    //         ['foo/bar7', 'foo/bar11'],
    //         // Add convergent paths from bar3
    //         ['foo/bar3', 'foo/bar12'],
    //         ['foo/bar6', 'foo/bar13'],
    //         ['foo/bar10', 'foo/bar14'],
    //         ['foo/bar12', 'foo/bar14'], // bar14 converges from bar10 and bar12
    //         ['foo/bar14', 'foo/bar15'],
    //       ],
    //     },
    //   })
    //   await seneca.ready()
    //
    //   const res = await seneca.post('sys:traverse,find:deps', {
    //     rootEntity: 'foo/bar3',
    //   })
    //
    //   expect(res.deps).equal([
    //     // Level 0
    //     ['foo/bar3', 'foo/bar6'],
    //     ['foo/bar3', 'foo/bar12'],
    //
    //     // Level 1
    //     ['foo/bar6', 'foo/bar10'],
    //     ['foo/bar6', 'foo/bar13'],
    //     ['foo/bar12', 'foo/bar14'],
    //
    //     // Level 2
    //     ['foo/bar10', 'foo/bar14'],
    //
    //     // Level 3
    //     ['foo/bar14', 'foo/bar15'],
    //   ])
    // })
    //
    // test('find-deps-l2-cycle', async () => {
    //   const seneca = makeSeneca().use(Traverse, {
    //     relations: {
    //       parental: [
    //         ['foo/bar2', 'foo/bar3'],
    //         ['foo/bar0', 'foo/bar1'],
    //         ['foo/bar0', 'foo/bar2'],
    //         ['foo/bar1', 'foo/bar4'],
    //         ['foo/bar1', 'foo/bar5'],
    //         ['foo/bar3', 'foo/bar6'],
    //         ['foo/bar4', 'foo/bar7'],
    //         ['foo/bar5', 'foo/bar8'],
    //         ['foo/bar0', 'foo/zed0'],
    //         ['foo/zed0', 'foo/zed1'],
    //         ['foo/zed1', 'foo/zed2'],
    //         ['bar/baz0', 'bar/baz1'],
    //         ['qux/test', 'qux/prod'],
    //         ['foo/bar2', 'foo/bar9'],
    //         ['foo/bar6', 'foo/bar10'],
    //         ['foo/bar7', 'foo/bar11'],
    //         // Add cycle back to bar3
    //         ['foo/bar10', 'foo/bar12'],
    //         ['foo/bar12', 'foo/bar3'], // Cycle: bar3 -> bar6 -> bar10 -> bar12 -> bar3
    //         ['foo/bar10', 'foo/bar13'],
    //       ],
    //     },
    //   })
    //   await seneca.ready()
    //
    //   const res = await seneca.post('sys:traverse,find:deps', {
    //     rootEntity: 'foo/bar3',
    //   })
    //
    //   // bar3 already visited, so cycle is ignored
    //   expect(res.deps).equal([
    //     // Level 0
    //     ['foo/bar3', 'foo/bar6'],
    //
    //     // Level 1
    //     ['foo/bar6', 'foo/bar10'],
    //
    //     // Level 2
    //     ['foo/bar10', 'foo/bar12'],
    //     ['foo/bar10', 'foo/bar13'],
    //   ])
    // })
    //
    // test('find-deps-l2-multi-level-convergent', async () => {
    //   const seneca = makeSeneca().use(Traverse, {
    //     relations: {
    //       parental: [
    //         ['foo/bar2', 'foo/bar3'],
    //         ['foo/bar0', 'foo/bar1'],
    //         ['foo/bar0', 'foo/bar2'],
    //         ['foo/bar1', 'foo/bar4'],
    //         ['foo/bar1', 'foo/bar5'],
    //         ['foo/bar3', 'foo/bar6'],
    //         ['foo/bar4', 'foo/bar7'],
    //         ['foo/bar5', 'foo/bar8'],
    //         ['foo/bar0', 'foo/zed0'],
    //         ['foo/zed0', 'foo/zed1'],
    //         ['foo/zed1', 'foo/zed2'],
    //         ['bar/baz0', 'bar/baz1'],
    //         ['qux/test', 'qux/prod'],
    //         ['foo/bar2', 'foo/bar9'],
    //         ['foo/bar6', 'foo/bar10'],
    //         ['foo/bar7', 'foo/bar11'],
    //         // Create diamond pattern from bar3
    //         ['foo/bar3', 'foo/bar12'],
    //         ['foo/bar3', 'foo/bar13'],
    //         ['foo/bar12', 'foo/bar14'],
    //         ['foo/bar13', 'foo/bar14'], // Diamond converges at bar14
    //         ['foo/bar6', 'foo/bar14'], // Third path to bar14
    //         ['foo/bar14', 'foo/bar15'],
    //       ],
    //     },
    //   })
    //   await seneca.ready()
    //
    //   const res = await seneca.post('sys:traverse,find:deps', {
    //     rootEntity: 'foo/bar3',
    //   })
    //
    //   // bar14 should appear via bar12 (first alphabetically among bar12, bar13)
    //   expect(res.deps).equal([
    //     // Level 0
    //     ['foo/bar3', 'foo/bar6'],
    //     ['foo/bar3', 'foo/bar12'],
    //     ['foo/bar3', 'foo/bar13'],
    //
    //     // Level 1
    //     ['foo/bar6', 'foo/bar10'],
    //     ['foo/bar12', 'foo/bar14'],
    //
    //     // Level 2
    //     ['foo/bar14', 'foo/bar15'],
    //   ])
    // })
});
function makeSeneca(opts = {}) {
    const seneca = (0, seneca_1.default)({ legacy: false }).test().use('promisify').use('entity');
    return seneca;
}
//# sourceMappingURL=Traverse.test.js.map