"use strict";
/* Copyright © 2025 Seneca Project Contributors, MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
function Traverse(options) {
    const seneca = this;
    const { Default } = seneca.valid;
    seneca.fix('sys:traverse')
        .message('find:deps', msgFindDeps);
    // Returns the sorted entity pairs, starting from a given entity.
    // In breadth-first order, sorting first by level, then alphabetically in each level.
    async function msgFindDeps(msg) {
        // const seneca = this
        const allRealtions = options.relations.parental;
        const rootEntity = options.rootEntity;
        const parentChildrenMap = new Map();
        const deps = [];
        for (let [parent, child] of allRealtions) {
            if (!parentChildrenMap.has(parent)) {
                parentChildrenMap.set(parent, []);
            }
            const childrenList = parentChildrenMap.get(parent) || [];
            childrenList.push(child);
            parentChildrenMap.set(parent, childrenList);
        }
        const visitedEntitiesSet = new Set();
        const entitiesToProcess = [];
        visitedEntitiesSet.add(rootEntity);
        entitiesToProcess.push(rootEntity);
        while (entitiesToProcess.length > 0) {
            const entity = entitiesToProcess.shift();
            const entityChildren = parentChildrenMap.get(entity) || [];
            entityChildren.sort();
            if (entityChildren.length === 0) {
                continue;
            }
            entityChildren.forEach((child) => {
                if (!visitedEntitiesSet.has(child)) {
                    deps.push([entity, child]);
                    visitedEntitiesSet.add(child);
                    entitiesToProcess.push(child);
                }
            });
        }
        return {
            ok: true, deps
        };
    }
}
// Default options.
const defaults = {
    // TODO: Enable debug logging
    debug: false,
    // TODO: define root entity
    rootEntity: '',
    relations: {
        parental: [
        // TODO: define standard relations
        // ['sys/user', 'sys/login'],
        // ['ledger/book', 'ledger/credit'],
        // ['ledger/book', 'ledger/debit']
        ]
    }
};
Object.assign(Traverse, { defaults });
exports.default = Traverse;
if ('undefined' !== typeof module) {
    module.exports = Traverse;
}
//# sourceMappingURL=Traverse.js.map