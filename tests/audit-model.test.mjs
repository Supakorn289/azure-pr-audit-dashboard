import assert from 'node:assert/strict';
import test from 'node:test';
import { isCompleted, matchesView, primaryWorkStatus, priority, summarize } from '../app/audit-model.ts';

const makePR = (id, status, repoId = 'repo') => ({ prId: String(id), repoId, projectId: 'project', repoName: repoId, status, url: '#' });
const workItem = (id, prs, assignedTo = 'Anyone') => ({
  id, type: 'Task', title: `Task ${id}`, state: 'Coding Complete', assignedTo,
  categoryCode: 'ACTIVE', categoryLabel: '', isPassed: false,
  prCount: prs.length, completedPrCount: prs.filter(p => p.status === 'completed').length,
  workItemUrl: '#', prs, otherLinks: [],
});

test('summary includes every assignee without target-person constraints', () => {
  const items = [workItem(1, [makePR(1, 'completed')], 'Biw Piyanut'), workItem(2, [makePR(2, 'completed')], 'Someone new')];
  assert.equal(summarize(items).completedItems, 2);
});

test('mixed PR states count individual completed PR but not a completed work item', () => {
  const item = workItem(3, [makePR(3, 'completed'), makePR(4, 'active')]);
  const s = summarize([item]);
  assert.equal(isCompleted(item), false);
  assert.deepEqual([s.completedItems, s.completedPRs, s.pendingItems], [0, 1, 1]);
  assert.equal(matchesView(item, 'PR:completed'), true);
  assert.equal(matchesView(item, 'PR:active'), true);
  assert.equal(matchesView(item, 'ATTENTION'), true);
});

test('one PR linked to several work items is not double counted at PR level', () => {
  const items = [workItem(5, [makePR(25, 'completed')]), workItem(6, [makePR(25, 'completed')])];
  const s = summarize(items);
  assert.equal(s.completedItems, 2);
  assert.equal(s.completedPRs, 1);
  assert.equal(s.totalPRs, 1);
});

test('no PR / abandoned / error / unexpected PR status are all represented', () => {
  const items = [
    workItem(7, []),
    workItem(8, [makePR(30, 'abandoned')]),
    workItem(9, [makePR(31, 'error')]),
    workItem(10, [makePR(32, 'notSet')]),
  ];
  const s = summarize(items);
  assert.equal(s.missingPRItems, 1);
  assert.deepEqual(s.statusCounts, { abandoned: 1, error: 1, notset: 1 });
  assert.equal(s.pendingItems, 4);
  assert.equal(matchesView(items[0], 'NO_PR'), true);
  assert.equal(matchesView(items[3], 'PR:notset'), true);
  assert.equal(priority(items[2]), 0);
});

test('no data remains zero; never inject fake records', () => {
  assert.deepEqual(summarize([]), { totalItems: 0, completedItems: 0, pendingItems: 0, totalPRs: 0, completedPRs: 0, missingPRItems: 0, workCounts: { PASSED: 0, ACTIVE: 0, ABANDONED: 0, NO_PR: 0, ERROR: 0 }, statusCounts: {} });
});


test('Work Item status buckets are mutually exclusive and sum to the total', () => {
  const items = [
    workItem(1, [makePR(1, 'completed')]),
    workItem(2, [makePR(2, 'completed'), makePR(3, 'active')]),
    workItem(3, [makePR(4, 'active'), makePR(5, 'abandoned')]),
    workItem(4, [makePR(6, 'error'), makePR(7, 'active')]),
    workItem(5, []),
  ];
  const s = summarize(items);
  assert.deepEqual(s.workCounts, { PASSED: 1, ACTIVE: 1, ABANDONED: 1, NO_PR: 1, ERROR: 1 });
  assert.equal(Object.values(s.workCounts).reduce((sum, n) => sum + n, 0), s.totalItems);
  assert.equal(s.completedItems + s.pendingItems, s.totalItems);
  assert.equal(primaryWorkStatus(items[2]), 'ABANDONED');
  assert.equal(matchesView(items[1], 'WORK:ACTIVE'), true);
  assert.equal(matchesView(items[2], 'WORK:ACTIVE'), false);
  assert.equal(matchesView(items[2], 'WORK:ABANDONED'), true);
});

test('86 Work Items and 94 distinct PRs can validly coexist with 26 matching completed PR filter', () => {
  const items = [];
  for (let id = 1; id <= 14; id++) items.push(workItem(id, [makePR(id, 'completed')]));
  for (let n = 0; n < 72; n++) {
    const prs = [makePR(101 + n, 'active')];
    if (n < 3) prs.push(makePR(173 + n, 'active'));
    if (n < 5) prs.push(makePR(15 + n, 'completed'));
    if (n >= 5 && n < 12) prs.push(makePR(n - 4, 'completed')); // same PR linked to two WIs
    items.push(workItem(15 + n, prs));
  }
  const s = summarize(items);
  assert.deepEqual([s.totalItems, s.completedItems, s.pendingItems, s.totalPRs, s.completedPRs], [86, 14, 72, 94, 19]);
  assert.deepEqual(s.statusCounts, { completed: 19, active: 75 });
  assert.deepEqual(s.workCounts, { PASSED: 14, ACTIVE: 72, ABANDONED: 0, NO_PR: 0, ERROR: 0 });
  assert.equal(items.filter((item) => matchesView(item, 'PR:completed')).length, 26);
  assert.equal(items.filter((item) => matchesView(item, 'PASSED')).length, 14);
  assert.equal(items.filter((item) => matchesView(item, 'WORK:ACTIVE')).length, 72);
});
