import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { listDirectory } from '../../src/explorer/main/fileExplorer.ts';
import { assertListDirectoryRequest } from '../../src/explorer/shared/explorer-ipc.ts';

const makeTempDir = async (): Promise<string> => {
  return fs.mkdtemp(path.join(os.tmpdir(), 'kmux-explorer-'));
};

test('file explorer lists directories before files and includes hidden entries', async () => {
  const cwd = await makeTempDir();
  await fs.mkdir(path.join(cwd, 'src'));
  await fs.mkdir(path.join(cwd, 'docs'));
  await fs.writeFile(path.join(cwd, 'README.md'), '');
  await fs.writeFile(path.join(cwd, '.env'), '');

  const response = await listDirectory({ cwd });

  assert.equal(response.ok, true);
  if (!response.ok) return;

  assert.deepEqual(
    response.entries.map((entry) => entry.path),
    ['docs/', 'src/', '.env', 'README.md'],
  );
});

test('file explorer lists children relative to cwd', async () => {
  const cwd = await makeTempDir();
  await fs.mkdir(path.join(cwd, 'src'));
  await fs.writeFile(path.join(cwd, 'src', 'App.tsx'), '');

  const response = await listDirectory({ cwd, relativePath: 'src/' });

  assert.equal(response.ok, true);
  if (!response.ok) return;

  assert.deepEqual(response.entries, [
    {
      name: 'App.tsx',
      path: 'src/App.tsx',
      kind: 'file',
    },
  ]);
});

test('file explorer treats symlinked directories as files to avoid traversal loops', async (t) => {
  const cwd = await makeTempDir();
  await fs.mkdir(path.join(cwd, 'target'));

  try {
    await fs.symlink(path.join(cwd, 'target'), path.join(cwd, 'linked'));
  } catch {
    t.skip('symlink creation is unavailable in this environment');
    return;
  }

  const response = await listDirectory({ cwd });

  assert.equal(response.ok, true);
  if (!response.ok) return;

  assert.equal(response.entries.find((entry) => entry.name === 'linked')?.kind, 'file');
});

test('file explorer returns a typed failure for missing directories', async () => {
  const cwd = await makeTempDir();
  const response = await listDirectory({ cwd, relativePath: 'missing/' });

  assert.equal(response.ok, false);
  if (response.ok) return;

  assert.equal(response.cwd, cwd);
  assert.equal(response.relativePath, 'missing');
  assert.match(response.message, /ENOENT|no such file/i);
});

test('file explorer rejects paths that escape cwd', async () => {
  const cwd = await makeTempDir();

  await assert.rejects(
    () => listDirectory({ cwd, relativePath: '../outside' }),
    /relativePath must stay inside cwd/,
  );
});

test('explorer IPC validates list directory payloads', () => {
  assert.doesNotThrow(() => {
    assertListDirectoryRequest({ cwd: '/tmp/project', relativePath: 'src/' });
  });
  assert.throws(() => assertListDirectoryRequest({ cwd: '' }), /Invalid cwd/);
  assert.throws(
    () => assertListDirectoryRequest({ cwd: '/tmp/project', relativePath: 1 }),
    /Invalid relativePath/,
  );
});
