import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import test from 'node:test';
import {
  getGitWorkingTreeDiff,
  type GitDiffRuntime,
} from '../../src/diff/main/gitDiff.ts';

interface RuntimeOptions {
  gitDir?: boolean;
  stdout?: string;
  stderr?: string;
  code?: number;
  error?: Error;
  results?: Array<{
    stdout?: string;
    stderr?: string;
    code?: number;
    error?: Error;
  }>;
}

const createRuntime = (options: RuntimeOptions = {}) => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const runtime: GitDiffRuntime = {
    statSync: (() => ({
      isDirectory: () => options.gitDir !== false,
    })) as GitDiffRuntime['statSync'],
    spawn: ((command: string, args: string[]) => {
      calls.push({ command, args });
      const result = options.results?.[calls.length - 1] ?? options;
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: () => void;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = () => {
        queueMicrotask(() => child.emit('close', null));
      };

      queueMicrotask(() => {
        if (result.error) {
          child.emit('error', result.error);
          return;
        }
        if (result.stdout) {
          child.stdout.emit('data', Buffer.from(result.stdout));
        }
        if (result.stderr) {
          child.stderr.emit('data', Buffer.from(result.stderr));
        }
        child.emit('close', result.code ?? 0);
      });

      return child;
    }) as GitDiffRuntime['spawn'],
  };

  return { runtime, calls };
};

test('git diff rejects folders without an exact .git directory', async () => {
  const { runtime, calls } = createRuntime({ gitDir: false });

  const response = await getGitWorkingTreeDiff({ cwd: path.resolve('/tmp/project') }, runtime);

  assert.deepEqual(response, {
    ok: false,
    cwd: path.resolve('/tmp/project'),
    message: 'This folder does not contain a .git directory.',
  });
  assert.equal(calls.length, 0);
});

test('git diff runs against HEAD in the requested cwd', async () => {
  const { runtime, calls } = createRuntime({ stdout: 'diff --git a/a b/a\n' });
  const cwd = path.resolve('/tmp/project');

  const response = await getGitWorkingTreeDiff({ cwd }, runtime);

  assert.deepEqual(response, {
    ok: true,
    cwd,
    patch: 'diff --git a/a b/a\n',
  });
  assert.deepEqual(calls, [
    {
      command: 'git',
      args: ['-C', cwd, 'diff', '--no-ext-diff', '--no-color', 'HEAD', '--'],
    },
  ]);
});

test('git diff returns structured command failures', async () => {
  const { runtime } = createRuntime({ code: 128, stderr: 'fatal: not a git repository\n' });

  const response = await getGitWorkingTreeDiff({ cwd: path.resolve('/tmp/project') }, runtime);

  assert.deepEqual(response, {
    ok: false,
    cwd: path.resolve('/tmp/project'),
    message: 'fatal: not a git repository',
  });
});

test('git diff falls back to the empty tree when HEAD does not exist yet', async () => {
  const cwd = path.resolve('/tmp/project');
  const { runtime, calls } = createRuntime({
    results: [
      { code: 128, stderr: "fatal: bad revision 'HEAD'\n" },
      { stdout: 'diff --git a/a b/a\nnew file mode 100644\n' },
    ],
  });

  const response = await getGitWorkingTreeDiff({ cwd }, runtime);

  assert.deepEqual(response, {
    ok: true,
    cwd,
    patch: 'diff --git a/a b/a\nnew file mode 100644\n',
  });
  assert.deepEqual(calls, [
    {
      command: 'git',
      args: ['-C', cwd, 'diff', '--no-ext-diff', '--no-color', 'HEAD', '--'],
    },
    {
      command: 'git',
      args: [
        '-C',
        cwd,
        'diff',
        '--no-ext-diff',
        '--no-color',
        '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
        '--',
      ],
    },
  ]);
});
