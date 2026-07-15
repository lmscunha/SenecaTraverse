import type { Instance } from 'seneca';
/**
 * The Seneca instance.
 *
 * Seneca is not strictly typed: its exported `Instance` resolves to
 * `Record<string, any>`, so member access is effectively untyped. We alias it
 * here to mark every `this`/`seneca` boundary as a deliberate, contained
 * exception to the project's otherwise-strict typing, rather than scattering
 * bare `any` across the codebase.
 */
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
    started_at?: Timestamp;
    completed_at?: Timestamp;
} & Entity;
/** Task entity (sys/traversetask) — one unit of work within a run. */
export type TaskEntity = {
    id: UUID;
    run_id: UUID;
    status: 'pending' | 'dispatched' | 'done';
    task_msg: Message;
    dispatched_at?: Timestamp;
    done_at?: Timestamp;
    result?: unknown;
    fragment?: unknown;
} & ChildInstance & Entity;
export type TraverseOptionsFull = {
    debug: boolean;
    rootExecute: boolean;
    rootEntity: EntityID;
    mode: 'sync' | 'async';
    relations: {
        parental: Parental;
    };
    customRef: Record<EntityID, string>;
};
export type TraverseOptions = Partial<TraverseOptionsFull>;
/** Input for find:deps message */
export interface FindDepsInput {
    rootEntity?: EntityID;
}
/** Input for find:children message */
export interface FindChildrenInput {
    rootEntity?: EntityID;
    rootEntityId: UUID;
}
/** Input for on:run,do:create message */
export interface CreateTaskRunInput {
    rootEntity?: EntityID;
    rootEntityId: UUID;
    taskMsg: Message;
}
/** Input for on:task,do:execute message */
export interface TaskExecuteInput {
    task: TaskEntity;
}
/** Input for do:dispatch,on:task message */
export interface DispatchInput {
    task: TaskEntity;
}
/** Input for on:run,do:start message */
export interface RunStartInput {
    runId: string;
}
/** Input for on:run,do:stop message */
export interface RunStopInput {
    runId: string;
}
/** Input for on:task,do:complete message */
export interface TaskCompleteInput {
    taskId: string;
    result?: unknown;
    fragment?: unknown;
}
/** Input for on:run,did:complete message */
export interface RunDidCompleteInput {
    run: RunEntity;
}
/** Input for on:run,do:claim message */
export interface RunClaimInput {
    run: RunEntity;
}
/** Base result type */
export interface BaseResult {
    ok: boolean;
}
/** Invalid/error result */
export interface InvalidResult extends BaseResult {
    ok: false;
    why: string;
    error?: Record<string, any>;
}
/** Result for find:deps message */
export interface FindDepsResult extends BaseResult {
    ok: true;
    deps: ParentChildRelation[];
}
/** Result for find:children message */
export interface FindChildrenResult extends BaseResult {
    ok: true;
    children: ChildInstance[];
}
/** Result for on:run,do:create message */
export interface CreateTaskRunResult extends BaseResult {
    ok: true;
    run: RunEntity;
    tasksCreated: number;
    tasksFailed: number;
}
/** Result for on:task,do:execute message */
export interface TaskExecuteResult extends BaseResult {
    ok: true;
}
/** Result for do:dispatch,on:task message */
export interface DispatchResult extends BaseResult {
    ok: true;
}
/** Result for on:run,do:start message */
export interface RunStartResult extends BaseResult {
    ok: true;
    run: RunEntity;
}
/** Result for on:run,do:stop message */
export interface RunStopResult extends BaseResult {
    ok: true;
    run: RunEntity;
}
/** Result for on:task,do:complete message */
export interface TaskCompleteResult extends BaseResult {
    ok: true;
}
/** Result for on:run,did:complete message */
export interface RunDidCompleteResult extends BaseResult {
    ok: true;
}
/**
 * Result for on:run,do:claim message.
 * `claimed` is true for exactly one caller — the one that won the transition to
 * `completed`. The default impl is best-effort (load-count-set); hosts running
 * concurrent distributed workers over large task volumes should override
 * on:run,do:claim with a store-level conditional write (e.g. DynamoDB
 * attribute_not_exists) to make the claim atomic and guarantee a single
 * did:complete without scanning every task.
 */
export interface RunClaimResult extends BaseResult {
    ok: true;
    claimed: boolean;
    run: RunEntity;
}
export type MsgFindDepsFn = (msg: FindDepsInput) => Promise<FindDepsResult>;
export type MsgFindChildrenFn = (msg: FindChildrenInput) => Promise<FindChildrenResult>;
export type MsgCreateTaskRunFn = (msg: CreateTaskRunInput) => Promise<CreateTaskRunResult>;
export type MsgTaskExecuteFn = (msg: TaskExecuteInput) => Promise<TaskExecuteResult>;
export type MsgDispatchFn = (msg: DispatchInput) => Promise<DispatchResult>;
export type MsgRunStartFn = (msg: RunStartInput) => Promise<RunStartResult | InvalidResult>;
export type MsgRunStopFn = (msg: RunStopInput) => Promise<RunStopResult | InvalidResult>;
export type MsgTaskCompleteFn = (msg: TaskCompleteInput) => Promise<TaskCompleteResult>;
export type MsgRunDidCompleteFn = (msg: RunDidCompleteInput) => Promise<RunDidCompleteResult>;
export type MsgRunClaimFn = (msg: RunClaimInput) => Promise<RunClaimResult>;
/** Traverse plugin function */
export interface TraversePlugin {
    (this: Seneca, options: TraverseOptionsFull): void;
    defaults: TraverseOptionsFull;
}
//# sourceMappingURL=types.d.ts.map