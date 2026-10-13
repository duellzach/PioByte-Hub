import test from 'node:test';
import assert from 'node:assert/strict';
import { canCreateTaskOnBoard, rememberedBoardStorageKey, resolveBoardSelection } from './boardSelection';
import { Project } from '../types';

const project = (id: string, archived = false, allowAllTaskCreation = false, department?: string): Project => ({
  id,
  name: id,
  description: '',
  createdAt: 0,
  archived,
  scrumMasters: [],
  showInWarRoom: true,
  allowAllTaskCreation,
  links: [],
  department,
});

test('stale archived selection resolves to live board; deliberate archive selection remains explicit', () => {
  const projects = [project('archived', true), project('live', false, true)];
  assert.equal(resolveBoardSelection('archived', projects, []).key, 'live');
  const selected = resolveBoardSelection('archived', projects, [], true);
  assert.equal(selected.key, 'archived');
  assert.equal(selected.isArchived, true);
  assert.equal(canCreateTaskOnBoard(selected, true, projects), false);
});

test('removed or inaccessible selection falls back to accessible live project', () => {
  const available = [project('available')];
  assert.equal(resolveBoardSelection('removed', available, []).key, 'available');
  // The helper only receives accessible projects, so private boards cannot be
  // selected by passing an inaccessible id.
  assert.equal(resolveBoardSelection('private', available, []).key, 'available');
});

test('empty project data preserves a remembered key without resolving permissions', () => {
  const result = resolveBoardSelection('remembered', [], ['Mechanical']);
  assert.equal(result.key, 'remembered');
  assert.equal(result.isResolved, false);
  assert.equal(canCreateTaskOnBoard(result, true, []), false);
});

test('no live boards falls back to a valid department view, never an archive', () => {
  const result = resolveBoardSelection('', [project('archive', true)], ['Mechanical']);
  assert.equal(result.key, 'dept:Mechanical');
  assert.equal(result.isDepartment, true);
  assert.equal(resolveBoardSelection('', [project('archive', true)], []).key, '');
});

test('ordinary members can create only on their selected live board when enabled', () => {
  const projects = [project('open', false, true), project('restricted'), project('archive', true, true)];
  const member = resolveBoardSelection('open', projects, []);
  assert.equal(canCreateTaskOnBoard(member, false, projects), true);
  assert.equal(canCreateTaskOnBoard(resolveBoardSelection('restricted', projects, []), false, projects), false);
  assert.equal(canCreateTaskOnBoard(resolveBoardSelection('archive', projects, [], true), false, projects), false);
});

test('department board creation requires leadership and a live home project', () => {
  const projects = [project('home', false, false, 'Mechanical'), project('retired', true, false, 'Software')];
  const department = resolveBoardSelection('dept:Mechanical', projects, ['Mechanical', 'Software']);
  const noHome = resolveBoardSelection('dept:Software', projects, ['Mechanical', 'Software']);
  assert.equal(canCreateTaskOnBoard(department, true, projects), true);
  assert.equal(canCreateTaskOnBoard(department, false, projects), false);
  assert.equal(canCreateTaskOnBoard(noHome, true, projects), true);
  assert.equal(canCreateTaskOnBoard(noHome, true, [project('archive', true)]), false);
});

test('remembered selection is namespaced by account', () => {
  assert.notEqual(rememberedBoardStorageKey(12), rememberedBoardStorageKey(13));
});
