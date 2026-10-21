import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskSuggestions, NEEDS_HANDS_LIMIT } from './taskSuggestions';
import { AvailableTask, Priority, TaskStatus, TimeEntryWithTaskInfo } from '../types';

const TODAY = '2026-10-20';
const ME = '1';

const task = (id: number, over: Partial<AvailableTask> = {}): AvailableTask => ({
  id, title: `t${id}`, status: TaskStatus.NotStarted, priority: Priority.Medium, effort: 1, isAssigned: false,
  projectName: 'Board', departments: ['Mechanical'], deptOnly: false, assignees: [], ...over,
});

let seq = 0;
const entry = (userId: string, over: Partial<TimeEntryWithTaskInfo> = {}): TimeEntryWithTaskInfo => ({
  id: String(++seq), userId, checkInAt: 0, status: 'checked_in', createdAt: 0, ...over,
});

const build = (tasks: AvailableTask[], entries: TimeEntryWithTaskInfo[] = []) =>
  buildTaskSuggestions({ tasks, subjectId: ME, subjectDepartments: ['Mechanical'], entries, today: TODAY });

test('resume is the task my last finished session was on, with its note', () => {
  const s = build([task(1, { isAssigned: true, assignees: [1] }), task(2, { isAssigned: true, assignees: [1] })], [
    entry(ME, { status: 'completed', checkOutAt: 100, workingOnTaskId: 2, taskHandoffNote: 'old' }),
    entry(ME, { status: 'completed', checkOutAt: 200, workingOnTaskId: 1, taskHandoffNote: 'Left off on stage 2' }),
  ]);
  assert.equal(s.resume?.id, 1);
  assert.deepEqual(s.mine.map(t => t.id), [2], 'the resume task is not listed twice');
  assert.equal(s.latestNote.get(1)?.note, 'Left off on stage 2');
});

test('no resume when that task is no longer offered (finished or blocked since)', () => {
  const s = build([task(2)], [entry(ME, { status: 'completed', checkOutAt: 200, workingOnTaskId: 9 })]);
  assert.equal(s.resume, null);
});

test('teammates: tasks someone in my department is on right now, never my own session', () => {
  const s = build([task(3), task(4), task(5, { departments: ['Software'] })], [
    entry('2', { workingOnTaskId: 3 }),
    entry('3', { workingOnTaskId: 3 }),
    entry(ME, { workingOnTaskId: 4 }),
    entry('4', { workingOnTaskId: 5 }),
    entry('5', { workingOnTaskId: 4, status: 'completed', checkOutAt: 50 }),
  ]);
  assert.deepEqual(s.teammates.map(t => t.id), [3]);
  assert.deepEqual(s.workersByTask.get(3), ['2', '3']);
});

test('needs hands: unassigned, not started, mine by department, overdue or High/Urgent; overdue first', () => {
  const s = build([
    task(10, { priority: Priority.High }),
    task(11, { dueDate: '2026-10-15' }),
    task(12, { priority: Priority.Urgent, assignees: [7] }),
    task(13, { priority: Priority.Urgent, status: TaskStatus.InProgress }),
    task(14, { priority: Priority.Urgent, departments: ['Business'] }),
    task(15, { priority: Priority.Low }),
    task(16, { priority: Priority.Urgent }),
  ]);
  assert.deepEqual(s.needsHands.map(t => t.id), [11, 16, 10]);
});

test('needs hands stops at the limit', () => {
  const s = build([1, 2, 3, 4, 5].map(i => task(100 + i, { priority: Priority.High })));
  assert.equal(s.needsHands.length, NEEDS_HANDS_LIMIT);
});
