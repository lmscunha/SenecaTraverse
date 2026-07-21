import type { Instance } from 'seneca';
export type Seneca = Instance;
export type EntityID = string;
export type UUID = string;
export type Timestamp = number;
export type Message = string | object;
/** A directed parent -> child relation between two entity canons. */
export type ParentChildRelation = [EntityID, EntityID];
export type Parental = ParentChildRelation[];
/** A discovered child instance together with its parent relationship. */
export type ChildInstance = {
    parent_id: UUID;
    child_id: UUID;
    parent_canon: EntityID;
    child_canon: EntityID;
};
/** Seneca entity persistence surface used by this plugin. */
export type Entity = {
    save$: Function;
    load$: Function;
    list$: Function;
    remove$: Function;
};
/** Run entity (sys/traverse) — one traversal process. */
export type RunEntity = {
    id: UUID;
    root_entity: EntityID;
    root_id: UUID;
    task_msg: Message;
    status: 'created' | 'active' | 'completed' | 'stopped';
    total_tasks: number;
    completed_tasks: number;
    started_at?: Timestamp;
    completed_at?: Timestamp;
} & Entity;
/** Task entity (sys/traversetask) — one unit of work within a run. */
export type TaskEntity = {
    id: UUID;
    run_id: UUID;
    status: 'pending' | 'dispatched' | 'done';
    task_msg: Message;
    seq: number;
    dispatched_at?: Timestamp;
    done_at?: Timestamp;
    result?: unknown;
    fragment?: unknown;
} & ChildInstance & Entity;
export type TraverseOptionsFull = {
    debug: boolean;
    rootExecute: boolean;
    rootEntity: EntityID;
    reverse: boolean;
    awaitDispatch: boolean;
    taskMsgAllow: string[];
    relations: {
        parental: Parental;
    };
    customRef: Record<EntityID, string>;
};
export type TraverseOptions = Partial<TraverseOptionsFull>;
export interface FindDepsInput {
    rootEntity?: EntityID;
}
export interface FindChildrenInput {
    rootEntity?: EntityID;
    rootEntityId: UUID;
}
export interface CreateTaskRunInput {
    rootEntity?: EntityID;
    rootEntityId: UUID;
    taskMsg: Message;
}
export interface TaskExecuteInput {
    task: TaskEntity;
}
export interface DispatchInput {
    task: TaskEntity;
}
export interface RunStartInput {
    runId: string;
}
export interface RunStopInput {
    runId: string;
}
export interface TaskCompleteInput {
    taskId: string;
    result?: unknown;
    fragment?: unknown;
}
export interface RunDidCompleteInput {
    run: RunEntity;
}
export interface RunClaimInput {
    run: RunEntity;
}
export interface BaseResult {
    ok: boolean;
}
export interface InvalidResult extends BaseResult {
    ok: false;
    why: string;
    error?: Record<string, any>;
}
export interface FindDepsResult extends BaseResult {
    ok: true;
    deps: ParentChildRelation[];
}
export interface FindChildrenResult extends BaseResult {
    ok: true;
    children: ChildInstance[];
}
export interface CreateTaskRunResult extends BaseResult {
    ok: true;
    run: RunEntity;
    tasksCreated: number;
    tasksFailed: number;
}
/** Result when on:run,do:create rolls back after task-create failures. */
export interface CreateTaskRunRollbackResult extends BaseResult {
    ok: false;
    why: 'task-create-failed';
    tasksCreated: 0;
    tasksFailed: number;
}
export interface TaskExecuteResult extends BaseResult {
    ok: true;
}
export interface DispatchResult extends BaseResult {
    ok: true;
}
export interface RunStartResult extends BaseResult {
    ok: true;
    run: RunEntity;
}
export interface RunStopResult extends BaseResult {
    ok: true;
    run: RunEntity;
}
export interface TaskCompleteResult extends BaseResult {
    ok: true;
    doneTasks?: number;
    run?: RunEntity;
}
export interface RunDidCompleteResult extends BaseResult {
    ok: true;
}
export interface RunClaimResult extends BaseResult {
    ok: true;
    claimed: boolean;
    run: RunEntity;
}
export type MsgFindDepsFn = (msg: FindDepsInput) => Promise<FindDepsResult>;
export type MsgFindChildrenFn = (msg: FindChildrenInput) => Promise<FindChildrenResult>;
export type MsgCreateTaskRunFn = (msg: CreateTaskRunInput) => Promise<CreateTaskRunResult | CreateTaskRunRollbackResult | InvalidResult>;
export type MsgTaskExecuteFn = (msg: TaskExecuteInput) => Promise<TaskExecuteResult>;
export type MsgDispatchFn = (msg: DispatchInput) => Promise<DispatchResult>;
export type MsgRunStartFn = (msg: RunStartInput) => Promise<RunStartResult | InvalidResult>;
export type MsgRunStopFn = (msg: RunStopInput) => Promise<RunStopResult | InvalidResult>;
export type MsgTaskCompleteFn = (msg: TaskCompleteInput) => Promise<TaskCompleteResult>;
export type MsgRunDidCompleteFn = (msg: RunDidCompleteInput) => Promise<RunDidCompleteResult>;
export type MsgRunClaimFn = (msg: RunClaimInput) => Promise<RunClaimResult>;
export interface TraversePlugin {
    (this: Seneca, options: TraverseOptionsFull): void;
    defaults: TraverseOptionsFull;
}
//# sourceMappingURL=types.d.ts.map