"use strict";
/* Copyright © 2026 Seneca Project Contributors, MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
const shape_1 = require("shape");
// Payload shapes for messages whose `.message()` schema can only say `Object`.
// Seneca validates each message arg with its bundled Gubu — that covers
// required + type, but not enum membership or nested entity structure. A `task`
// or `run` arriving over a transport is otherwise unchecked beyond "is an
// object". These shapes add the domain constraints Gubu can't express. The
// outer/inner `Open` let Seneca meta fields and the live entity's save$/load$
// methods pass through untouched.
const taskMsgShape = (0, shape_1.Shape)((0, shape_1.Open)({
    task: (0, shape_1.Open)({
        run_id: String,
        // Only read for ordering in dispatchNext, not from the message — so
        // skippable, but non-negative when a task does carry it.
        seq: (0, shape_1.Skip)((0, shape_1.Min)(0, Number)),
        status: (0, shape_1.Exact)('pending', 'dispatched', 'done'),
    }),
}));
const runMsgShape = (0, shape_1.Shape)((0, shape_1.Open)({
    run: (0, shape_1.Open)({
        status: (0, shape_1.Exact)('created', 'active', 'completed', 'stopped'),
    }),
}));
// Validate a message payload with `shape` before the handler runs. Used only
// where the constraint is richer than the native `.message()` schema (see
// above). Shape throws a detailed ShapeError on mismatch, which Seneca surfaces
// as an invalid-message action error.
function shaped(shape, fn) {
    return function (msg) {
        shape(msg);
        return fn.call(this, msg);
    };
}
function Traverse(options) {
    const seneca = this;
    // A task may cross a transport first; whether it keeps its save$/load$ methods
    // depends on the transport (e.g. AWS SQS strips them to plain JSON). Rebuild
    // only when missing — the save$ guard reuses a method-preserving entity as-is,
    // so it's never double-wrapped.
    function createTaskEntity(raw) {
        if (raw && typeof raw.save$ === 'function') {
            return raw;
        }
        return seneca.entity('sys/traversetask').data$(raw);
    }
    options.customRef = { ...options.customRef, 'sys/traversetask': 'run_id' };
    // New array, not push: parental may be the caller's (or shared defaults')
    // array — mutating it would append this relation again on a second .use().
    options.relations = {
        ...options.relations,
        parental: [
            ...options.relations.parental,
            ['sys/traverse', 'sys/traversetask'],
        ],
    };
    seneca
        .fix('sys:traverse')
        .message('find:deps', {}, msgFindDeps)
        .message('find:children', { rootEntityId: String }, msgFindChildren)
        .message('on:run,do:create', { rootEntityId: String, taskMsg: String }, msgCreateTaskRun)
        .message('on:task,do:execute', { task: Object }, shaped(taskMsgShape, msgTaskExecute))
        .message('on:task,do:dispatch', { task: Object }, shaped(taskMsgShape, msgDispatch))
        .message('on:task,do:complete', { taskId: String }, msgTaskComplete)
        .message('on:run,do:start', { runId: String }, msgRunStart)
        .message('on:run,do:stop', { runId: String }, msgRunStop)
        .message('on:run,did:complete', { run: Object }, shaped(runMsgShape, msgRunDidComplete))
        .message('on:run,do:claim', { run: Object }, shaped(runMsgShape, msgRunClaim));
    // Entity pairs from a root, breadth-first, sorted by level then name.
    async function msgFindDeps(msg) {
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
    // All child instances with their parent relationship.
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
    // Create a run and one task per child entity (topological order).
    async function msgCreateTaskRun(msg) {
        const taskMsg = msg.taskMsg;
        const rootEntity = msg.rootEntity || options.rootEntity;
        const rootEntityId = msg.rootEntityId;
        const isRootIncluded = options.rootExecute;
        // task_msg is dispatched as an arbitrary Seneca pattern; gate it when set.
        const taskMsgAllow = options.taskMsgAllow;
        if (taskMsgAllow.length > 0 && !taskMsgAllow.includes(taskMsg)) {
            seneca.log.error('task-msg-not-allowed', { task_msg: taskMsg });
            return { ok: false, why: 'task-msg-not-allowed' };
        }
        const run = await seneca.entity('sys/traverse').save$({
            root_entity: rootEntity,
            root_id: rootEntityId,
            status: 'created',
            task_msg: taskMsg,
            total_tasks: 0,
            completed_tasks: 0,
        });
        const findChildrenRes = await seneca.post('sys:traverse,find:children', {
            rootEntity,
            rootEntityId,
        });
        // Depth per canon (parent + 1), stamped on each task as `seq`; dispatch
        // orders by it (topological, or deepest-first when `reverse`).
        const depthByCanon = new Map([[rootEntity, 0]]);
        for (const child of findChildrenRes.children) {
            if (!depthByCanon.has(child.child_canon)) {
                depthByCanon.set(child.child_canon, (depthByCanon.get(child.parent_canon) ?? 0) + 1);
            }
        }
        const taskSpecs = [];
        if (isRootIncluded) {
            taskSpecs.push({
                parent_id: rootEntityId,
                child_id: rootEntityId,
                parent_canon: rootEntity,
                child_canon: rootEntity,
                seq: 0,
            });
        }
        for (const child of findChildrenRes.children) {
            taskSpecs.push({
                ...child,
                seq: depthByCanon.get(child.child_canon) ?? 0,
            });
        }
        const tasksCreationRes = await Promise.allSettled(taskSpecs.map((spec) => seneca.entity('sys/traversetask').save$({
            run_id: run.id,
            parent_id: spec.parent_id,
            child_id: spec.child_id,
            parent_canon: spec.parent_canon,
            child_canon: spec.child_canon,
            seq: spec.seq,
            status: 'pending',
            task_msg: run.task_msg,
        })));
        const createdTasks = [];
        let taskFailedCount = 0;
        tasksCreationRes.forEach((taskCreation, idx) => {
            const spec = taskSpecs[idx];
            if (taskCreation.status === 'fulfilled') {
                createdTasks.push(taskCreation.value);
                return;
            }
            taskFailedCount++;
            seneca.log.error('task-create-failed', {
                child_canon: spec.child_canon,
                child_id: spec.child_id,
                err: taskCreation.reason,
            });
        });
        if (taskFailedCount > 0) {
            // Roll back so no run starts from a partial task set.
            const rollback = await Promise.allSettled([
                ...createdTasks.map((t) => t.remove$()),
                run.remove$(),
            ]);
            // Best-effort: log a failed removal so a leak is observable.
            for (const outcome of rollback) {
                if (outcome.status === 'rejected') {
                    seneca.log.error('task-create-rollback-failed', {
                        run_id: run.id,
                        err: outcome.reason,
                    });
                }
            }
            return {
                ok: false,
                why: 'task-create-failed',
                tasksCreated: 0,
                tasksFailed: taskFailedCount,
            };
        }
        run.total_tasks = createdTasks.length;
        await run.save$();
        return {
            ok: true,
            run,
            tasksCreated: createdTasks.length,
            tasksFailed: 0,
        };
    }
    // Execute a single Run task.
    async function msgTaskExecute(msg) {
        const task = createTaskEntity(msg.task);
        if (task.status == 'done' || task.status == 'dispatched') {
            return { ok: true };
        }
        task.status = 'dispatched';
        task.dispatched_at = Date.now();
        await task.save$();
        await seneca.post('sys:traverse,on:task,do:dispatch', { task });
        return { ok: true };
    }
    // Deliver a task to its handler. Default posts in-process; a transport host
    // overrides this to enqueue. Either way the handler/worker posts do:complete
    // when the work is done, which chains the next task.
    async function msgDispatch(msg) {
        const task = createTaskEntity(msg.task);
        await seneca.post(task.task_msg, { task });
        return { ok: true };
    }
    async function msgTaskComplete(msg) {
        const task = await seneca
            .entity('sys/traversetask')
            .load$(msg.taskId);
        if (!task) {
            return { ok: true };
        }
        // Transition once — `done` is the idempotency marker against at-least-once
        // redelivery, so the counter can't advance or re-chain twice.
        if (task.status !== 'done') {
            task.status = 'done';
            task.done_at = Date.now();
            if (msg.result !== undefined)
                task.result = msg.result;
            if (msg.fragment !== undefined)
                task.fragment = msg.fragment;
            await task.save$();
            const run = await seneca
                .entity('sys/traverse')
                .load$(task.run_id);
            if (run) {
                run.completed_tasks = (run.completed_tasks ?? 0) + 1;
                await run.save$();
            }
            await dispatchNext(task.run_id);
        }
        // Reload: dispatchNext may have finalised the run (status/completed_at).
        const run = await seneca
            .entity('sys/traverse')
            .load$(task.run_id);
        return { ok: true, doneTasks: run?.completed_tasks, run };
    }
    // Start a run: dispatch the first pending task (order set by the `reverse`
    // option) and return; each completion chains the next, one task in flight.
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
        await dispatchNext(run.id);
        const startedRun = await seneca
            .entity('sys/traverse')
            .load$(run.id);
        return { ok: true, run: startedRun };
    }
    // Stop a run: halts dispatch of the next pending task.
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
    async function msgRunDidComplete(_msg) {
        return { ok: true };
    }
    // Overridable: a distributed host swaps in a store-level CAS so the run
    // completes exactly once.
    async function msgRunClaim(msg) {
        const run = await seneca.entity('sys/traverse').load$(msg.run.id);
        if (!run || run.status !== 'active') {
            return { ok: true, claimed: false, run };
        }
        if ((run.completed_tasks ?? 0) < run.total_tasks) {
            return { ok: true, claimed: false, run };
        }
        run.status = 'completed';
        run.completed_at = Date.now();
        await run.save$();
        return { ok: true, claimed: true, run };
    }
    // Claim the run, firing did:complete only for the winning caller.
    async function checkAndCompleteRun(runId) {
        const run = await seneca.entity('sys/traverse').load$(runId);
        if (!run || run.status !== 'active') {
            return;
        }
        const claimRes = await seneca.post('sys:traverse,on:run,do:claim', { run });
        if (claimRes.claimed) {
            await seneca.post('sys:traverse,on:run,did:complete', {
                run: claimRes.run,
            });
        }
    }
    // Dispatch the next pending task, or finalise the run when none remain. One
    // query — filtered to the run, ordered by seq, one row — never scans the whole
    // task table. `reverse` picks the direction: deepest-first (-1) or, by
    // default, shallowest-first (1, topological). Only ONE task is dispatched per
    // call; completion arrives out-of-band via do:complete, which chains the next,
    // keeping exactly one task in flight (so no counter lock).
    //
    // Dispatch is fire-and-forget by default so a run stays stoppable mid-flight.
    // With `awaitDispatch` the do:execute post is awaited instead, flushing the
    // task-row save + transport send inside the caller's live invocation — needed
    // on a host that tears down the moment it returns (e.g. an AWS Lambda SQS
    // consumer freezes after the handler resolves, killing an unawaited dispatch
    // mid-save so the task message is never sent and the run stalls).
    async function dispatchNext(runId) {
        const run = await seneca.entity('sys/traverse').load$(runId);
        if (!run || run.status !== 'active') {
            return;
        }
        const [next] = await seneca.entity('sys/traversetask').list$({
            run_id: runId,
            status: 'pending',
            sort$: { seq: options.reverse ? -1 : 1 },
            limit$: 1,
        });
        if (!next) {
            await checkAndCompleteRun(runId);
            return;
        }
        const dispatch = seneca
            .post('sys:traverse,on:task,do:execute', { task: next })
            .catch((err) => seneca.log.error('dispatch-failed', { task_id: next.id, err }));
        if (options.awaitDispatch) {
            await dispatch;
        }
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
    rootExecute: true,
    rootEntity: 'sys/user',
    reverse: false,
    awaitDispatch: false,
    taskMsgAllow: [],
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