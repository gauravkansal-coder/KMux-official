import type { IpcMain } from 'electron';
import { assertListDirectoryRequest, EXPLORER_IPC_CHANNELS } from '../shared/explorer-ipc';
import { listDirectory } from './fileExplorer';

interface RegisterExplorerIpcOptions {
  ipcMain: IpcMain;
}

export const registerExplorerIpc = ({
  ipcMain,
}: RegisterExplorerIpcOptions): (() => void) => {
  ipcMain.handle(EXPLORER_IPC_CHANNELS.listDirectory, (_event, payload: unknown) => {
    assertListDirectoryRequest(payload);
    return listDirectory(payload);
  });

  return () => {
    ipcMain.removeHandler(EXPLORER_IPC_CHANNELS.listDirectory);
  };
};
