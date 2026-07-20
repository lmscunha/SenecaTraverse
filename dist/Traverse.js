"use strict";
/* Copyright © 2026 Seneca Project Contributors, MIT License. */
Object.defineProperty(exports, "__esModule", { value: true });
const shape_1 = require("shape");
// `shape` (formerly `gubu`) builder nodes differ from the gubu bundled inside
// seneca, so they can't be embedded in `plugin.defaults` or `.message()` arg
// schemas — those are validated by seneca's own bundled gubu. Use shape only
// for standalone option validation, and seneca.util.Gubu for message schemas.
const validateMode = (0, shape_1.Shape)((0, shape_1.Exact)('sync', 'async'));
function Traverse(options) {
    const seneca = this;
    const { Optional } = seneca.util.Gubu;
    // seneca merges `defaults` (mode: 'sync') before calling the plugin, so
    // options.mode is always set here; reject anything outside the enum.
    validateMode(options.mode);
    // Normalize whatever an `on:task` handler receives into a live task entity.
    // In-process the arg is already an entity — pass it through so callers keep
    // sharing one instance (the double-dispatch guard relies on that identity).
    // Over a real transport the arg arrives as a plain object whose `save$`/
    // `load$` methods didn't survive serialization; rebuild a live entity from
    // the data so persistence still works in distributed mode.
    function hydrateTask(raw) {
        if (raw && typeof raw.save$ === 'function') {
            return raw;
        }
        return seneca.entity('sys/traversetask').data$(raw);
    }
    // A Run process can have multiple tasks as children.
    // Thus, this plugin automatically maps these relations for the client.
    options.customRef = { ...options.customRef, 'sys/traversetask': 'run_id' };
    // Build a new array instead of pushing in place: the incoming options may
    // share the defaults' `parental` reference, and mutating it would leak the
    // injected relation across plugin loads (accumulating duplicates).
    options.relations = {
        ...options.relations,
        parental: [
            ...options.relations.parental,
            ['sys/traverse', 'sys/traversetask'],
        ],
    };
    seneca
        .fix('sys:traverse')
        .message('find:deps', {
        rootEntity: Optional(String),
    }, msgFindDeps)
        .message('find:children', {
        rootEntity: Optional(String),
        rootEntityId: String,
    }, msgFindChildren)
        .message('on:run,do:create', {
        rootEntity: Optional(String),
        rootEntityId: String,
        taskMsg: String,
    }, msgCreateTaskRun)
        .message('on:task,do:execute', {
        task: Object,
    }, msgTaskExecute)
        .message('do:dispatch,on:task', {
        task: Object,
    }, msgDispatch)
        .message('on:run,do:start', {
        runId: String,
    }, msgRunStart)
        .message('on:run,do:stop', {
        runId: String,
    }, msgRunStop)
        .message('on:task,do:complete', {
        taskId: String,
    }, msgTaskComplete)
        .message('on:run,did:complete', { run: Object }, msgRunDidComplete)
        .message('on:run,do:claim', { run: Object }, msgRunClaim);
    // Returns a sorted list of entity pairs
    // starting from a given entity.
    // In breadth-first order, sorting first by level,
    // then alphabetically in each level.
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
        // `task_msg` is later dispatched as an arbitrary Seneca pattern. When an
        // allowlist is configured, refuse patterns outside it so untrusted callers
        // can't schedule arbitrary actions.
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
            // TODO: add retry
            seneca.log.error('task-create-failed', {
                child_canon: childrenData?.child_canon,
                child_id: childrenData?.child_id,
                err: taskCreation.reason,
            });
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
        const task = hydrateTask(msg.task);
        if (task.status == 'done' || task.status == 'dispatched') {
            return { ok: true };
        }
        task.status = 'dispatched';
        task.dispatched_at = Date.now();
        await task.save$();
        await seneca.post('sys:traverse,do:dispatch,on:task', { task });
        return { ok: true };
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
        const findChildrenRes = await seneca.post('sys:traverse,find:children', {
            rootEntity: 'sys/traverse',
            rootEntityId: run.id,
        });
        const runTasksSpec = findChildrenRes.children;
        if (options.mode === 'async') {
            const tasks = await Promise.all(runTasksSpec.map((taskSpec) => seneca.entity('sys/traversetask').load$(taskSpec.child_id)));
            for (const task of tasks) {
                if (!task || task.status === 'done' || task.status === 'dispatched') {
                    continue;
                }
                // Fire-and-forget: async mode returns without awaiting task
                // completion. A rejected dispatch must not become an unhandled
                // rejection or abort the fan-out of remaining tasks.
                seneca
                    .post('sys:traverse,on:task,do:execute', { task })
                    .catch((err) => seneca.log.error('async-dispatch-failed', {
                    task_id: task.id,
                    err,
                }));
            }
            // Nothing was dispatched (zero tasks, or all already done on a restart):
            // the fan-out never routes through the barrier, so complete here — this
            // also emits did:complete for empty runs. In-flight dispatches are not
            // yet done, so a live run is not falsely completed.
            await checkAndCompleteRun(run.id);
            // Reload so the returned run reflects a same-tick completion (empty run);
            // a run with pending tasks stays 'active' here and completes later.
            const startedRun = await seneca
                .entity('sys/traverse')
                .load$(run.id);
            return { ok: true, run: startedRun };
        }
        processRunTasks(run, runTasksSpec);
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
    async function msgDispatch(msg) {
        const task = hydrateTask(msg.task);
        await seneca.post(task.task_msg, { task });
        // Default in-process dispatch owns completion: signal the barrier once the
        // task's message returns. Hosts that override this pin to route to an
        // external transport (e.g. SQS) must have their remote worker call
        // on:task,do:complete instead — that is the single completion path.
        await seneca.post('sys:traverse,on:task,do:complete', { taskId: task.id });
        return { ok: true };
    }
    // Completion barrier — the single path both sync and async runs travel to
    // completion. The host (or the default dispatch) signals a finished task,
    // storing optional result/fragment; the run advances to completed once every
    // task has reported done (via the overridable claim pin). Idempotent: a
    // missing task returns ok — an at-least-once transport may redeliver a
    // completion after cleanup, and that must not become a poison message.
    async function msgTaskComplete(msg) {
        const task = await seneca
            .entity('sys/traversetask')
            .load$(msg.taskId);
        if (!task) {
            return { ok: true };
        }
        if (task.status !== 'done') {
            task.status = 'done';
            task.done_at = Date.now();
            if (msg.result !== undefined)
                task.result = msg.result;
            if (msg.fragment !== undefined)
                task.fragment = msg.fragment;
            await task.save$();
        }
        await checkAndCompleteRun(task.run_id);
        return { ok: true };
    }
    // Overridable hook fired exactly once per run, when it reaches completed.
    // Default is a no-op; hosts override to trigger downstream work (e.g. post an
    // SQS message to assemble the run's collected fragments).
    async function msgRunDidComplete(_msg) {
        return { ok: true };
    }
    // Default completion claim: best-effort load-count-set. Transitions an active
    // run to `completed` only when all its tasks are done, and reports whether
    // THIS call won the transition. Concentrating the check-and-set in one
    // overridable pin lets hosts with concurrent distributed workers swap in a
    // store-level conditional write (e.g. DynamoDB attribute_not_exists) so the
    // claim is atomic and did:complete fires exactly once. Counts by id only to
    // keep the scan light on large runs.
    async function msgRunClaim(msg) {
        const run = await seneca
            .entity('sys/traverse')
            .load$(msg.run.id);
        if (!run || run.status !== 'active') {
            return { ok: true, claimed: false, run };
        }
        const doneTasks = await seneca
            .entity('sys/traversetask')
            .list$({ run_id: run.id, status: 'done', fields$: ['id'] });
        if (doneTasks.length < run.total_tasks) {
            return { ok: true, claimed: false, run };
        }
        run.status = 'completed';
        run.completed_at = Date.now();
        await run.save$();
        return { ok: true, claimed: true, run };
    }
    // Attempt to complete a run through the (overridable) claim pin, emitting
    // did:complete only for the caller that wins the claim — so the hook fires
    // exactly once per run regardless of how many tasks report done concurrently.
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
    async function processRunTasks(runEnt, tasks) {
        if (tasks.length === 0) {
            await checkAndCompleteRun(runEnt.id);
            return;
        }
        let run = runEnt;
        for (const taskToProcess of tasks) {
            run = await seneca
                .entity(taskToProcess.parent_canon)
                .load$(taskToProcess.parent_id);
            if (!run || run.status === 'stopped') {
                break;
            }
            const task = await seneca
                .entity('sys/traversetask')
                .load$(taskToProcess.child_id);
            if (!task) {
                continue;
            }
            const canProcessNextTask = task.status !== 'dispatched' && task.status !== 'done';
            if (!canProcessNextTask) {
                continue;
            }
            // do:execute → do:dispatch → (default) do:complete, so each task drives
            // itself through the barrier; the last one completes the run.
            await seneca.post('sys:traverse,on:task,do:execute', {
                task,
            });
        }
        // Safety net: covers restarts where every task was already done and skipped
        // the dispatch path, so no do:complete ran in the loop body.
        await checkAndCompleteRun(runEnt.id);
    }
}
// Default options.
const defaults = {
    // TODO: Enable debug logging
    debug: false,
    rootExecute: true,
    rootEntity: 'sys/user',
    mode: 'sync',
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