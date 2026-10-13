import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import KanbanBoard from './KanbanBoard';
import { rememberedBoardStorageKey } from '../utils/boardSelection';

const noop = () => {};
function renderBoard(saved: string, openCreation: boolean, leader = false) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => key === rememberedBoardStorageKey('2') ? saved : null, setItem: noop },
  });
  try {
    const projects = [
      {id:'1',name:'Retired fixture board',archived:true,allowAllTaskCreation:false,links:[],scrumMasters:[],createdAt:0},
      {id:'2',name:'Displayed fixture board',archived:false,allowAllTaskCreation:openCreation,links:[],scrumMasters:[],createdAt:0},
    ];
    const task = (id: string, projectId: string, title: string) => ({
      id, projectId, title, status:'Backlog',priority:'Medium',departments:[],assignees:[],contributors:[],
      dependencies:[],attachments:[],successCriteria:[],history:[],comments:[],createdAt:0,
    });
    const state: any = {
      currentUser:{id:'2',name:'Synthetic member',roles:leader?['Coach']:['Team Member'],departments:[]},
      projects,users:[],tasks:[task('1','1','Hidden retired task'),task('2','2','Visible live task')],
      timeEntries:[],notifications:[],announcements:[],
    };
    return renderToStaticMarkup(<KanbanBoard state={state} onUpdateTask={noop} onDeleteTask={noop} onAddTask={noop} onAddProject={noop} onUpdateProject={noop} onArchiveProject={noop} onNotify={noop}/>);
  } finally {
    if (previous) Object.defineProperty(globalThis,'localStorage',previous);
    else Reflect.deleteProperty(globalThis,'localStorage');
  }
}

test('remembered archive renders the live selection, live tasks, and member creation button together', () => {
  const html=renderBoard('1',true);
  assert.match(html,/<option value="2" selected="">Displayed fixture board<\/option>/);
  assert.match(html,/Visible live task/);
  assert.doesNotMatch(html,/Hidden retired task/);
  assert.match(html,/>New<\/span> Task/);
});
test('member creation button remains hidden when the resolved board is restricted', () => {
  const html=renderBoard('1',false);
  assert.match(html,/Visible live task/);
  assert.doesNotMatch(html,/>New<\/span> Task/);
});
test('leadership creation remains available on the resolved live board', () => {
  assert.match(renderBoard('1',false,true),/>New<\/span> Task/);
});
test('missing remembered board has matching visible selection and tasks', () => {
  const html=renderBoard('removed-board',true);
  assert.match(html,/<option value="2" selected="">Displayed fixture board<\/option>/);
  assert.match(html,/Visible live task/);
  assert.doesNotMatch(html,/Hidden retired task/);
});
