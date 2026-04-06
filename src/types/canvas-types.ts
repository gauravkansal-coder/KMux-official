export type WidthFraction = '1/3' | '1/2' | '2/3' | '1';

export interface Terminal {
  id: string;
  title: string;
  widthFraction: WidthFraction; // Defined in layout.ts to return VW floats
}

export interface Workspace {
  id: string;
  title: string;
  terminals: Terminal[];
  activeTerminalIndex: number; // horizontal offset 0, 1, 2...
}

export interface Theme {
  name: string;
  bg: string;
  panelBg: string;
  accent: string;
  text: string;
  textDim: string;
  border: string;
}

export interface CanvasState {
  workspaces: Workspace[];
  activeWorkspaceIndex: number; // vertical offset 0, 1, 2...
  isOverview: boolean;          // CanvasContainer uses this for scale(0.28) zoom-out
  isSearchOpen: boolean;
  theme: Theme;

  setTheme: (themeName: string) => void;
  cycleThemes: () => void;
  toggleSearch: () => void;
  jumpToGlobalTerminal: (terminalId: string) => void;
  moveWorkspace: (direction: 'up' | 'down') => void;
  moveTerminal: (direction: 'left' | 'right') => void;
  jumpToTerminal: (index: number) => void;
  addTerminal: () => void;
  addWorkspace: () => void;
  removeTerminal: () => void;
  resizeTerminal: (direction: 'shrink' | 'expand') => void;
  cycleWidth: () => void;
  toggleOverview: () => void;
}
