import type { TerminalProfileId } from '../terminal/shared/terminal-profiles';

/**
 * Spatial Alignment Constants (vw)
 */
export type WidthFraction = '1/3' | '1/2' | '2/3' | '1';

/**
 * Unified Workspace Item Interfaces
 */
export interface TerminalPanelItem {
  id: string;
  type: 'terminal';
  title: string;
  profileId?: TerminalProfileId;
  widthFraction: WidthFraction;
}

export interface DiffPanelItem {
  id: string;
  type: 'diff';
  title: string;
  cwd: string;
  sourceTerminalId?: string;
  widthFraction: WidthFraction;
}

export type Terminal = TerminalPanelItem;
export type DiffPanel = DiffPanelItem;
export type WorkspaceItem = TerminalPanelItem | DiffPanelItem;

/**
 * Unified Workspace Interface
 */
export interface Workspace {
  id: string;
  title: string;
  items: WorkspaceItem[];
  activeItemIndex: number;
}

/**
 * Standard KMux Theme Definition
 */
export interface Theme {
  name: string;
  bg: string;
  panelBg: string;
  accent: string;
  text: string;
  textDim: string;
  border: string;
}

/**
 * Global Canvas State Machine
 */
export interface CanvasState {
  workspaces: Workspace[];
  activeWorkspaceIndex: number;
  isOverview: boolean;
  isSearchOpen: boolean;
  isControlsOpen: boolean;
  isExplorerOpen: boolean;
  isTerminalFullscreen: boolean;
  terminalFontSize: number;
  terminalFontSizes: Record<string, number>;
  diffFontSize: number;
  diffFontSizes: Record<string, number>;
  theme: Theme;

  setTheme: (themeName: string) => void;
  cycleThemes: () => void;
  toggleSearch: () => void;
  toggleControls: () => void;
  toggleExplorer: () => void;
  focusWorkspaceItem: (itemId: string) => void;
  jumpToGlobalTerminal: (terminalId: string) => void;
  jumpToWorkspace: (index: number) => void;
  moveWorkspace: (direction: 'up' | 'down') => void;
  moveTerminal: (direction: 'left' | 'right') => void;
  jumpToTerminal: (index: number) => void;
  addTerminal: (profileId?: TerminalProfileId) => void;
  addDiffPanel: (cwd: string, sourceTerminalId?: string) => void;
  addWorkspace: (profileId?: TerminalProfileId) => void;
  removeTerminal: () => void;
  resizeTerminal: (direction: 'shrink' | 'expand') => void;
  adjustActiveTerminalFontSize: (direction: 'decrease' | 'increase') => void;
  adjustGlobalTerminalFontSize: (direction: 'decrease' | 'increase') => void;
  adjustActiveDiffFontSize: (direction: 'decrease' | 'increase') => void;
  cycleWidth: () => void;
  toggleOverview: () => void;
  toggleTerminalFullscreen: () => void;
}
