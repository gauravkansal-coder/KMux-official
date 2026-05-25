import assert from 'node:assert/strict';
import test from 'node:test';
import { fuzzyIncludes } from '../../src/lib/fuzzySearch.ts';
import { getTerminalSearchText } from '../../src/terminal/shared/cwd-format.ts';
import type { TerminalSessionSnapshot } from '../../src/terminal/shared/terminal-types.ts';

test('fuzzy search matches non-contiguous terminal labels and commands', () => {
  assert.equal(fuzzyIncludes('pnpm dev ws 1', 'pdv'), true);
  assert.equal(fuzzyIncludes('Terminal 12', 'tm12'), true);
  assert.equal(fuzzyIncludes('Terminal 12', 't21'), false);
});

test('fuzzy search matches WSL cwd fields in terminal search text', () => {
  const session: TerminalSessionSnapshot = {
    terminalId: 'terminal-1',
    pid: 1,
    shell: 'bash',
    foregroundProcess: 'node server.js',
    cwd: '\\\\wsl.localhost\\Ubuntu\\home\\abhi',
    currentCwd: {
      path: '\\\\wsl.localhost\\Ubuntu\\home\\abhi\\kmux-final',
      host: undefined,
      isLocal: true,
      source: 'probe',
      updatedAt: 1,
    },
    cols: 120,
    rows: 30,
    status: 'running',
  };

  const searchText = getTerminalSearchText(session, 'Terminal 1', 'ws 1', 'kmux-final');

  assert.equal(fuzzyIncludes(searchText, 'wsl'), true);
  assert.equal(fuzzyIncludes(searchText, 'ubkm'), true);
  assert.equal(fuzzyIncludes(searchText, 'srv-prod'), false);
});
