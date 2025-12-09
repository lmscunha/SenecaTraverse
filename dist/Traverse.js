"use strict";
/* Copyright © 2025 Seneca Project Contributors, MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
const gubu_1 = require("gubu");
function Traverse(options) {
    const seneca = this;
    // const { Default } = seneca.valid
    seneca
        .fix('sys:traverse')
        .message('find:deps', {
        rootEntity: (0, gubu_1.Optional)(String),
        relations: (0, gubu_1.Skip)({ parental: [[String, String]] }),
    }, msgFindDeps)
        .message('find:children', {
        rootEntity: (0, gubu_1.Optional)(String),
        customRef: (0, gubu_1.Optional)(Object),
        rootEntityId: String,
        relations: [[String, String]],
    }, msgFindChildren);
    // Returns a sorted list of entity pairs starting from a given entity.
    // In breadth-first order, sorting first by level, then alphabetically in each level.
    async function msgFindDeps(msg) {
        // const seneca = this
        const allRelations = msg.relations?.parental || options.relations.parental;
        const rootEntity = msg.rootEntity || options.rootEntity;
        const deps = [];
        const parentChildrenMap = new Map();
        for (const [parent, child] of allRelations) {
            if (!parentChildrenMap.has(parent)) {
                parentChildrenMap.set(parent, []);
            }
            parentChildrenMap.get(parent).push(child);
        }
        for (const children of parentChildrenMap.values()) {
            children.sort();
        }
        const visitedEntitiesSet = new Set([rootEntity]);
        let currentLevel = [rootEntity];
        while (currentLevel.length > 0) {
            const nextLevel = [];
            let levelDeps = [];
            for (const parent of currentLevel) {
                const children = parentChildrenMap.get(parent) || [];
                for (const child of children) {
                    if (visitedEntitiesSet.has(child)) {
                        continue;
                    }
                    levelDeps.push([parent, child]);
                    visitedEntitiesSet.add(child);
                    nextLevel.push(child);
                }
            }
            levelDeps = compareRelations(levelDeps);
            deps.push(...levelDeps);
            currentLevel = nextLevel;
        }
        return {
            ok: true,
            deps,
        };
    }
    async function msgFindChildren(msg) {
        const out = [];
        const rootEntity = msg.rootEntity || options.rootEntity;
        const rootEntityId = msg.rootEntityId;
        const relations = msg.relations;
        const parentInstanceMap = new Map();
        parentInstanceMap.set(rootEntity, [rootEntityId]);
        while (relations.length > 0) {
            const relation = relations.shift();
            const parentCanon = relation[0];
            const childCanon = relation[1];
            const parentEntityName = getEntityName(parentCanon);
            const foreignRef = (msg.customRef && msg.customRef[childCanon]) || `${parentEntityName}_id`;
            const parentInstances = parentInstanceMap.get(parentCanon) ?? [];
            for (const parentId of parentInstances) {
                const childInstances = await seneca.entity(childCanon).list$({
                    [foreignRef]: parentId,
                    fields$: ['id'],
                });
                for (const childInst of childInstances) {
                    if (!parentInstanceMap.has(childCanon)) {
                        parentInstanceMap.set(childCanon, []);
                    }
                    parentInstanceMap.get(childCanon).push(childInst.id);
                    out.push({
                        parent_id: parentId,
                        child_id: childInst.id,
                        parent_canon: parentCanon,
                        child_canon: childCanon,
                    });
                }
            }
        }
        return {
            ok: true,
            children: out,
        };
    }
    function compareRelations(relations) {
        return [...relations].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }) ||
            a[1].localeCompare(b[1], undefined, { numeric: true }));
    }
    function getEntityName(entity) {
        return entity.split('/')[1] ?? '';
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