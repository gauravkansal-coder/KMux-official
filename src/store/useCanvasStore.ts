import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TerminalProfileId } from '../terminal/shared/terminal-profiles';
import type {
  CanvasState,
  DiffPanel,
  Terminal,
  WidthFraction,
  Workspace,
  WorkspaceItem,
} from '../types/canvas-types';
import {
  DEFAULT_DIFF_FONT_SIZE,
  DEFAULT_TERMINAL_FONT_SIZE,
  DIFF_FONT_SIZE_STEP,
  MAX_DIFF_FONT_SIZE,
  MAX_TERMINAL_FONT_SIZE,
  MIN_DIFF_FONT_SIZE,
  MIN_TERMINAL_FONT_SIZE,
  TERMINAL_FONT_SIZE_STEP,
  THEMES,
  WIDTH_CYCLE,
} from '../lib/constants';

export type { DiffPanel, Terminal, WidthFraction, Workspace, WorkspaceItem };

const createId = (): string => crypto.randomUUID();
const MAX_WORKSPACES = 10;

const getFontSizeDelta = (direction: 'decrease' | 'increase'): number => {
  return direction === 'increase' ? TERMINAL_FONT_SIZE_STEP : -TERMINAL_FONT_SIZE_STEP;
};

const clampTerminalFontSize = (value: number): number => {
  return Math.min(MAX_TERMINAL_FONT_SIZE, Math.max(MIN_TERMINAL_FONT_SIZE, value));
};

const clampDiffFontSize = (value: number): number => {
  return Math.min(MAX_DIFF_FONT_SIZE, Math.max(MIN_DIFF_FONT_SIZE, value));
};

const getActiveTerminal = (state: CanvasState): Terminal | undefined => {
  const workspace = state.workspaces[state.activeWorkspaceIndex];
  const activeItem = workspace?.items[workspace.activeItemIndex];
  return activeItem?.type === 'terminal' ? activeItem : undefined;
};

const getActiveDiffPanel = (state: CanvasState): DiffPanel | undefined => {
  const workspace = state.workspaces[state.activeWorkspaceIndex];
  const activeItem = workspace?.items[workspace.activeItemIndex];
  return activeItem?.type === 'diff' ? activeItem : undefined;
};

const getTerminalItems = (workspace: Workspace): Terminal[] => {
  return workspace.items.filter((item): item is Terminal => item.type === 'terminal');
};

const createWorkspaceTitle = (workspaces: Workspace[]): string => {
  return `Workspace ${workspaces.length + 1}`;
};

const createWorkspace = (workspaces: Workspace[]): Workspace => {
  return {
    id: createId(),
    title: createWorkspaceTitle(workspaces),
    items: [],
    activeItemIndex: 0,
  };
};

const reindexWorkspaces = (workspaces: Workspace[]): Workspace[] => {
  return workspaces.map((workspace, index) => ({
    ...workspace,
    title: `Workspace ${index + 1}`,
  }));
};

