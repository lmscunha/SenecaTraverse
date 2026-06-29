/* Copyright © 2025 Seneca Project Contributors, MIT License. */

import { describe, test } from 'node:test'
import { expect } from '@hapi/code'

import Seneca from 'seneca'

import Traverse from '..'

import { makeSeneca, sleep } from './support'

describe('Traverse: find:children', () => {
  test('find-children', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar0', 'foo/zed0'],
          ['foo/bar1', 'foo/bar4'],
          ['foo/bar1', 'foo/bar5'],
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar2', 'foo/bar9'],
          ['foo/zed0', 'foo/zed1'],
          ['foo/bar3', 'foo/bar6'],
          ['foo/bar4', 'foo/bar7'],
          ['foo/bar5', 'foo/bar8'],
          ['foo/zed1', 'foo/zed2'],
          ['foo/bar6', 'foo/bar10'],
          ['foo/bar7', 'foo/bar11'],
        ],
      },
    })
    await seneca.ready()

    const rootEntityId = '123'

    // Level 1: Direct children of bar0
    const bar1Ent = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar2Ent = await seneca.entity('foo/bar2').save$({
      bar0_id: rootEntityId,
    })

    const zed0Ent = await seneca.entity('foo/zed0').save$({
      bar0_id: rootEntityId,
    })

    // Level 2: Children of bar1
    const bar4Ent = await seneca.entity('foo/bar4').save$({
      bar1_id: bar1Ent.id,
    })

    const bar5Ent = await seneca.entity('foo/bar5').save$({
      bar1_id: bar1Ent.id,
    })

    // Level 2: Children of bar2
    const bar3Ent = await seneca.entity('foo/bar3').save$({
      bar2_id: bar2Ent.id,
    })

    const bar9Ent = await seneca.entity('foo/bar9').save$({
      bar2_id: bar2Ent.id,
    })

    // Level 2: Children of zed0
    const zed1Ent = await seneca.entity('foo/zed1').save$({
      zed0_id: zed0Ent.id,
    })

    // Level 3: Children of bar3
    const bar6Ent = await seneca.entity('foo/bar6').save$({
      bar3_id: bar3Ent.id,
    })

    // Level 3: Children of bar4
    const bar7Ent = await seneca.entity('foo/bar7').save$({
      bar4_id: bar4Ent.id,
    })

    // Level 3: Children of bar5
    const bar8Ent = await seneca.entity('foo/bar8').save$({
      bar5_id: bar5Ent.id,
    })

    // Level 3: Children of zed1
    const zed2Ent = await seneca.entity('foo/zed2').save$({
      zed1_id: zed1Ent.id,
    })

    // Level 4: Children of bar6
    const bar10Ent = await seneca.entity('foo/bar10').save$({
      bar6_id: bar6Ent.id,
    })

    // Level 4: Children of bar7
    const bar11Ent = await seneca.entity('foo/bar11').save$({
      bar7_id: bar7Ent.id,
    })

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
    })

    expect(res.children).equal([
      // Level 1
      {
        parent_id: rootEntityId,
        child_id: bar1Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: rootEntityId,
        child_id: bar2Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar2',
      },
      {
        parent_id: rootEntityId,
        child_id: zed0Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/zed0',
      },
      // Level 2
      {
        parent_id: bar1Ent.id,
        child_id: bar4Ent.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar4',
      },
      {
        parent_id: bar1Ent.id,
        child_id: bar5Ent.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar5',
      },
      {
        parent_id: bar2Ent.id,
        child_id: bar3Ent.id,
        parent_canon: 'foo/bar2',
        child_canon: 'foo/bar3',
      },
      {
        parent_id: bar2Ent.id,
        child_id: bar9Ent.id,
        parent_canon: 'foo/bar2',
        child_canon: 'foo/bar9',
      },
      {
        parent_id: zed0Ent.id,
        child_id: zed1Ent.id,
        parent_canon: 'foo/zed0',
        child_canon: 'foo/zed1',
      },
      // Level 3
      {
        parent_id: bar3Ent.id,
        child_id: bar6Ent.id,
        parent_canon: 'foo/bar3',
        child_canon: 'foo/bar6',
      },
      {
        parent_id: bar4Ent.id,
        child_id: bar7Ent.id,
        parent_canon: 'foo/bar4',
        child_canon: 'foo/bar7',
      },
      {
        parent_id: bar5Ent.id,
        child_id: bar8Ent.id,
        parent_canon: 'foo/bar5',
        child_canon: 'foo/bar8',
      },
      {
        parent_id: zed1Ent.id,
        child_id: zed2Ent.id,
        parent_canon: 'foo/zed1',
        child_canon: 'foo/zed2',
      },
      // Level 4
      {
        parent_id: bar6Ent.id,
        child_id: bar10Ent.id,
        parent_canon: 'foo/bar6',
        child_canon: 'foo/bar10',
      },
      {
        parent_id: bar7Ent.id,
        child_id: bar11Ent.id,
        parent_canon: 'foo/bar7',
        child_canon: 'foo/bar11',
      },
    ])
  })

  test('find-children-empty-relations', async () => {
    const seneca = makeSeneca().use(Traverse)
    await seneca.ready()

    const rootEntityId = '123'

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
    })

    expect(res.children).equal([])
  })

  test('find-children-no-matching-entities', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
        ],
      },
    })
    await seneca.ready()

    const rootEntityId = '123'

    // Missing entities on data storage

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
    })

    expect(res.children).equal([])
  })

  test('find-children-partial-tree', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar3'],
          ['foo/bar1', 'foo/bar4'],
        ],
      },
    })
    await seneca.ready()

    const rootEntityId = '123'

    // Only create bar1 and bar3, not bar2 or bar4
    const bar1Ent = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar3Ent = await seneca.entity('foo/bar3').save$({
      bar1_id: bar1Ent.id,
    })

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
    })

    // Should only return entities that exist in the data storage
    expect(res.children).equal([
      {
        parent_id: rootEntityId,
        child_id: bar1Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: bar1Ent.id,
        child_id: bar3Ent.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar3',
      },
    ])
  })

  test('find-children-default-root-entity', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['sys/user', 'user/settings'],
          ['sys/user', 'user/project'],
          ['user/project', 'project/release'],
        ],
      },
    })
    await seneca.ready()

    const rootEntityId = 'user-456'

    const settingsEnt = await seneca.entity('user/settings').save$({
      user_id: rootEntityId,
    })

    const projectEnt = await seneca.entity('user/project').save$({
      user_id: rootEntityId,
    })

    const releaseEnt = await seneca.entity('project/release').save$({
      project_id: projectEnt.id,
    })

    const res = await seneca.post('sys:traverse,find:children', {
      // rootEntity omitted - should default to 'sys/user'
      rootEntityId: rootEntityId,
    })

    expect(res.children).equal([
      {
        parent_id: rootEntityId,
        child_id: projectEnt.id,
        parent_canon: 'sys/user',
        child_canon: 'user/project',
      },
      {
        parent_id: rootEntityId,
        child_id: settingsEnt.id,
        parent_canon: 'sys/user',
        child_canon: 'user/settings',
      },
      {
        parent_id: projectEnt.id,
        child_id: releaseEnt.id,
        parent_canon: 'user/project',
        child_canon: 'project/release',
      },
    ])
  })

  test('find-children-avoid-wrong-children', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar3'],
        ],
      },
    })
    await seneca.ready()

    const rootEntityId = '123'

    const bar1Ent = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar2Ent = await seneca.entity('foo/bar2').save$({
      bar0_id: rootEntityId,
    })

    // Create bar3 entities but with another parent_id
    await seneca.entity('foo/bar3').save$({
      bar1_id: '456',
    })

    await seneca.entity('foo/bar3').save$({
      bar1_id: '789',
    })

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
    })

    // Should not include other parent children
    expect(res.children).equal([
      {
        parent_id: rootEntityId,
        child_id: bar1Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: rootEntityId,
        child_id: bar2Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar2',
      },
    ])
  })

  test('find-children-single-entity-tree', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [['foo/bar0', 'foo/bar1']],
      },
    })
    await seneca.ready()

    const rootEntityId = '123'

    const bar1Ent = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
    })

    expect(res.children).equal([
      {
        parent_id: rootEntityId,
        child_id: bar1Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
    ])
  })

  test('find-children-deep-linear-chain', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar1', 'foo/bar2'],
          ['foo/bar2', 'foo/bar3'],
          ['foo/bar3', 'foo/bar4'],
          ['foo/bar4', 'foo/bar5'],
        ],
      },
    })
    await seneca.ready()

    const rootEntityId = '123'

    const bar1Ent = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar2Ent = await seneca.entity('foo/bar2').save$({
      bar1_id: bar1Ent.id,
    })

    const bar3Ent = await seneca.entity('foo/bar3').save$({
      bar2_id: bar2Ent.id,
    })

    const bar4Ent = await seneca.entity('foo/bar4').save$({
      bar3_id: bar3Ent.id,
    })

    const bar5Ent = await seneca.entity('foo/bar5').save$({
      bar4_id: bar4Ent.id,
    })

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
    })

    expect(res.children).equal([
      {
        parent_id: rootEntityId,
        child_id: bar1Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: bar1Ent.id,
        child_id: bar2Ent.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar2',
      },
      {
        parent_id: bar2Ent.id,
        child_id: bar3Ent.id,
        parent_canon: 'foo/bar2',
        child_canon: 'foo/bar3',
      },
      {
        parent_id: bar3Ent.id,
        child_id: bar4Ent.id,
        parent_canon: 'foo/bar3',
        child_canon: 'foo/bar4',
      },
      {
        parent_id: bar4Ent.id,
        child_id: bar5Ent.id,
        parent_canon: 'foo/bar4',
        child_canon: 'foo/bar5',
      },
    ])
  })

  test('find-children-custom-key', async () => {
    const seneca = makeSeneca().use(Traverse, {
      customRef: {
        'foo/bar2': 'custom0_id',
        'foo/bar3': 'custom1_test',
      },

      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar0', 'foo/bar2'],
          ['foo/bar1', 'foo/bar3'],
        ],
      },
    })
    await seneca.ready()

    const rootEntityId = '123'

    const bar1Ent = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar2Ent = await seneca.entity('foo/bar2').save$({
      custom0_id: rootEntityId,
    })

    const bar3Ent = await seneca.entity('foo/bar3').save$({
      custom1_test: bar1Ent.id,
    })

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
    })

    expect(res.children).equal([
      {
        parent_id: rootEntityId,
        child_id: bar1Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: rootEntityId,
        child_id: bar2Ent.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar2',
      },
      {
        parent_id: bar1Ent.id,
        child_id: bar3Ent.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar3',
      },
    ])
  })

  test('find-children-multi-inst', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar1', 'foo/bar2'],
        ],
      },
    })
    await seneca.ready()

    const rootEntityId = '123'

    const bar1Ent1 = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar1Ent2 = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar1Ent3 = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar2Ent1 = await seneca.entity('foo/bar2').save$({
      bar1_id: bar1Ent1.id,
    })

    const bar2Ent2 = await seneca.entity('foo/bar2').save$({
      bar1_id: bar1Ent2.id,
    })

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
    })

    expect(res.children).equal([
      {
        parent_id: rootEntityId,
        child_id: bar1Ent1.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: rootEntityId,
        child_id: bar1Ent2.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: rootEntityId,
        child_id: bar1Ent3.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: bar1Ent1.id,
        child_id: bar2Ent1.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar2',
      },
      {
        parent_id: bar1Ent2.id,
        child_id: bar2Ent2.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar2',
      },
    ])
  })

  test('find-children-multiple-inst-multi-levels', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['foo/bar0', 'foo/bar1'],
          ['foo/bar1', 'foo/bar2'],
          ['foo/bar2', 'foo/bar3'],
        ],
      },
    })
    await seneca.ready()

    const rootEntityId = '123'

    const bar1Ent1 = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar1Ent2 = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar1Ent3 = await seneca.entity('foo/bar1').save$({
      bar0_id: rootEntityId,
    })

    const bar2Ent1_1 = await seneca.entity('foo/bar2').save$({
      bar1_id: bar1Ent1.id,
    })

    const bar2Ent1_2 = await seneca.entity('foo/bar2').save$({
      bar1_id: bar1Ent1.id,
    })

    const bar2Ent2_1 = await seneca.entity('foo/bar2').save$({
      bar1_id: bar1Ent2.id,
    })

    const bar2Ent2_2 = await seneca.entity('foo/bar2').save$({
      bar1_id: bar1Ent2.id,
    })

    const bar2Ent3_1 = await seneca.entity('foo/bar2').save$({
      bar1_id: bar1Ent3.id,
    })

    const bar3Ent1_1_1 = await seneca.entity('foo/bar3').save$({
      bar2_id: bar2Ent1_1.id,
    })

    const bar3Ent1_1_2 = await seneca.entity('foo/bar3').save$({
      bar2_id: bar2Ent1_1.id,
    })

    const bar3Ent2_2_1 = await seneca.entity('foo/bar3').save$({
      bar2_id: bar2Ent2_2.id,
    })

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'foo/bar0',
      rootEntityId: rootEntityId,
    })

    expect(res.children).equal([
      // Level 1: All bar1 children of bar0
      {
        parent_id: rootEntityId,
        child_id: bar1Ent1.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: rootEntityId,
        child_id: bar1Ent2.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },
      {
        parent_id: rootEntityId,
        child_id: bar1Ent3.id,
        parent_canon: 'foo/bar0',
        child_canon: 'foo/bar1',
      },

      // Level 2: All bar2 children of bar1Ent1
      {
        parent_id: bar1Ent1.id,
        child_id: bar2Ent1_1.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar2',
      },
      {
        parent_id: bar1Ent1.id,
        child_id: bar2Ent1_2.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar2',
      },

      // Level 2: All bar2 children of bar1Ent2
      {
        parent_id: bar1Ent2.id,
        child_id: bar2Ent2_1.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar2',
      },
      {
        parent_id: bar1Ent2.id,
        child_id: bar2Ent2_2.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar2',
      },

      // Level 2: All bar2 children of bar1Ent3
      {
        parent_id: bar1Ent3.id,
        child_id: bar2Ent3_1.id,
        parent_canon: 'foo/bar1',
        child_canon: 'foo/bar2',
      },

      // Level 3: All bar3 children of bar2Ent1_1
      {
        parent_id: bar2Ent1_1.id,
        child_id: bar3Ent1_1_1.id,
        parent_canon: 'foo/bar2',
        child_canon: 'foo/bar3',
      },
      {
        parent_id: bar2Ent1_1.id,
        child_id: bar3Ent1_1_2.id,
        parent_canon: 'foo/bar2',
        child_canon: 'foo/bar3',
      },

      // Level 3: All bar3 children of bar2Ent2_2
      {
        parent_id: bar2Ent2_2.id,
        child_id: bar3Ent2_2_1.id,
        parent_canon: 'foo/bar2',
        child_canon: 'foo/bar3',
      },
    ])
  })

  test('find-children-single-cycle', async () => {
    const seneca = makeSeneca().use(Traverse, {
      relations: {
        parental: [
          ['A', 'B'],
          ['A', 'C'],
          ['C', 'E'],
          ['C', 'D'],
          ['E', 'G'],
          ['E', 'F'],
          ['F', 'H'],
          ['C', 'A'],
          ['N', 'M'],
        ],
      },
    })
    await seneca.ready()

    let rootEntityId = '123'

    const aEnt = await seneca.entity('A').save$({
      C_id: rootEntityId,
    })

    const cEnt = await seneca.entity('C').save$({
      id: rootEntityId,
      A_id: aEnt.id,
    })

    const bEnt = await seneca.entity('B').save$({
      A_id: aEnt.id,
    })

    const dEnt = await seneca.entity('D').save$({
      C_id: cEnt.id,
    })

    const eEnt = await seneca.entity('E').save$({
      C_id: cEnt.id,
    })

    const fEnt = await seneca.entity('F').save$({
      E_id: eEnt.id,
    })

    const gEnt = await seneca.entity('G').save$({
      E_id: eEnt.id,
    })

    const hEnt = await seneca.entity('H').save$({
      F_id: fEnt.id,
    })

    const nEnt = await seneca.entity('N').save$()

    await seneca.entity('M').save$({
      N_id: nEnt.id,
    })

    const res = await seneca.post('sys:traverse,find:children', {
      rootEntity: 'C',
      rootEntityId: cEnt.id,
    })

    // Should traverse from C,
    // including C->A but NOT A->C
    expect(res.children).equal([
      {
        parent_id: rootEntityId,
        child_id: aEnt.id,
        parent_canon: 'C',
        child_canon: 'A',
      },
      {
        parent_id: rootEntityId,
        child_id: dEnt.id,
        parent_canon: 'C',
        child_canon: 'D',
      },
      {
        parent_id: rootEntityId,
        child_id: eEnt.id,
        parent_canon: 'C',
        child_canon: 'E',
      },
      {
        parent_id: aEnt.id,
        child_id: bEnt.id,
        parent_canon: 'A',
        child_canon: 'B',
      },
      {
        parent_id: eEnt.id,
        child_id: fEnt.id,
        parent_canon: 'E',
        child_canon: 'F',
      },
      {
        parent_id: eEnt.id,
        child_id: gEnt.id,
        parent_canon: 'E',
        child_canon: 'G',
      },
      {
        parent_id: fEnt.id,
        child_id: hEnt.id,
        parent_canon: 'F',
        child_canon: 'H',
      },
    ])
  })
})
