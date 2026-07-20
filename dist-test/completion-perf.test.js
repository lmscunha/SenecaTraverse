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
// Completion must not scan the task table. The async driver finds the next task
// by walking `seq` down from `max_seq` with an indexed `load$` per level (keyed
// lookup), never `list$`-ing all tasks. These tests assert zero task-table
// `list$` calls during the completion phase, independent of run size — a
// regression to per-completion scanning would make the count scale with n.
(0, node_test_1.describe)('Traverse: completion performs no task-table scans', () => {
    async function measureCompletionScans(childCount) {
        const seneca = (0, utils_1.makeSeneca)()
            .use(__1.default, {
            mode: 'async',
            rootExecute: false,
            relations: { parental: [['perf/root', 'perf/child']] },
        })
            .message('aim:task,perf:test', async function () {
            return { ok: true };
        });
        await seneca.ready();
        const rootEntityId = 'root-1';
        for (let i = 0; i < childCount; i++) {
            await seneca.entity('perf/child').save$({ root_id: rootEntityId });
        }
        const createRes = await seneca.post('sys:traverse,on:run,do:create', {
            rootEntity: 'perf/root',
            rootEntityId,
            taskMsg: 'aim:task,perf:test',
        });
        const runId = createRes.run.id;
        (0, code_1.expect)(createRes.run.total_tasks).equal(childCount);
        await seneca.post('sys:traverse,on:run,do:start', { runId });
        const tasks = await seneca
            .entity('sys/traversetask')
            .list$({ run_id: runId });
        (0, code_1.expect)(tasks.length).equal(childCount);
        // Instrument only the completion phase: count list$ against the task table.
        const proto = Object.getPrototypeOf(seneca.entity('sys/traversetask'));
        const origList = proto.list$;
        let taskListCalls = 0;
        proto.list$ = function (...args) {
            const canon = typeof this.canon$ === 'function' ? this.canon$({ string: true }) : '';
            if (String(canon).includes('traversetask')) {
                taskListCalls++;
            }
            return origList.apply(this, args);
        };
        try {
            for (const task of tasks) {
                await seneca.post('sys:traverse,on:task,do:complete', {
                    taskId: task.id,
                });
            }
        }
        finally {
            proto.list$ = origList;
        }
        const finalRun = await seneca.entity('sys/traverse').load$(runId);
        (0, code_1.expect)(finalRun.status).equal('completed');
        (0, code_1.expect)(finalRun.completed_tasks).equal(childCount);
        return taskListCalls;
    }
    (0, node_test_1.test)('completion does no task-table list$ (keyed lookup, not scan)', async () => {
        const small = await measureCompletionScans(10);
        const large = await measureCompletionScans(60);
        // The driver uses indexed load$ by seq, never list$ on the task table.
        (0, code_1.expect)(small).equal(0);
        (0, code_1.expect)(large).equal(0);
    });
});
//# sourceMappingURL=completion-perf.test.js.map