const pruneEmptyWorkspaceOnLeave = (
  workspaces: Workspace[],
  activeWorkspaceIndex: number,
  nextWorkspaceIndex: number,
): { workspaces: Workspace[]; activeWorkspaceIndex: number } => {
  if (activeWorkspaceIndex === nextWorkspaceIndex) {
    return { workspaces, activeWorkspaceIndex };
  }

  const activeWorkspace = workspaces[activeWorkspaceIndex];
  if (!activeWorkspace || activeWorkspace.items.length > 0 || workspaces.length <= 1) {
    return { workspaces, activeWorkspaceIndex: nextWorkspaceIndex };
  }

  const updatedWorkspaces = [...workspaces];
  updatedWorkspaces.splice(activeWorkspaceIndex, 1);

  const adjustedIndex =
    nextWorkspaceIndex > activeWorkspaceIndex ? nextWorkspaceIndex - 1 : nextWorkspaceIndex;

  return {
    workspaces: reindexWorkspaces(updatedWorkspaces),
    activeWorkspaceIndex: Math.max(0, Math.min(adjustedIndex, updatedWorkspaces.length - 1)),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const migrateWorkspace = (workspace: unknown): Workspace | null => {
  if (!isRecord(workspace)) {
    return null;
  }

  const legacyTerminals = Array.isArray(workspace.terminals)
    ? workspace.terminals
    : undefined;
  const rawItems = Array.isArray(workspace.items) ? workspace.items : legacyTerminals;
  if (!rawItems) {
    return null;
  }

  const items = rawItems
    .filter(isRecord)
    .map((item): WorkspaceItem | null => {
      if (typeof item.id !== 'string' || typeof item.widthFraction !== 'string') {
        return null;
      }

      if (item.type === 'diff') {
        if (typeof item.cwd !== 'string') {
          return null;
        }
        return {
          id: item.id,
          type: 'diff',
          title: typeof item.title === 'string' ? item.title : 'Git diff',
          cwd: item.cwd,
          sourceTerminalId:
            typeof item.sourceTerminalId === 'string' ? item.sourceTerminalId : undefined,
          widthFraction: item.widthFraction as WidthFraction,
        };
      }

      return {
        id: item.id,
        type: 'terminal',
        title: typeof item.title === 'string' ? item.title : 'Terminal',
        profileId:
          typeof item.profileId === 'string'
            ? (item.profileId as TerminalProfileId)
            : undefined,
        widthFraction: item.widthFraction as WidthFraction,
      };
    })
    .filter((item): item is WorkspaceItem => item !== null);

  const activeItemIndex =
    typeof workspace.activeItemIndex === 'number'
      ? workspace.activeItemIndex
      : typeof workspace.activeTerminalIndex === 'number'
        ? workspace.activeTerminalIndex
        : 0;

  return {
    id: typeof workspace.id === 'string' ? workspace.id : createId(),
    title: typeof workspace.title === 'string' ? workspace.title : 'Workspace',
    items,
    activeItemIndex: Math.max(0, Math.min(activeItemIndex, Math.max(0, items.length - 1))),
  };
};

const migratePersistedState = (persistedState: unknown): CanvasState | unknown => {
  if (!isRecord(persistedState) || !Array.isArray(persistedState.workspaces)) {
    return persistedState;
  }

  const workspaces = persistedState.workspaces
    .map(migrateWorkspace)
    .filter((workspace): workspace is Workspace => workspace !== null);

  return {
    ...persistedState,
    workspaces: workspaces.length > 0 ? reindexWorkspaces(workspaces) : [createWorkspace([])],
    diffFontSize:
      typeof persistedState.diffFontSize === 'number'
        ? clampDiffFontSize(persistedState.diffFontSize)
        : DEFAULT_DIFF_FONT_SIZE,
    diffFontSizes: isRecord(persistedState.diffFontSizes)
      ? Object.fromEntries(
          Object.entries(persistedState.diffFontSizes)
            .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
            .map(([diffPanelId, fontSize]) => [
              diffPanelId,
              clampDiffFontSize(fontSize),
            ]),
        )
      : {},
  };
};

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      workspaces: [createWorkspace([])],
      activeWorkspaceIndex: 0,
      isOverview: false,
      isSearchOpen: false,
      isControlsOpen: false,
      isExplorerOpen: false,
      isTerminalFullscreen: false,
      terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE,
      terminalFontSizes: {},
      diffFontSize: DEFAULT_DIFF_FONT_SIZE,
      diffFontSizes: {},
      theme: THEMES.standard,

      setTheme: (themeName: string) => {
        const theme = THEMES[themeName.toLowerCase()];
        if (theme) set({ theme });
      },

      toggleSearch: () => {
        set((state) => ({ isSearchOpen: !state.isSearchOpen }));
      },

      toggleControls: () => {
        set((state) => ({ isControlsOpen: !state.isControlsOpen }));
      },

      toggleExplorer: () => {
        set((state) => ({ isExplorerOpen: !state.isExplorerOpen }));
      },

      focusWorkspaceItem: (itemId: string) => {
        set((state) => {
          const workspace = state.workspaces[state.activeWorkspaceIndex];
          if (!workspace) return state;

          const activeItemIndex = workspace.items.findIndex((item) => item.id === itemId);
          if (activeItemIndex === -1) return state;

          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = {
            ...workspace,
            activeItemIndex,
          };

          return {
            workspaces: updatedWorkspaces,
            isTerminalFullscreen: false,
          };
        });
      },

      jumpToGlobalTerminal: (terminalId: string) => {
        set((state) => {
          let targetWsIndex = -1;
          let targetItemIndex = -1;

          state.workspaces.forEach((ws, wsIdx) => {
            const itemIdx = ws.items.findIndex(
              (item) => item.type === 'terminal' && item.id === terminalId,
            );
            if (itemIdx !== -1) {
              targetWsIndex = wsIdx;
              targetItemIndex = itemIdx;
            }
          });

          if (targetWsIndex === -1) return state;

          const navigationState = pruneEmptyWorkspaceOnLeave(
            state.workspaces,
            state.activeWorkspaceIndex,
            targetWsIndex,
          );

          const updatedWorkspaces = [...navigationState.workspaces];
          updatedWorkspaces[navigationState.activeWorkspaceIndex] = {
            ...updatedWorkspaces[navigationState.activeWorkspaceIndex],
            activeItemIndex: targetItemIndex,
          };

          return {
            workspaces: updatedWorkspaces,
            activeWorkspaceIndex: navigationState.activeWorkspaceIndex,
            isSearchOpen: false,
            isTerminalFullscreen: false,
          };
        });
      },

      jumpToWorkspace: (index: number) => {
        set((state) => {
          if (index < 0 || index >= MAX_WORKSPACES) {
            return state;
          }

          const workspaces = [...state.workspaces];
          while (workspaces.length <= index) {
            workspaces.push(createWorkspace(workspaces));
          }

          return {
            workspaces,
            activeWorkspaceIndex: index,
            isSearchOpen: false,
            isTerminalFullscreen: false,
          };
        });
      },

      moveWorkspace: (direction) => {
        set((state) => {
          const isAtBottom = state.activeWorkspaceIndex === state.workspaces.length - 1;
          const activeWorkspace = state.workspaces[state.activeWorkspaceIndex];

          if (direction === 'down' && isAtBottom) {
            if (
              !activeWorkspace ||
              activeWorkspace.items.length === 0 ||
              state.workspaces.length >= MAX_WORKSPACES
            ) {
              return state;
            }
            const newWorkspace = createWorkspace(state.workspaces);
            return {
              workspaces: [...state.workspaces, newWorkspace],
              activeWorkspaceIndex: state.workspaces.length,
            };
          }

          const newIndex =
            direction === 'up'
              ? Math.max(0, state.activeWorkspaceIndex - 1)
              : Math.min(state.workspaces.length - 1, state.activeWorkspaceIndex + 1);
          return {
            activeWorkspaceIndex: newIndex,
            isTerminalFullscreen: false,
          };
        });
      },

      jumpToTerminal: (index: number) => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws) return state;
          const terminalItems = getTerminalItems(ws);
          const targetTerminal = terminalItems[Math.max(0, Math.min(index, terminalItems.length - 1))];
          if (!targetTerminal) return state;
          const targetIndex = ws.items.findIndex((item) => item.id === targetTerminal.id);

          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = {
            ...ws,
            activeItemIndex: targetIndex,
          };
          return { workspaces: updatedWorkspaces, isTerminalFullscreen: false };
        });
      },

      moveTerminal: (direction) => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws || ws.items.length === 0) return state;

          const activeItemIndex =
            direction === 'left'
              ? Math.max(0, ws.activeItemIndex - 1)
              : Math.min(ws.items.length - 1, ws.activeItemIndex + 1);

          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = {
            ...ws,
            activeItemIndex,
          };
          return { workspaces: updatedWorkspaces, isTerminalFullscreen: false };
        });
      },

      addTerminal: (profileId?: TerminalProfileId) => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws) return state;

          const terminalCount = getTerminalItems(ws).length;
          const newTerminal: Terminal = {
            id: createId(),
            type: 'terminal',
            title: `Terminal ${terminalCount + 1}`,
            widthFraction: '2/3',
            profileId,
          };
          const insertIndex = Math.min(ws.activeItemIndex + 1, ws.items.length);
          const updatedWorkspace: Workspace = {
            ...ws,
            items: [
              ...ws.items.slice(0, insertIndex),
              newTerminal,
              ...ws.items.slice(insertIndex),
            ],
            activeItemIndex: insertIndex,
          };
          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = updatedWorkspace;
          return { workspaces: updatedWorkspaces };
        });
      },

      addDiffPanel: (cwd: string, sourceTerminalId?: string) => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws) return state;

          const newDiffPanel: DiffPanel = {
            id: createId(),
            type: 'diff',
            title: 'Git diff',
            cwd,
            sourceTerminalId,
            widthFraction: '1',
          };
          const insertIndex = Math.min(ws.activeItemIndex + 1, ws.items.length);
          const updatedWorkspace: Workspace = {
            ...ws,
            items: [
              ...ws.items.slice(0, insertIndex),
              newDiffPanel,
              ...ws.items.slice(insertIndex),
            ],
            activeItemIndex: insertIndex,
          };
          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = updatedWorkspace;
          return {
            workspaces: updatedWorkspaces,
            isTerminalFullscreen: false,
            isSearchOpen: false,
          };
        });
      },

      removeTerminal: () => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws || ws.items.length === 0) return state;

          const newWorkspaces = [...state.workspaces];
          const currentWs = { ...ws, items: [...ws.items] };
          const removedItem = ws.items[ws.activeItemIndex];

          currentWs.items.splice(currentWs.activeItemIndex, 1);

          if (currentWs.activeItemIndex >= currentWs.items.length) {
            currentWs.activeItemIndex = Math.max(0, currentWs.items.length - 1);
          }

          if (currentWs.items.length === 0 && newWorkspaces.length > 1) {
            newWorkspaces.splice(state.activeWorkspaceIndex, 1);

            let newWSIndex = state.activeWorkspaceIndex;
            if (newWSIndex >= newWorkspaces.length) {
              newWSIndex = newWorkspaces.length - 1;
            }

            // Final Re-index to ensure Workspace titles always match their visual order
            return {
              workspaces: reindexWorkspaces(newWorkspaces),
              terminalFontSizes: Object.fromEntries(
                Object.entries(state.terminalFontSizes).filter(
                  ([terminalId]) =>
                    removedItem?.type !== 'terminal' || terminalId !== removedItem.id,
                ),
              ),
              diffFontSizes: Object.fromEntries(
                Object.entries(state.diffFontSizes).filter(
                  ([diffPanelId]) =>
                    removedItem?.type !== 'diff' || diffPanelId !== removedItem.id,
                ),
              ),
              activeWorkspaceIndex: newWSIndex,
              isTerminalFullscreen: false,
            };
          }

          newWorkspaces[state.activeWorkspaceIndex] = currentWs;
          return {
            workspaces: newWorkspaces,
            terminalFontSizes: Object.fromEntries(
              Object.entries(state.terminalFontSizes).filter(
                ([terminalId]) =>
                  removedItem?.type !== 'terminal' || terminalId !== removedItem.id,
              ),
            ),
            diffFontSizes: Object.fromEntries(
              Object.entries(state.diffFontSizes).filter(
                ([diffPanelId]) =>
                  removedItem?.type !== 'diff' || diffPanelId !== removedItem.id,
              ),
            ),
            isTerminalFullscreen: false,
          };
        });
      },

      resizeTerminal: (direction) => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws) return state;
          const item = ws.items[ws.activeItemIndex];
          if (!item) return state;

          const currentIdx = WIDTH_CYCLE.indexOf(item.widthFraction);
          const nextIdx =
            direction === 'shrink'
              ? Math.min(WIDTH_CYCLE.length - 1, currentIdx + 1)
              : Math.max(0, currentIdx - 1);

          const updatedItems = [...ws.items];
          updatedItems[ws.activeItemIndex] = {
            ...item,
            widthFraction: WIDTH_CYCLE[nextIdx],
          } as WorkspaceItem;
          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = {
            ...ws,
            items: updatedItems,
          };
          return { workspaces: updatedWorkspaces };
        });
      },

      cycleWidth: () => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws) return state;
          const item = ws.items[ws.activeItemIndex];
          if (!item) return state;

          const currentIdx = WIDTH_CYCLE.indexOf(item.widthFraction);
          const nextIdx = (currentIdx + 1) % WIDTH_CYCLE.length;

          const updatedItems = [...ws.items];
          updatedItems[ws.activeItemIndex] = {
            ...item,
            widthFraction: WIDTH_CYCLE[nextIdx],
          } as WorkspaceItem;
          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = {
            ...ws,
            items: updatedItems,
          };
          return { workspaces: updatedWorkspaces };
        });
      },

      adjustActiveTerminalFontSize: (direction) => {
        set((state) => {
          const activeTerminal = getActiveTerminal(state);
          if (!activeTerminal) {
            return state;
          }

          const currentFontSize =
            state.terminalFontSizes[activeTerminal.id] ?? state.terminalFontSize;
          return {
            terminalFontSizes: {
              ...state.terminalFontSizes,
              [activeTerminal.id]: clampTerminalFontSize(
                currentFontSize + getFontSizeDelta(direction),
              ),
            },
          };
        });
      },

      adjustGlobalTerminalFontSize: (direction) => {
        set((state) => {
          const delta = getFontSizeDelta(direction);
          const terminalFontSizes = Object.fromEntries(
            Object.entries(state.terminalFontSizes).map(([terminalId, fontSize]) => [
              terminalId,
              clampTerminalFontSize(fontSize + delta),
            ]),
          );
          return {
            terminalFontSize: clampTerminalFontSize(state.terminalFontSize + delta),
            terminalFontSizes,
          };
        });
      },

      adjustActiveDiffFontSize: (direction) => {
        set((state) => {
          const activeDiffPanel = getActiveDiffPanel(state);
          if (!activeDiffPanel) {
            return state;
          }

          const delta = direction === 'increase' ? DIFF_FONT_SIZE_STEP : -DIFF_FONT_SIZE_STEP;
          const diffFontSizes = state.diffFontSizes ?? {};
          const currentFontSize =
            diffFontSizes[activeDiffPanel.id] ??
            state.diffFontSize ??
            DEFAULT_DIFF_FONT_SIZE;

          return {
            diffFontSizes: {
              ...diffFontSizes,
              [activeDiffPanel.id]: clampDiffFontSize(currentFontSize + delta),
            },
          };
        });
      },

      addWorkspace: () => {
        set((state) => {
          const activeWorkspace = state.workspaces[state.activeWorkspaceIndex];
          if (!activeWorkspace || activeWorkspace.items.length === 0) {
            return state;
          }
          if (state.workspaces.length >= MAX_WORKSPACES) {
            return state;
          }
          const newWorkspaces = [...state.workspaces];
          newWorkspaces.push(createWorkspace(newWorkspaces));

          return {
            workspaces: newWorkspaces,
            activeWorkspaceIndex: newWorkspaces.length - 1,
          };
        });
      },

      toggleOverview: () => {
        set((state) => ({ isOverview: !state.isOverview }));
      },

      toggleTerminalFullscreen: () => {
        set((state) => ({
          isTerminalFullscreen: !state.isTerminalFullscreen,
          isOverview: false,
        }));
      },

      cycleThemes: () => {
        const themeKeys = Object.keys(THEMES);
        const currentThemeName = get().theme.name;
        const currentIdx = themeKeys.indexOf(
          themeKeys.find((k) => THEMES[k].name === currentThemeName) || 'standard',
        );
        const nextIdx = (currentIdx + 1) % themeKeys.length;
        set({ theme: THEMES[themeKeys[nextIdx]] });
      },
    }),
    {
      name: 'kmux-storage',
      storage: createJSONStorage(() => localStorage),
      version: 5,
      migrate: migratePersistedState,
    },
  ),
);
