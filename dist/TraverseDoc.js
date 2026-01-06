"use strict";
/* Copyright © 2024 Seneca Project Contributors, MIT License. */
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
            desc: 'Create a run process and generate tasks for each child entity to be executed.',
        },
        msgRunStart: {
            desc: 'Start a Run process execution, dispatching the next pending child task.',
        },
        msgRunStop: {
            desc: 'Stop a Run process execution, preventing the dispatching of the next pending child task.',
        },
        msgTaskExecute: {
            desc: 'Execute a single Run task.',
        },
    },
};
exports.default = docs;
if ('undefined' !== typeof module) {
    module.exports = docs;
}
//# sourceMappingURL=TraverseDoc.js.map