import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import {
  probeWindowsForegroundProcess,
  _resetCache,
  type WinForegroundProbeRuntime,
} from '../../src/terminal/main/cwd/win-foreground.ts';

const createFakeRuntime = (processTree: string): WinForegroundProbeRuntime => ({
  runCommand: () => ({ status: 0, stdout: processTree }),
});

const createFailingRuntime = (): WinForegroundProbeRuntime => ({
  runCommand: () => ({ status: 1, stdout: '' }),
});

// Clear the cache before each test to avoid cross-test pollution
beforeEach(() => {
  _resetCache();
});

test('probeWindowsForegroundProcess finds deepest child process', () => {
  // Simulate: shell (PID 100) -> node.exe (PID 200) -> python.exe (PID 300)
  const runtime = createFakeRuntime(
    [
      '100,1,powershell.exe',
      '200,100,node.exe',
      '300,200,python.exe',
      '400,1,explorer.exe', // unrelated process
    ].join('\n'),
  );

  const result = probeWindowsForegroundProcess(100, runtime);
  assert.equal(result, 'python');
});

test('probeWindowsForegroundProcess returns direct child when no deeper children exist', () => {
  const runtime = createFakeRuntime(
    [
      '100,1,powershell.exe',
      '200,100,vim.exe',
    ].join('\n'),
  );

  const result = probeWindowsForegroundProcess(100, runtime);
  assert.equal(result, 'vim');
});

test('probeWindowsForegroundProcess skips conhost.exe', () => {
  const runtime = createFakeRuntime(
    [
      '100,1,powershell.exe',
      '200,100,conhost.exe',
      '300,100,node.exe',
    ].join('\n'),
  );

  const result = probeWindowsForegroundProcess(100, runtime);
  assert.equal(result, 'node');
});

test('probeWindowsForegroundProcess returns undefined when shell has no children', () => {
  const runtime = createFakeRuntime(
    [
      '100,1,powershell.exe',
      '200,50,explorer.exe',
    ].join('\n'),
  );

  const result = probeWindowsForegroundProcess(100, runtime);
  assert.equal(result, undefined);
});

test('probeWindowsForegroundProcess returns undefined for null/invalid PID', () => {
  const runtime = createFakeRuntime('');

  assert.equal(probeWindowsForegroundProcess(null, runtime), undefined);
  assert.equal(probeWindowsForegroundProcess(0, runtime), undefined);
  assert.equal(probeWindowsForegroundProcess(-1, runtime), undefined);
});

test('probeWindowsForegroundProcess returns undefined when command fails', () => {
  const runtime = createFailingRuntime();
  const result = probeWindowsForegroundProcess(100, runtime);
  assert.equal(result, undefined);
});

test('probeWindowsForegroundProcess strips .exe extension from result', () => {
  const runtime = createFakeRuntime(
    [
      '100,1,powershell.exe',
      '200,100,pnpm.exe',
    ].join('\n'),
  );

  const result = probeWindowsForegroundProcess(100, runtime);
  assert.equal(result, 'pnpm');
});

test('probeWindowsForegroundProcess handles processes without .exe extension', () => {
  const runtime = createFakeRuntime(
    [
      '100,1,powershell.exe',
      '200,100,ruby',
    ].join('\n'),
  );

  const result = probeWindowsForegroundProcess(100, runtime);
  assert.equal(result, 'ruby');
});

test('probeWindowsForegroundProcess handles circular references without infinite loop', () => {
  // Simulate a circular parent-child relationship (shouldn't happen in practice)
  const runtime = createFakeRuntime(
    [
      '100,200,process_a.exe',
      '200,100,process_b.exe',
    ].join('\n'),
  );

  // Should not hang — the visited set prevents infinite loops
  const result = probeWindowsForegroundProcess(100, runtime);
  assert.ok(result === 'process_a' || result === 'process_b');
});
