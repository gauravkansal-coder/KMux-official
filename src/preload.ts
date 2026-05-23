import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { DIFF_IPC_CHANNELS } from './diff/shared/diff-ipc';
import type { DiffApi } from './diff/shared/diff-types';
import { TERMINAL_IPC_CHANNELS } from './terminal/shared/terminal-ipc';
import type {
  TerminalApi,
  TerminalErrorEvent,
  TerminalExitEvent,
  TerminalOutputEvent,
  TerminalProfile,
  TerminalSessionSnapshot,
  TerminalStateEvent,
} from './terminal/shared/terminal-types';

const subscribe = <T>(channel: string, listener: (event: T) => void): (() => void) => {
  const wrapped = (_event: IpcRendererEvent, payload: T): void => {
    listener(payload);
  };
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
};

const terminalApi: TerminalApi = {
  createTerminal: async (request) => {
    return ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.create, request);
  },
  writeTerminal: async (request) => {
    ipcRenderer.send(TERMINAL_IPC_CHANNELS.write, request);
  },
  resizeTerminal: async (request) => {
    ipcRenderer.send(TERMINAL_IPC_CHANNELS.resize, request);
  },
  killTerminal: async (request) => {
    await ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.kill, request);
  },
  listTerminals: async (): Promise<TerminalSessionSnapshot[]> => {
    return ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.list);
  },
  listTerminalProfiles: async (): Promise<TerminalProfile[]> => {
    return ipcRenderer.invoke(TERMINAL_IPC_CHANNELS.listProfiles);
  },
  onTerminalOutput: (listener) => {
    return subscribe<TerminalOutputEvent>(TERMINAL_IPC_CHANNELS.output, listener);
  },
  onTerminalExit: (listener) => {
    return subscribe<TerminalExitEvent>(TERMINAL_IPC_CHANNELS.exit, listener);
  },
  onTerminalState: (listener) => {
    return subscribe<TerminalStateEvent>(TERMINAL_IPC_CHANNELS.state, listener);
  },
  onTerminalError: (listener) => {
    return subscribe<TerminalErrorEvent>(TERMINAL_IPC_CHANNELS.error, listener);
  },
};

const diffApi: DiffApi = {
  getGitWorkingTreeDiff: async (request) => {
    return ipcRenderer.invoke(DIFF_IPC_CHANNELS.getGitWorkingTreeDiff, request);
  },
};

contextBridge.exposeInMainWorld('terminalApi', terminalApi);
contextBridge.exposeInMainWorld('diffApi', diffApi);
