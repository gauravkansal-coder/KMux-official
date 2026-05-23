import type { BrowserWindow, IpcMain, IpcMainEvent } from 'electron';
import {
  TERMINAL_IPC_CHANNELS,
  assertCreateTerminalRequest,
  assertKillTerminalRequest,
  assertResizeTerminalRequest,
  assertWriteTerminalRequest,
} from '../shared/terminal-ipc';
import type {
  TerminalErrorEvent,
  TerminalExitEvent,
  TerminalOutputEvent,
  TerminalStateEvent,
} from '../shared/terminal-types';
import { TerminalManager } from './TerminalManager';

interface RegisterTerminalIpcOptions {
  ipcMain: IpcMain;
  getWindows: () => BrowserWindow[];
  terminalManager: TerminalManager;
}

const broadcastToWindows = <T>(
  windows: BrowserWindow[],
  channel: string,
  payload: T,
): void => {
  for (const window of windows) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      continue;
    }
    window.webContents.send(channel, payload);
  }
};

export const registerTerminalIpc = ({
  ipcMain,
  getWindows,
  terminalManager,
}: RegisterTerminalIpcOptions): (() => void) => {
  const reportMutationError = (payload: unknown, error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error);
    const terminalId =
      typeof payload === 'object' &&
      payload !== null &&
      'terminalId' in payload &&
      typeof payload.terminalId === 'string'
        ? payload.terminalId
        : '';

    console.error(
      terminalId.length > 0
        ? `Terminal IPC mutation failed for "${terminalId}": ${message}`
        : `Terminal IPC mutation failed: ${message}`,
    );
  };

  ipcMain.handle(TERMINAL_IPC_CHANNELS.create, (_event, payload: unknown) => {
    assertCreateTerminalRequest(payload);
    return terminalManager.createTerminal(payload);
  });

  ipcMain.handle(TERMINAL_IPC_CHANNELS.write, (_event, payload: unknown) => {
    assertWriteTerminalRequest(payload);
    terminalManager.writeTerminal(payload);
  });

  ipcMain.handle(TERMINAL_IPC_CHANNELS.resize, (_event, payload: unknown) => {
    assertResizeTerminalRequest(payload);
    terminalManager.resizeTerminal(payload);
  });

  const onWrite = (_event: IpcMainEvent, payload: unknown): void => {
    try {
      assertWriteTerminalRequest(payload);
      terminalManager.writeTerminal(payload);
    } catch (error) {
      reportMutationError(payload, error);
    }
  };

  const onResize = (_event: IpcMainEvent, payload: unknown): void => {
    try {
      assertResizeTerminalRequest(payload);
      terminalManager.resizeTerminal(payload);
    } catch (error) {
      reportMutationError(payload, error);
    }
  };

  ipcMain.on(TERMINAL_IPC_CHANNELS.write, onWrite);
  ipcMain.on(TERMINAL_IPC_CHANNELS.resize, onResize);

  ipcMain.handle(TERMINAL_IPC_CHANNELS.kill, (_event, payload: unknown) => {
    assertKillTerminalRequest(payload);
    terminalManager.killTerminal(payload);
  });

  ipcMain.handle(TERMINAL_IPC_CHANNELS.list, () => {
    return terminalManager.listTerminals();
  });

  ipcMain.handle(TERMINAL_IPC_CHANNELS.listProfiles, () => {
    return terminalManager.listProfiles();
  });

  let outputFlushTimer: NodeJS.Timeout | null = null;
  const pendingOutput = new Map<string, string[]>();

  const flushOutput = (): void => {
    outputFlushTimer = null;
    const windows = getWindows();
    for (const [terminalId, chunks] of pendingOutput) {
      broadcastToWindows(windows, TERMINAL_IPC_CHANNELS.output, {
        terminalId,
        data: chunks.join(''),
      } satisfies TerminalOutputEvent);
    }
    pendingOutput.clear();
  };

  const detachOutput = terminalManager.onOutput((event: TerminalOutputEvent) => {
    const chunks = pendingOutput.get(event.terminalId);
    if (chunks) {
      chunks.push(event.data);
    } else {
      pendingOutput.set(event.terminalId, [event.data]);
    }
    if (outputFlushTimer === null) {
      outputFlushTimer = setTimeout(flushOutput, 8);
    }
  });
  const detachExit = terminalManager.onExit((event: TerminalExitEvent) => {
    broadcastToWindows(getWindows(), TERMINAL_IPC_CHANNELS.exit, event);
  });
  const detachState = terminalManager.onState((event: TerminalStateEvent) => {
    broadcastToWindows(getWindows(), TERMINAL_IPC_CHANNELS.state, event);
  });
  const detachError = terminalManager.onError((event: TerminalErrorEvent) => {
    broadcastToWindows(getWindows(), TERMINAL_IPC_CHANNELS.error, event);
  });

  return () => {
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.create);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.write);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.resize);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.kill);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.list);
    ipcMain.removeHandler(TERMINAL_IPC_CHANNELS.listProfiles);
    ipcMain.removeListener(TERMINAL_IPC_CHANNELS.write, onWrite);
    ipcMain.removeListener(TERMINAL_IPC_CHANNELS.resize, onResize);

    if (outputFlushTimer !== null) {
      clearTimeout(outputFlushTimer);
      outputFlushTimer = null;
    }
    pendingOutput.clear();
    detachOutput();
    detachExit();
    detachState();
    detachError();
  };
};
