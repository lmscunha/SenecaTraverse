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
});
//# sourceMappingURL=Traverse.test.js.map