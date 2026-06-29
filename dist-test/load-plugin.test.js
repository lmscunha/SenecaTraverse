"use strict";
/* Copyright © 2025 Seneca Project Contributors, MIT License. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const code_1 = require("@hapi/code");
const seneca_1 = __importDefault(require("seneca"));
const __1 = __importDefault(require(".."));
const TraverseDoc = __1.default;
(0, node_test_1.describe)('Traverse: load plugin', () => {
    (0, node_test_1.test)('load-plugin', async () => {
        (0, code_1.expect)(TraverseDoc).exist();
        const seneca = (0, seneca_1.default)({ legacy: false })
            .test()
            .use('promisify')
            .use('entity')
            .use(__1.default);
        await seneca.ready();
        (0, code_1.expect)(seneca.find_plugin('Traverse')).exist();
    });
});
//# sourceMappingURL=load-plugin.test.js.map