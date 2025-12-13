"use strict";
/* Copyright © 2025 Seneca Project Contributors, MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
const gubu_1 = require("gubu");
function Traverse(options) {
    const seneca = this;
    options.relations.parental.push(['sys/traverse', 'sys/traversetask']);
    // const { Default } = seneca.valid
    seneca
        .fix('sys:traverse')
        .message('on:run,do:create', {
        rootEntity: (0, gubu_1.Optional)(String),
        rootEntityId: String,
        taskMsg: String,
    }, msgCreateTaskRun)
        .message('on:run,do:start', {
        runId: String,
    }, msgRunStart)
        .message('on:task,do:execute', {
        task: Object,
    }, msgTaskExecute)
        .message('find:deps', {
        rootEntity: (0, gubu_1.Optional)(String),
    }, msgFindDeps)
        .message('find:children', {
        rootEntity: (0, gubu_1.Optional)(String),
        rootEntityId: String,
    }, msgFindChildren);
    // Start a run process execution for all
    // its pending children tasks.
    async function msgRunStart(msg) {
        const runId = msg.runId;
        const runEnt = await seneca.entity('sys/traverse').load$({
            id: runId,
        });
        if (!runEnt?.id) {
            return { ok: false, why: 'run-entity-not-found' };
        }
        const nextTask = await seneca.entity('sys/traversetask').load$({
            run_id: runEnt.id,
            status: 'pending',
        });
        if (!nextTask?.id) {
            runEnt.status = 'completed';
            runEnt.completed_at = Date.now();
            await runEnt.save$();
            return { ok: true };
        }
        runEnt.status = 'running';
        runEnt.started_at = Date.now();
        await runEnt.save$();
        await seneca.post('sys:traverse,on:task,do:execute', {
            task: nextTask,
        });
        return { ok: true, run: runEnt };
    }
    // Create a run process and generate tasks
    // for each child entity to be executed.
    async function msgCreateTaskRun(msg) {
        const taskMsg = msg.taskMsg;
        const rootEntity = msg.rootEntity || options.rootEntity;
        const rootEntityId = msg.rootEntityId;
        let runEnt = await seneca.entity('sys/traverse').save$({
            root_entity: rootEntity,
            root_id: rootEntityId,
            status: 'created',
            task_msg: taskMsg,
            total_tasks: 0,
            completed_tasks: 0,
            failed_tasks: 0,
        });
        const findChildrenRes = await seneca.post('sys:traverse,find:children', {
            rootEntity,
            rootEntityId,
        });
        const tasksCreationPromises = [];
        findChildrenRes.children.forEach((child) => {
            tasksCreationPromises.push(seneca.entity('sys/traversetask').save$({
                run_id: runEnt.id,
                parent_id: child.parent_id,
                child_id: child.child_id,
                parent_canon: child.parent_canon,
                child_canon: child.child_canon,
                status: 'pending',
                retry: 0,
                task_msg: runEnt.task_msg,
            }));
        });
        const tasksCreationRes = await Promise.allSettled(tasksCreationPromises);
        let taskSuccessCount = 0;
        let taskFailedCount = 0;
        tasksCreationRes.forEach((taskCreation, idx) => {
            if (taskCreation.status === 'fulfilled') {
                taskSuccessCount++;
            }
            else {
                taskFailedCount++;
                const childrenData = findChildrenRes.children[idx];
                // TODO: add proper logging and retry
                console.error('task create failed for child_canon: ' +
                    childrenData.child_canon +
                    ' - child_id: ' +
                    childrenData.child_id +
                    ' - error: ' +
                    taskCreation.reason);
            }
        });
        runEnt.total_tasks = taskSuccessCount;
        runEnt = await runEnt.save$();
        return {
            ok: true,
            run: runEnt,
            tasksCreated: taskSuccessCount,
            tasksFailed: taskFailedCount,
        };
    }
    // Execute a single task updating its
    // status afterwards.
    async function msgTaskExecute(msg) {
        const task = msg.task;
        if (!task?.id) {
            return { ok: false, why: 'task-not-found' };
        }
        task.status = 'dispatched';
        task.dispatched_at = Date.now();
        await task.save$();
        seneca.message(task.task_msg, async function (msg) {
            const seneca = this;
            const clientActMsg = await seneca.prior(msg);
            const previousTask = msg.task_entity;
            const taskRunParent = await seneca
                .entity('sys/traverse')
                .load$(previousTask.run_id);
            if (taskRunParent.status !== 'running') {
                return clientActMsg;
            }
            const nextTask = await seneca
                .entity('sys/traversetask')
                .load$({
                run_id: previousTask.run_id,
                status: 'pending',
            });
            if (!nextTask?.id) {
                taskRunParent.status = 'completed';
                await taskRunParent.save$();
                return clientActMsg;
            }
            await seneca.post('sys:traverse,on:task,do:execute', {
                task: nextTask,
            });
            return clientActMsg;
        });
        // enqueue or process the current task
        seneca.post(task.task_msg, {
            task_entity: task,
        });
        return { ok: true, task: task };
    }
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
}
// Default options.
const defaults = {
    // TODO: Enable debug logging
    debug: false,
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