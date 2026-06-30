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
(0, node_test_1.describe)('Traverse: regression', () => {
    // Bug: plugin init pushed the injected ['sys/traverse','sys/traversetask']
    // relation into options.relations.parental in place. Seneca passes the
    // caller's array by reference, so this mutated the caller's own array (and,
    // when relying on the default, the shared defaults array — leaking the
    // relation across plugin loads). Init must not mutate the caller's input.
    (0, node_test_1.test)('init-does-not-mutate-caller-relations', async () => {
        const parental = [
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar0', 'foo/bar2'],
        ];
        const seneca = (0, support_1.makeSeneca)().use(__1.default, {
            relations: { parental },
        });
        await seneca.ready();
        // The caller's array must be untouched by plugin initialisation.
        (0, code_1.expect)(parental.length).equal(2);
        (0, code_1.expect)(parental).equal([
            ['foo/bar0', 'foo/bar1'],
            ['foo/bar0', 'foo/bar2'],
        ]);
        // The injected relation still works for traversal (find:deps reaches the
        // task entity), it just is not written back into the caller's array.
        const depsRes = await seneca.post('sys:traverse,find:deps', {
            rootEntity: 'sys/traverse',
        });
        (0, code_1.expect)(depsRes.ok).true();
        (0, code_1.expect)(depsRes.deps).equal([['sys/traverse', 'sys/traversetask']]);
    });
    // Bug: processRunTasks reloads the parent each iteration to detect concurrent
    // changes. When the run entity is removed mid-traversal the reload returns
    // null, and the final completion block dereferenced it unconditionally,
    // throwing a TypeError (surfacing as an unhandled rejection since the run
    // loop is fire-and-forget). The completion block must tolerate a null run.
    (0, node_test_1.test)('run-removed-mid-traversal-does-not-throw', async () => {
        const seneca = (0, support_1.makeSeneca)()
            .use(__1.default, {
            relations: {
                parental: [
                    ['foo/bar0', 'foo/bar1'],
                    ['foo/bar0', 'foo/bar2'],
                ],
            },
        })
            .message('aim:task,self:destruct', async function (msg) {
            const taskEnt = msg.task;
            // Remove the owning run while the traversal loop is still iterating,
            // so the next parent reload inside processRunTasks resolves to null.
            await this.entity('sys/traverse').remove$(taskEnt.run_id);
            taskEnt.status = 'done';
            await taskEnt.save$();
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = '123';
        const rootEntity = 'foo/bar0';
        await seneca.entity('foo/bar1').save$({ bar0_id: rootEntityId });
        await seneca.entity('foo/bar2').save$({ bar0_id: rootEntityId });
        const rejections = [];
        const onRejection = (reason) => rejections.push(reason);
        process.on('unhandledRejection', onRejection);
        try {
            const createTaskRes = await seneca.post('sys:traverse,on:run,do:create', {
                rootEntity,
                rootEntityId,
                taskMsg: 'aim:task,self:destruct',
            });
            await seneca.post('sys:traverse,on:run,do:start', {
                runId: createTaskRes.run.id,
            });
            // Let the fire-and-forget traversal finish (or throw).
            await (0, support_1.sleep)(300);
        }
        finally {
            process.removeListener('unhandledRejection', onRejection);
        }
        (0, code_1.expect)(rejections).equal([]);
    });
});
//# sourceMappingURL=regression.test.js.map