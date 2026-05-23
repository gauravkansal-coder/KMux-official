import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { mainWindowConfig, shouldOpenDevTools } from './config/window';
import { registerDiffIpc } from './diff/main/registerDiffIpc';
import { registerExplorerIpc } from './explorer/main/registerExplorerIpc';
import { TerminalManager } from './terminal/main/TerminalManager';
import { registerTerminalIpc } from './terminal/main/registerTerminalIpc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const terminalManager = new TerminalManager();
const unregisterDiffIpc = registerDiffIpc({ ipcMain });
const unregisterExplorerIpc = registerExplorerIpc({ ipcMain });
const unregisterTerminalIpc = registerTerminalIpc({
  ipcMain,
  getWindows: () => BrowserWindow.getAllWindows(),
  terminalManager,
});

const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    ...mainWindowConfig,
    webPreferences: {
      ...mainWindowConfig.webPreferences,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.setMenu(null);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (shouldOpenDevTools(MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return mainWindow;
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    terminalManager.killAll();
    app.quit();
  }
});

app.on('before-quit', () => {
  unregisterDiffIpc();
  unregisterExplorerIpc();
  unregisterTerminalIpc();
  terminalManager.killAll();
});
