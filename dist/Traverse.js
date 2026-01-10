"use strict";
/* Copyright © 2025 Seneca Project Contributors, MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
const gubu_1 = require("gubu");
function Traverse(options) {
    const seneca = this;
    // A Run process can have multiple tasks as children.
    // Thus, this plugin automatically maps these relations for the client.
    options.customRef = { ...options.customRef, 'sys/traversetask': 'run_id' };
    options.relations.parental.push(['sys/traverse', 'sys/traversetask']);
    seneca
        .fix('sys:traverse')
        .message('find:deps', {
        rootEntity: (0, gubu_1.Optional)(String),
    }, msgFindDeps)
        .message('find:children', {
        rootEntity: (0, gubu_1.Optional)(String),
        rootEntityId: String,
    }, msgFindChildren)
        .message('on:run,do:create', {
        rootEntity: (0, gubu_1.Optional)(String),
        rootEntityId: String,
        taskMsg: String,
    }, msgCreateTaskRun)
        .message('on:task,do:execute', {
        task: Object,
    }, msgTaskExecute)
        .message('on:task,do:next', {
        runId: String,
    }, msgTaskNext)
        .message('on:run,do:start', {
        runId: String,
    }, msgRunStart)
        .message('on:run,do:stop', {
        runId: String,
    }, msgRunStop);
    // Returns a sorted list of entity pairs
    // starting from a given entity.
    // In breadth-first order, sorting first by level,
    // then alphabetically in each level.
    async function msgFindDeps(msg) {
        // const seneca = this
        const allRelations = options.relations.parental;
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
    // Returns all discovered child
    // instances with their parent relationship.
    async function msgFindChildren(msg) {
        const rootEntity = msg.rootEntity || options.rootEntity;
        const rootEntityId = msg.rootEntityId;
        const customRef = options.customRef;
        const relationsQueueRes = await seneca.post('sys:traverse,find:deps', {
            rootEntity,
        });
        const relationsQueue = relationsQueueRes.deps;
        const result = [];
        const parentInstanceMap = new Map();
        parentInstanceMap.set(rootEntity, new Set([rootEntityId]));
        for (const [parentCanon, childCanon] of relationsQueue) {
            const parentInstances = parentInstanceMap.get(parentCanon);
            if (!parentInstances || parentInstances.size === 0) {
                continue;
            }
            const foreignRef = customRef[childCanon] || `${getEntityName(parentCanon)}_id`;
            if (!parentInstanceMap.has(childCanon)) {
                parentInstanceMap.set(childCanon, new Set());
            }
            const childInstancesSet = parentInstanceMap.get(childCanon);
            const childQueryPromises = Array.from(parentInstances).map(async (parentId) => {
                const childInstances = await seneca.entity(childCanon).list$({
                    [foreignRef]: parentId,
                    fields$: ['id'],
                });
                return { parentId, childInstances };
            });
            const queryResults = await Promise.all(childQueryPromises);
            for (const { parentId, childInstances } of queryResults) {
                for (const childInst of childInstances) {
                    const childId = childInst.id;
                    childInstancesSet.add(childId);
                    result.push({
                        parent_id: parentId,
                        child_id: childId,
                        parent_canon: parentCanon,
                        child_canon: childCanon,
                    });
                }
            }
        }
        return {
            ok: true,
            children: result,
        };
    }
    // Create a run process and generate tasks
    // for each child entity to be executed.
    async function msgCreateTaskRun(msg) {
        const taskMsg = msg.taskMsg;
        const rootEntity = msg.rootEntity || options.rootEntity;
        const rootEntityId = msg.rootEntityId;
        const isRootIncluded = options.rootExecute;
        const run = await seneca.entity('sys/traverse').save$({
            root_entity: rootEntity,
            root_id: rootEntityId,
            status: 'created',
            task_msg: taskMsg,
            total_tasks: 0,
        });
        const findChildrenRes = await seneca.post('sys:traverse,find:children', {
            rootEntity,
            rootEntityId,
        });
        const tasksCreationPromises = [];
        if (isRootIncluded) {
            // Process the action on the root data storage,
            // not only on its children.
            tasksCreationPromises.push(seneca.entity('sys/traversetask').save$({
                run_id: run.id,
                parent_id: rootEntityId,
                child_id: rootEntityId,
                parent_canon: rootEntity,
                child_canon: rootEntity,
                status: 'pending',
                task_msg: run.task_msg,
            }));
        }
        findChildrenRes.children.forEach((child) => {
            tasksCreationPromises.push(seneca.entity('sys/traversetask').save$({
                run_id: run.id,
                parent_id: child.parent_id,
                child_id: child.child_id,
                parent_canon: child.parent_canon,
                child_canon: child.child_canon,
                status: 'pending',
                task_msg: run.task_msg,
            }));
        });
        const tasksCreationRes = await Promise.allSettled(tasksCreationPromises);
        let taskSuccessCount = 0;
        let taskFailedCount = 0;
        let childIdx = isRootIncluded ? -1 : 0;
        for (const taskCreation of tasksCreationRes) {
            if (taskCreation.status === 'fulfilled') {
                taskSuccessCount++;
                childIdx++;
                continue;
            }
            taskFailedCount++;
            const childrenData = childIdx === -1
                ? { child_canon: rootEntity, child_id: rootEntityId }
                : findChildrenRes.children[childIdx];
            // TODO: add proper logging and retry
            console.error('task create failed for child_canon: ' +
                childrenData.child_canon +
                ' - child_id: ' +
                childrenData.child_id +
                ' - error: ' +
                taskCreation.reason);
            childIdx++;
        }
        run.total_tasks = taskSuccessCount;
        await run.save$();
        return {
            ok: true,
            run,
            tasksCreated: taskSuccessCount,
            tasksFailed: taskFailedCount,
        };
    }
    // Execute a single Run task.
    async function msgTaskExecute(msg) {
        const task = msg.task;
        if (task.status == 'done' || task.status == 'dispatched') {
            return { ok: true };
        }
        task.status = 'dispatched';
        task.dispatched_at = Date.now();
        await task.save$();
        const dispatchArg = {
            task,
        };
        await seneca.post(task.task_msg, dispatchArg);
        return { ok: true };
    }
    // Dispatch the next pending task for a run.
    async function msgTaskNext(msg) {
        const runId = msg.runId;
        const run = await seneca.entity('sys/traverse').load$(runId);
        if (!run?.status) {
            return { ok: false, why: 'run-entity-not-found' };
        }
        if (run.status === 'stopped' || run.status === 'completed') {
            return { ok: false, why: 'inactive-run' };
        }
        const task = await dispatchNextTask(runId);
        if (!task) {
            run.status = 'completed';
            run.completed_at = Date.now();
            await run.save$();
            return { ok: true, why: 'run-completed' };
        }
        return { ok: true, task };
    }
    // Start a Run process execution,
    // dispatching the next pending child task.
    async function msgRunStart(msg) {
        const runId = msg.runId;
        const run = await seneca.entity('sys/traverse').load$(runId);
        if (!run?.status) {
            return { ok: false, why: 'run-entity-not-found' };
        }
        if (run.status === 'completed' || run.status === 'active') {
            return { ok: true, run };
        }
        run.status = 'active';
        run.started_at = Date.now();
        await run.save$();
        await dispatchNextTask(run.id);
        return { ok: true, run };
    }
    // Stop a Run process execution,
    // preventing the dispatching of the next pending child task.
    async function msgRunStop(msg) {
        const runId = msg.runId;
        const run = await seneca.entity('sys/traverse').load$(runId);
        if (!run?.status) {
            return { ok: false, why: 'run-entity-not-found' };
        }
        if (run.status !== 'active') {
            return { ok: true, run };
        }
        run.status = 'stopped';
        await run.save$();
        return { ok: true, run };
    }
    function compareRelations(relations) {
        return [...relations].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }) ||
            a[1].localeCompare(b[1], undefined, { numeric: true }));
    }
    function getEntityName(entityId) {
        const canonSeparatorIdx = entityId.lastIndexOf('/');
        return canonSeparatorIdx === -1
            ? entityId
            : entityId.slice(canonSeparatorIdx + 1);
    }
    async function dispatchNextTask(runId) {
        const tasks = await seneca.entity('sys/traversetask').list$({
            run_id: runId,
            status: ['pending', 'failed'],
            limit$: 1,
            sort$: { t_c: 1 },
        });
        const task = tasks[0];
        if (!task?.id) {
            return null;
        }
        task.status = 'dispatched';
        task.dispatched_at = Date.now();
        await task.save$();
        await seneca.post(task.task_msg, { task });
        return task;
    }
}
// Default options.
const defaults = {
    // TODO: Enable debug logging
    debug: false,
    rootExecute: true,
    rootEntity: 'sys/user',
    relations: {
        parental: [],
    },
    customRef: {},
};
Object.assign(Traverse, { defaults });
exports.default = Traverse;
if ('undefined' !== typeof module) {
    module.exports = Traverse;
}
//# sourceMappingURL=Traverse.js.map