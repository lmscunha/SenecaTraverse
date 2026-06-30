# @seneca/traverse

> _Seneca Traverse_ is a plugin for [Seneca](http://senecajs.org)

Data Traverse plugin for the Seneca framework.

[![npm version](https://img.shields.io/npm/v/@seneca/traverse.svg)](https://npmjs.com/package/@seneca/traverse)
[![build](https://github.com/senecajs/SenecaTraverse/actions/workflows/build.yml/badge.svg)](https://github.com/senecajs/SenecaTraverse/actions/workflows/build.yml)
[![Coverage Status](https://coveralls.io/repos/github/senecajs/SenecaTraverse/badge.svg?branch=main)](https://coveralls.io/github/senecajs/SenecaTraverse?branch=main)
[![Known Vulnerabilities](https://snyk.io/test/github/senecajs/SenecaTraverse/badge.svg)](https://snyk.io/test/github/senecajs/SenecaTraverse)
[![DeepScan grade](https://deepscan.io/api/teams/5016/projects/26547/branches/846930/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=5016&pid=26547&bid=846930)
[![Maintainability](https://api.codeclimate.com/v1/badges/3e5e5c11a17dbfbdd894/maintainability)](https://codeclimate.com/github/senecajs/SenecaTraverse/maintainability)

| ![Voxgig](https://www.voxgig.com/res/img/vgt01r.png) | This open source module is sponsored and supported by [Voxgig](https://www.voxgig.com). |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |

## Install

```sh
$ npm install @seneca/traverse
```

## Quick Example

```js
seneca.use('Traverse', {
  rootEntity: 'sys/user',
  mode: 'async',          // fire-and-forget dispatch
  scope: 'root',          // bypass principal-scoping for cross-org runs
  relations: {
    parental: [
      ['sys/user', 'sys/purchase'],
      ['sys/user', 'sys/profile'],
    ],
  },
})

// Override dispatch to push tasks onto a queue
seneca.message('sys:traverse,do:dispatch,on:task', async function(msg) {
  await sqs.sendMessage({ body: JSON.stringify(msg.task) })
  return { ok: true }
})

// Override completion hook to trigger downstream work
seneca.message('sys:traverse,on:run,did:complete', async function(msg) {
  await seneca.post('aim:ingest,build:report', { runId: msg.run.id })
  return { ok: true }
})

const createRes = await seneca.post('sys:traverse,on:run,do:create', {
  rootEntityId: userId,
  taskMsg: 'aim:user,collect:piiData',
})
// createRes === { ok: true, run, tasksCreated: N, tasksFailed: 0 }

await seneca.post('sys:traverse,on:run,do:start', { runId: createRes.run.id })
// returns immediately in async mode; tasks run in background
```

## More Examples

Review the [unit tests](test/) for more examples.

<!--START:options-->

## Options

- `debug` : boolean
- `rootExecute` : boolean — include root entity as a task (default `true`)
- `rootEntity` : string — default root entity canon (default `sys/user`)
- `mode` : `'sync'|'async'` — `sync` awaits each dispatch in sequence; `async` fires all dispatches concurrently and returns before they complete (default `sync`)
- `scope` : `'principal'|'root'` — entity operations use `seneca` (principal-scoped) or `seneca.root` (root-scoped, bypasses org-principal restrictions) (default `principal`)
- `relations` : object — `{ parental: [['parent/canon', 'child/canon'], ...] }`
- `customRef` : object — override the FK field name per child canon, e.g. `{ 'sys/traversetask': 'run_id' }`
- `init$` : boolean

<!--END:options-->

<!--START:action-list-->

## Action Patterns

- [sys:traverse,on:run,do:create](#-systraverseonrundocreate-)
- [sys:traverse,on:task,do:execute](#-systraverseontaskdoexecute-)
- [sys:traverse,do:dispatch,on:task](#-systraversedodispatchontask-)
- [sys:traverse,on:run,do:start](#-systraverseonrundostart-)
- [sys:traverse,on:run,do:stop](#-systraverseonrundostop-)
- [sys:traverse,on:task,do:complete](#-systraverseontaskdocomplete-)
- [sys:traverse,on:run,did:complete](#-systraverseonrundidcomplete-)
- [sys:traverse,on:run,do:claim](#-systraverseonrundoclaim-)
- [sys:traverse,find:children](#-systraversefindchildren-)
- [sys:traverse,find:deps](#-systraversefinddeps-)

<!--END:action-list-->

<!--START:action-desc-->

## Action Descriptions

### &laquo; `sys:traverse,on:run,do:create` &raquo;

Create a run process and generate tasks for each child entity to be executed.
If any task save fails all created tasks and the run are removed atomically;
returns `{ ok: false, why: 'task-create-failed' }` so the caller can retry.

#### Parameters

- **rootEntity** : _string_ (optional, default: option `rootEntity`)
- **rootEntityId** : _string_
- **taskMsg** : _string_

#### Result

```ts
{ ok: true,  run, tasksCreated: number, tasksFailed: 0 }
{ ok: false, why: 'task-create-failed', tasksCreated: 0, tasksFailed: number }
```

---

### &laquo; `sys:traverse,on:task,do:execute` &raquo;

Mark a task as dispatched and call `sys:traverse,do:dispatch,on:task`.
Skips tasks already in `done` or `dispatched` state.

#### Parameters

- **task** : _object_

---

### &laquo; `sys:traverse,do:dispatch,on:task` &raquo;

**Overridable.** Default: calls the task's `task_msg` then marks it complete via
`sys:traverse,on:task,do:complete`. Override to push to an async queue (SQS, etc.).
When overriding, the remote worker **must** call `sys:traverse,on:task,do:complete`
explicitly — the plugin cannot do it for you.

```js
// register after seneca.ready()
seneca.message('sys:traverse,do:dispatch,on:task', async function(msg) {
  await sqs.sendMessage({ body: JSON.stringify(msg.task) })
  return { ok: true }
})
```

#### Parameters

- **task** : _object_

---

### &laquo; `sys:traverse,on:run,do:start` &raquo;

Transition run to `active` and dispatch all pending tasks.
In `sync` mode tasks run sequentially and the call awaits completion.
In `async` mode all dispatches fire concurrently and the call returns immediately.

#### Parameters

- **runId** : _string_

---

### &laquo; `sys:traverse,on:run,do:stop` &raquo;

Set run status to `stopped`. In sync mode the current task finishes but no
further tasks are dispatched. Has no effect if run is already completed.

#### Parameters

- **runId** : _string_

---

### &laquo; `sys:traverse,on:task,do:complete` &raquo;

Mark a task as `done`, store optional `result`/`fragment`, then attempt to
complete the run via `sys:traverse,on:run,do:claim`. The single caller that wins
the claim emits `sys:traverse,on:run,did:complete`, so the hook fires exactly
once.

Async-mode workers must call this explicitly after processing a task.

#### Parameters

- **task** : _object_
- **result** : _any_ (optional) — stored on the task entity
- **fragment** : _any_ (optional) — stored on the task entity (e.g. a PII data chunk)

---

### &laquo; `sys:traverse,on:run,did:complete` &raquo;

**Overridable.** Fired once when a run transitions to `completed`. Default is a
no-op. Override to trigger downstream work — e.g. post to an ingest queue to
assemble task fragments into a final artifact.

```js
seneca.message('sys:traverse,on:run,did:complete', async function(msg) {
  await seneca.post('aim:ingest,build:report', { runId: msg.run.id })
  return { ok: true }
})
```

#### Parameters

- **run** : _object_ — the completed `sys/traverse` entity

---

### &laquo; `sys:traverse,on:run,do:claim` &raquo;

**Overridable.** Claims the run-completion transition for a single caller.
Default impl is best-effort (load run, count `done` tasks, set `completed`) and
returns `claimed: true` for the one call that performs the transition. This is
adequate for single-process and concurrency-capped consumers, but is **not**
atomic across truly concurrent distributed workers — two workers finishing the
last tasks at once could both observe the count satisfied.

For distributed hosts, override with a store-level conditional write (e.g.
DynamoDB `attribute_not_exists`) so exactly one worker wins the claim and
`did:complete` fires once — without coupling the plugin to any store.

```js
seneca.message('sys:traverse,on:run,do:claim', async function(msg) {
  const claimed = await dynamoConditionalComplete(msg.run.id)
  return { ok: true, claimed, run: msg.run }
})
```

#### Parameters

- **run** : _object_ — the active `sys/traverse` entity

#### Result

```ts
{ ok: true, claimed: boolean, run }
```

---

### &laquo; `sys:traverse,find:children` &raquo;

Returns all discovered child instances with their parent relationship.

#### Parameters

- **rootEntity** : _string_ (optional, default: option `rootEntity`)
- **rootEntityId** : _string_

---

### &laquo; `sys:traverse,find:deps` &raquo;

Returns a sorted list of entity pairs starting from a given entity, BFS-ordered.

#### Parameters

- **rootEntity** : _string_ (optional, default: option `rootEntity`)

---

<!--END:action-desc-->

## Motivation

## Support

## API

## Contributing

## Background
