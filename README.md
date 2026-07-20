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
seneca.use('Traverse', {})

const depsRes = await seneca.post('sys:traverse,find:deps')
// === { ok: true, deps: [['foo/bar0,foo/bar1'],...] }
```

## More Examples

Review the [unit tests](test/Traverse.test.ts) for more examples.

<!--START:options-->


## Options

* `debug` : boolean
* `rootExecute` : boolean
* `rootEntity` : string
* `mode` : string
* `scope` : string
* `taskMsgAllow` : array
* `relations` : object
* `customRef` : object
* `init$` : boolean


<!--END:options-->

### Execution modes

- **`sync`** (default): `do:start` dispatches tasks sequentially in-process
  (forward BFS) and marks the run `completed` when the loop finishes. Best for
  in-process batch jobs where the dispatch call awaits the work.
- **`async`**: `do:start` returns immediately and drives the tasks in
  reverse-BFS order — the deepest level dispatches fire-and-forget first, and
  each shallower level is released only once every deeper task is done, so a
  parent is never processed before its children (a destructive task can't strand
  a dangling reference). Each task's host must signal completion with
  `sys:traverse,on:task,do:complete` (`taskId`); the run advances to `completed`
  once `completed_tasks` reaches `total_tasks`. This is the transport-friendly
  mode: point `do:dispatch` at a queue (e.g. SQS) and the worker posts
  `do:complete` out-of-band.

  The completion counter is advanced under a per-run in-process lock, so
  concurrent completions are safe within a single process. A multi-process
  deployment that shares one store and completes tasks from different processes
  must rely on store-level atomicity (override `do:claim`) — the in-process lock
  does not span processes.

  Delivery is at-least-once: `do:complete` is idempotent (the persisted `done`
  status absorbs redelivery), but a task may be dispatched more than once at a
  level boundary, so `do:dispatch` targets and their workers must be idempotent.

### Scope: `scope`

- **`principal`** (default): entity access uses the calling Seneca instance,
  honouring its principal-scoping.
- **`root`**: entity access uses `seneca.root`, bypassing principal-scoping so a
  run can read/write entities owned by other principals — e.g. a support-triggered
  run acting on another user's data.

### Atomic create

`on:run,do:create` creates the run and one task per record. If any task save
fails, it rolls back — removing every created task and the run — and returns
`{ ok: false, why: 'task-create-failed', tasksCreated: 0, tasksFailed }`. A run
therefore never starts from a partial task set.

### Security: `taskMsgAllow`

`task_msg` is dispatched as an arbitrary Seneca message pattern. If
`sys:traverse,on:run,do:create` is reachable from untrusted input, set
`taskMsgAllow` to the list of permitted patterns; `do:create` then rejects any
other `taskMsg` with `{ ok: false, why: 'task-msg-not-allowed' }`. An empty
allowlist (the default) permits any pattern and assumes a trusted caller.

<!--START:action-list-->


## Action Patterns

* [sys:traverse,did:complete,on:run](#-systraversedidcompleteonrun-)
* [sys:traverse,do:claim,on:run](#-systraversedoclaimonrun-)
* [sys:traverse,do:complete,on:task](#-systraversedocompleteontask-)
* [sys:traverse,do:create,on:run](#-systraversedocreateonrun-)
* [sys:traverse,do:dispatch,on:task](#-systraversedodispatchontask-)
* [sys:traverse,do:execute,on:task](#-systraversedoexecuteontask-)
* [sys:traverse,do:start,on:run](#-systraversedostartonrun-)
* [sys:traverse,do:stop,on:run](#-systraversedostoponrun-)
* [sys:traverse,find:children](#-systraversefindchildren-)
* [sys:traverse,find:deps](#-systraversefinddeps-)


<!--END:action-list-->

<!--START:action-desc-->


## Action Descriptions

### &laquo; `sys:traverse,did:complete,on:run` &raquo;

No description provided.


#### Parameters


* __run__ : _object_


----------
### &laquo; `sys:traverse,do:claim,on:run` &raquo;

No description provided.


#### Parameters


* __run__ : _object_


----------
### &laquo; `sys:traverse,do:complete,on:task` &raquo;

No description provided.


#### Parameters


* __taskId__ : _string_


----------
### &laquo; `sys:traverse,do:create,on:run` &raquo;

Create a run process and generate tasks for each child entity to be executed.


#### Parameters


* __rootEntityId__ : _string_
* __taskMsg__ : _string_


----------
### &laquo; `sys:traverse,do:dispatch,on:task` &raquo;

No description provided.


#### Parameters


* __task__ : _object_


----------
### &laquo; `sys:traverse,do:execute,on:task` &raquo;

Execute a single Run task.


#### Parameters


* __task__ : _object_


----------
### &laquo; `sys:traverse,do:start,on:run` &raquo;

Start a Run process execution, dispatching the next pending child task.


#### Parameters


* __runId__ : _string_


----------
### &laquo; `sys:traverse,do:stop,on:run` &raquo;

Stop a Run process execution, preventing the dispatching of the next pending child task.


#### Parameters


* __runId__ : _string_


----------
### &laquo; `sys:traverse,find:children` &raquo;

Returns all discovered child instances with their parent relationship.


#### Parameters


* __rootEntityId__ : _string_


----------
### &laquo; `sys:traverse,find:deps` &raquo;

Returns a sorted list of entity pairs starting from a given entity.



----------


<!--END:action-desc-->

## Motivation

## Support

## API

## Contributing

## Background
