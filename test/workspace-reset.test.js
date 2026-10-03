import test from 'node:test';
import assert from 'node:assert/strict';
import { isWorkspaceResetShortcut } from '../src/workspace-reset.js';

test('solo la recarga con Ctrl y Shift reinicia los datos, también con Command en Mac', () => {
  assert.equal(isWorkspaceResetShortcut({ key: 'R', ctrlKey: true, shiftKey: true }), true);
  assert.equal(isWorkspaceResetShortcut({ key: 'r', metaKey: true, shiftKey: true }), true);
  assert.equal(isWorkspaceResetShortcut({ code: 'KeyR', key: 'к', ctrlKey: true, shiftKey: true }), true);
  for (const event of [
    { key: 'F5' },
    { key: 'r', ctrlKey: true },
    { key: 'R', shiftKey: true },
    { key: 'R', ctrlKey: true, shiftKey: true, altKey: true },
    { key: 'S', ctrlKey: true, shiftKey: true },
    {},
  ]) assert.equal(isWorkspaceResetShortcut(event), false);
});
