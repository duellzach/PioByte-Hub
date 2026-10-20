import test from 'node:test';
import assert from 'node:assert/strict';
import { byAttention, daysLate, isOverdue, summarizeBoard, QUIET_AFTER_DAYS } from './warRoom';
import { Priority, Project, Task, TaskStatus } from '../types';

const DAY = 24 * 60 * 60 * 1000;
// Local noon, so the local date is unambiguous in any timezone the tests run in.
const NOW = new Date(2026, 9, 19, 12, 0).getTime();
const TODAY = '2026-10-19';

const project = (id: string): Project => ({
  id, name: id, description: '', createdAt: 0, archived: false, scrumMasters: [], showInWarRoom: true, links: [],
});

let seq = 0;
const task = (over: Partial<Task> = {}): Task => ({
  id: String(++seq), projectId: 'p', title: 't', description: '', status: TaskStatus.InProgress, priority: Priority.Medium,
  effort: 1, departments: [], assignees: [], contributors: [], successCriteria: [], attachments: [], comments: [],
  history: [{ id: 'h', userId: 'u', action: 'Task Created', timestamp: NOW - DAY }],
  startDate: null, dueDate: null, dependencies: [], createdAt: NOW - DAY, ...over,
});

test('overdue means past due and still expected to move', () => {
  assert.equal(isOverdue(task({ dueDate: '2026-10-18' }), TODAY), true);
  assert.equal(isOverdue(task({ dueDate: TODAY }), TODAY), false, 'due today is not late yet');
  assert.equal(isOverdue(task({ dueDate: '2026-10-01', status: TaskStatus.Complete }), TODAY), false);
  assert.equal(isOverdue(task({ dueDate: '2026-10-01', status: TaskStatus.Backlog }), TODAY), false, 'backlog due dates are wishes');
  assert.equal(isOverdue(task({ dueDate: null }), TODAY), false);
  assert.equal(daysLate(task({ dueDate: '2026-10-12' }), TODAY), 7);
});

test('health: two blocked or three overdue is red; any single problem or quiet is amber', () => {
  const red = summarizeBoard(project('p'), [task({ status: TaskStatus.Blocked }), task({ status: TaskStatus.Blocked })], NOW);
  assert.equal(red.health, 'red');

  const late = summarizeBoard(project('p'), [1, 2, 3].map(() => task({ dueDate: '2026-10-10' })), NOW);
  assert.equal(late.health, 'red');
  assert.equal(late.overdue.length, 3);

  assert.equal(summarizeBoard(project('p'), [task({ status: TaskStatus.Blocked })], NOW).health, 'amber');
  assert.equal(summarizeBoard(project('p'), [task()], NOW).health, 'green');
});

test('a board goes quiet only when it has open work and no recent history', () => {
  const old = NOW - (QUIET_AFTER_DAYS + 1) * DAY;
  const stale = task({ createdAt: old, history: [{ id: 'h', userId: 'u', action: 'Task Created', timestamp: old }] });
  const quiet = summarizeBoard(project('p'), [stale], NOW);
  assert.equal(quiet.quiet, true);
  assert.equal(quiet.health, 'amber');

  const finished = { ...stale, status: TaskStatus.Complete };
  assert.equal(summarizeBoard(project('p'), [finished], NOW).quiet, false, 'a finished board is not quiet');
  assert.equal(summarizeBoard(project('p'), [], NOW).quiet, false);
});

test('progress is by effort points, dept-only tasks are not on the board, next due skips the past', () => {
  const s = summarizeBoard(project('p'), [
    task({ status: TaskStatus.Complete, effort: 3 }),
    task({ effort: 1, dueDate: '2026-10-25' }),
    task({ effort: 0, dueDate: '2026-10-21' }),
    task({ effort: 8, dueDate: '2026-10-02' }),
    task({ effort: 5, deptOnly: true }),
    task({ projectId: 'other', effort: 5 }),
  ], NOW);
  assert.equal(s.tasks.length, 4);
  assert.equal(s.totalPoints, 12);
  assert.equal(s.percentDone, 25);
  assert.equal(s.nextDue?.dueDate, '2026-10-21');
});

test('worst boards sort first', () => {
  const calm = summarizeBoard(project('calm'), [task({ projectId: 'calm' })], NOW);
  const stuck = summarizeBoard(project('stuck'), [task({ projectId: 'stuck', status: TaskStatus.Blocked })], NOW);
  assert.deepEqual([calm, stuck].sort(byAttention).map(s => s.project.id), ['stuck', 'calm']);
});
