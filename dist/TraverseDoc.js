"use strict";
/* Copyright © 2026 Seneca Project Contributors, MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
const docs = {
    messages: {
        msgFindDeps: {
            desc: 'Returns a sorted list of entity pairs starting from a given entity.',
        },
        msgFindChildren: {
            desc: 'Returns all discovered child instances with their parent relationship.',
        },
        msgCreateTaskRun: {
            desc: 'Create a run process and generate tasks for each child entity to be executed. Atomically rolls back (removes run + all created tasks) and returns ok:false if any task save fails.',
        },
        msgTaskExecute: {
            desc: 'Execute a single Run task.',
        },
        msgDispatch: {
            desc: 'Default dispatch: calls the task_msg then marks the task complete. Override sys:traverse,do:dispatch,on:task to replace with async transport (e.g. SQS). The override must call sys:traverse,on:task,do:complete itself.',
        },
        msgRunStart: {
            desc: 'Start a Run process execution, dispatching the next pending child task.',
        },
        msgRunStop: {
            desc: 'Stop a Run process execution, preventing the dispatching of the next pending child task.',
        },
        msgTaskComplete: {
            desc: 'Mark a task done, store optional result/fragment, then attempt completion via sys:traverse,on:run,do:claim; the claim winner emits sys:traverse,on:run,did:complete exactly once.',
        },
        msgRunDidComplete: {
            desc: 'Overridable hook fired once when a run transitions to completed. Default is a no-op. Override to trigger downstream work (e.g. fan-out to an ingest queue).',
        },
        msgRunClaim: {
            desc: 'Overridable completion claim. Default is best-effort (load-count-set) and returns claimed:true for the single caller that transitions the run to completed. Override sys:traverse,on:run,do:claim with a store-level conditional write (e.g. DynamoDB attribute_not_exists) to make the claim atomic across concurrent distributed workers and guarantee did:complete fires exactly once.',
        },
    },
};
exports.default = docs;
if ('undefined' !== typeof module) {
    module.exports = docs;
}
//# sourceMappingURL=TraverseDoc.js.map