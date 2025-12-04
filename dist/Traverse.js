"use strict";
/* Copyright © 2025 Seneca Project Contributors, MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
function Traverse(options) {
    const seneca = this;
    const { Default } = seneca.valid;
    seneca
        .fix('sys:traverse')
        .message('find:deps', { rootEntity: String }, msgFindDeps);
    // Returns the sorted entity pairs, starting from a given entity.
    // In breadth-first order, sorting first by level, then alphabetically in each level.
    async function msgFindDeps(msg) {
        // const seneca = this
        const allRealtions = options.relations.parental;
        const rootEntity = msg.rootEntity || options.rootEntity;
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
        let levelEntToProcess = [];
        visitedEntitiesSet.add(rootEntity);
        levelEntToProcess.push(rootEntity);
        while (levelEntToProcess.length > 0) {
            const nextLevel = [];
            levelEntToProcess.sort();
            for (const parent of levelEntToProcess) {
                const entityChildren = parentChildrenMap.get(parent)?.sort() || [];
                if (entityChildren.length === 0) {
                    continue;
                }
                for (const child of entityChildren) {
                    if (!visitedEntitiesSet.has(child)) {
                        deps.push([parent, child]);
                        visitedEntitiesSet.add(child);
                        nextLevel.push(child);
                    }
                }
            }
            levelEntToProcess = nextLevel;
        }
        return {
            ok: true,
            deps,
        };
    }
}
// Default options.
const defaults = {
    // TODO: Enable debug logging
    debug: false,
    rootEntity: 'sys/user',
    relations: {
        parental: [],
    },
};
Object.assign(Traverse, { defaults });
exports.default = Traverse;
if ('undefined' !== typeof module) {
    module.exports = Traverse;
}
//# sourceMappingURL=Traverse.js.map