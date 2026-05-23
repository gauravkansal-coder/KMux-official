import type { DiffApi } from '../diff/shared/diff-types';
import type { ExplorerApi } from '../explorer/shared/explorer-types';
import type { TerminalApi } from '../terminal/shared/terminal-types';

declare global {
  interface Window {
    diffApi: DiffApi;
    explorerApi: ExplorerApi;
    terminalApi: TerminalApi;
  }
}

export {};
