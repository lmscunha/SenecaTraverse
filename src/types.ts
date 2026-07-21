/* Copyright © 2026 Seneca Project Contributors, MIT License. */

import type { Instance } from 'seneca'

// ============================================================================
// Base Types
// ============================================================================

// Seneca's `Instance` is effectively untyped (`Record<string, any>`); aliasing
// marks every `this`/`seneca` boundary as a contained exception to strict typing.
export type Seneca = Instance

export type EntityID = string
export type UUID = string
export type Timestamp = number
export type Message = string | object

/** A directed parent -> child relation between two entity canons. */
export type ParentChildRelation = [EntityID, EntityID]
export type Parental = ParentChildRelation[]

// ============================================================================
// Entity Types
// ============================================================================

/** A discovered child instance together with its parent relationship. */
export type ChildInstance = {
  parent_id: UUID
  child_id: UUID
  parent_canon: EntityID
  child_canon: EntityID
}

/** Seneca entity persistence surface used by this plugin. */
export type Entity = {
  save$: Function
  load$: Function
  list$: Function
  remove$: Function
}

/** Run entity (sys/traverse) — one traversal process. */
export type RunEntity = {
  id: UUID
  root_entity: EntityID
  root_id: UUID
  task_msg: Message
  status: 'created' | 'active' | 'completed' | 'stopped'
  total_tasks: number
  completed_tasks: number
  started_at?: Timestamp
  completed_at?: Timestamp
} & Entity

/** Task entity (sys/traversetask) — one unit of work within a run. */
export type TaskEntity = {
  id: UUID
  run_id: UUID
  status: 'pending' | 'dispatched' | 'done'
  task_msg: Message
  // Depth from the root (root = 0). Dispatch orders tasks by `seq`: ascending
  // (topological) by default, or deepest-first when the `reverse` option is set.
  seq: number
  dispatched_at?: Timestamp
  done_at?: Timestamp
  result?: unknown
  // App-defined slice (e.g. a PII fragment) the host accumulates across a run.
  fragment?: unknown
} & ChildInstance &
  Entity

// ============================================================================
// Options Types
// ============================================================================

export type TraverseOptionsFull = {
  debug: boolean
  rootExecute: boolean
  rootEntity: EntityID
  // false (default) = topological, shallowest first. true = deepest first.
  reverse: boolean
  // Await the per-task dispatch instead of firing it and returning. Set true on
  // freeze-on-return hosts (e.g. AWS Lambda SQS) where a fire-and-forget dispatch
  // is killed mid-save; awaiting flushes the save + transport send first.
  awaitDispatch: boolean
  // Allowlist of task_msg patterns do:create may schedule. Empty = allow any;
  // set it when do:create is reachable from untrusted input.
  taskMsgAllow: string[]
  relations: {
    parental: Parental
  }
  customRef: Record<EntityID, string>
}

export type TraverseOptions = Partial<TraverseOptionsFull>

// ============================================================================
// Message Input Types
// ============================================================================

export interface FindDepsInput {
  rootEntity?: EntityID
}

export interface FindChildrenInput {
  rootEntity?: EntityID
  rootEntityId: UUID
}

export interface CreateTaskRunInput {
  rootEntity?: EntityID
  rootEntityId: UUID
  taskMsg: Message
}

export interface TaskExecuteInput {
  task: TaskEntity
}

export interface DispatchInput {
  task: TaskEntity
}

export interface RunStartInput {
  runId: string
}

export interface RunStopInput {
  runId: string
}

export interface TaskCompleteInput {
  taskId: string
  result?: unknown
  fragment?: unknown
}

export interface RunDidCompleteInput {
  run: RunEntity
}

export interface RunClaimInput {
  run: RunEntity
}

// ============================================================================
// Message Output Types
// ============================================================================

export interface BaseResult {
  ok: boolean
}

export interface InvalidResult extends BaseResult {
  ok: false
  why: string
  error?: Record<string, any>
}

export interface FindDepsResult extends BaseResult {
  ok: true
  deps: ParentChildRelation[]
}

export interface FindChildrenResult extends BaseResult {
  ok: true
  children: ChildInstance[]
}

export interface CreateTaskRunResult extends BaseResult {
  ok: true
  run: RunEntity
  tasksCreated: number
  tasksFailed: number
}

/** Result when on:run,do:create rolls back after task-create failures. */
export interface CreateTaskRunRollbackResult extends BaseResult {
  ok: false
  why: 'task-create-failed'
  tasksCreated: 0
  tasksFailed: number
}

export interface TaskExecuteResult extends BaseResult {
  ok: true
}

export interface DispatchResult extends BaseResult {
  ok: true
}

export interface RunStartResult extends BaseResult {
  ok: true
  run: RunEntity
}

export interface RunStopResult extends BaseResult {
  ok: true
  run: RunEntity
}

export interface TaskCompleteResult extends BaseResult {
  ok: true
  // Absent when the completion referenced an unknown task.
  doneTasks?: number
  // Absent for an unknown-task no-op.
  run?: RunEntity
}

export interface RunDidCompleteResult extends BaseResult {
  ok: true
}

export interface RunClaimResult extends BaseResult {
  ok: true
  claimed: boolean
  run: RunEntity
}

// ============================================================================
// Message Handler Types
// ============================================================================

export type MsgFindDepsFn = (msg: FindDepsInput) => Promise<FindDepsResult>
export type MsgFindChildrenFn = (
  msg: FindChildrenInput,
) => Promise<FindChildrenResult>
export type MsgCreateTaskRunFn = (
  msg: CreateTaskRunInput,
) => Promise<CreateTaskRunResult | CreateTaskRunRollbackResult | InvalidResult>
export type MsgTaskExecuteFn = (
  msg: TaskExecuteInput,
) => Promise<TaskExecuteResult>
export type MsgDispatchFn = (msg: DispatchInput) => Promise<DispatchResult>
export type MsgRunStartFn = (
  msg: RunStartInput,
) => Promise<RunStartResult | InvalidResult>
export type MsgRunStopFn = (
  msg: RunStopInput,
) => Promise<RunStopResult | InvalidResult>
export type MsgTaskCompleteFn = (
  msg: TaskCompleteInput,
) => Promise<TaskCompleteResult>
export type MsgRunDidCompleteFn = (
  msg: RunDidCompleteInput,
) => Promise<RunDidCompleteResult>
export type MsgRunClaimFn = (msg: RunClaimInput) => Promise<RunClaimResult>

// ============================================================================
// Plugin Export Type
// ============================================================================

export interface TraversePlugin {
  (this: Seneca, options: TraverseOptionsFull): void
  defaults: TraverseOptionsFull
}
