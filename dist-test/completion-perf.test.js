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
// Completion must not load the whole task table. The async driver picks the
// next task with a single query filtered to the run, ordered deepest-first and
// limited to one row. This test asserts every task-table `list$` during the
// completion phase returns at most one row — a regression to fetching a whole
// level (or the whole table) per completion would return many.
(0, node_test_1.describe)('Traverse: completion uses a bounded next-task query', () => {
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
        // Instrument the completion phase: record the largest task-table list$
        // result. A bounded next-task query returns one row; a full scan returns n.
        const proto = Object.getPrototypeOf(seneca.entity('sys/traversetask'));
        const origList = proto.list$;
        let maxRows = 0;
        proto.list$ = async function (...args) {
            const canon = typeof this.canon$ === 'function' ? this.canon$({ string: true }) : '';
            const res = await origList.apply(this, args);
            if (String(canon).includes('traversetask') && Array.isArray(res)) {
                maxRows = Math.max(maxRows, res.length);
            }
            return res;
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
        return maxRows;
    }
    (0, node_test_1.test)('next-task query returns at most one row, independent of run size', async () => {
        const small = await measureCompletionScans(10);
        const large = await measureCompletionScans(60);
        // limit$:1 — the query never loads a whole level or the whole table.
        (0, code_1.expect)(small).most(1);
        (0, code_1.expect)(large).most(1);
    });
});
//# sourceMappingURL=completion-perf.test.js.map