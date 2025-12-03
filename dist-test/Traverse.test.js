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
        const seneca = (0, seneca_1.default)({ legacy: false })
            .test()
            .use('promisify')
            .use('entity')
            .use(__2.default, {
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
        await seneca.ready();
        const result = await seneca.post('sys:traverse,find:deps');
        // console.log('find deps result ', sortedDepsList)
        (0, code_1.expect)(result.deps).equal([
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
});
//# sourceMappingURL=Traverse.test.js.map