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
* `relations` : object
* `customRef` : object
* `init$` : boolean


<!--END:options-->

<!--START:action-list-->


## Action Patterns

* [sys:traverse,do:create,on:run](#-systraversedocreateonrun-)
* [sys:traverse,do:execute,on:task](#-systraversedoexecuteontask-)
* [sys:traverse,do:next,on:task](#-systraversedonextontask-)
* [sys:traverse,do:start,on:run](#-systraversedostartonrun-)
* [sys:traverse,do:stop,on:run](#-systraversedostoponrun-)
* [sys:traverse,find:children](#-systraversefindchildren-)
* [sys:traverse,find:deps](#-systraversefinddeps-)


<!--END:action-list-->

<!--START:action-desc-->


## Action Descriptions

### &laquo; `sys:traverse,do:create,on:run` &raquo;

Create a run process and generate tasks for each child entity to be executed.


#### Parameters


* __rootEntity__ : _string_ (optional, default: ``)
* __rootEntityId__ : _string_
* __taskMsg__ : _string_


----------
### &laquo; `sys:traverse,do:execute,on:task` &raquo;

Execute a single Run task.


#### Parameters


* __task__ : _object_


----------
### &laquo; `sys:traverse,do:next,on:task` &raquo;

No description provided.


#### Parameters


* __runId__ : _string_


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


* __rootEntity__ : _string_ (optional, default: ``)
* __rootEntityId__ : _string_


----------
### &laquo; `sys:traverse,find:deps` &raquo;

Returns a sorted list of entity pairs starting from a given entity.


#### Parameters


* __rootEntity__ : _string_ (optional, default: ``)


----------


<!--END:action-desc-->

## Motivation

## Support

## API

## Contributing

## Background
