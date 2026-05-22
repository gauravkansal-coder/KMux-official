import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import type { ITheme } from '@xterm/xterm';

export interface XtermInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
}

export const createXterm = (theme: ITheme, fontSize: number): XtermInstance => {
  const terminal = new Terminal({
    allowTransparency: true,
    convertEol: true,
    cursorBlink: true,
    fontFamily: 'JetBrains Mono, IBM Plex Mono, monospace',
    fontSize,
    lineHeight: 1.25,
    scrollback: 5000,
    theme,
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  return { terminal, fitAddon };
};
