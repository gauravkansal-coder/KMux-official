import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TerminalProfileId } from '../terminal/shared/terminal-profiles';
import type { CanvasState, Workspace, Terminal, WidthFraction } from '../types/canvas-types';
import { THEMES, WIDTH_CYCLE } from '../lib/constants';

export type { Workspace, Terminal, WidthFraction };

const createId = (): string => crypto.randomUUID();
const MAX_WORKSPACES = 10;

const createWorkspaceTitle = (workspaces: Workspace[]): string => {
  return `Workspace ${workspaces.length + 1}`;
};

const createWorkspace = (workspaces: Workspace[]): Workspace => {
  return {
    id: createId(),
    title: createWorkspaceTitle(workspaces),
    terminals: [],
    activeTerminalIndex: 0,
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
  if (!activeWorkspace || activeWorkspace.terminals.length > 0 || workspaces.length <= 1) {
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

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      workspaces: [createWorkspace([])],
      activeWorkspaceIndex: 0,
      isOverview: false,
      isSearchOpen: false,
      isTerminalFullscreen: false,
      theme: THEMES.standard,

      setTheme: (themeName: string) => {
        const theme = THEMES[themeName.toLowerCase()];
        if (theme) set({ theme });
      },

      toggleSearch: () => {
        set((state) => ({ isSearchOpen: !state.isSearchOpen }));
      },

      jumpToGlobalTerminal: (terminalId: string) => {
        set((state) => {
          let targetWsIndex = -1;
          let targetTermIndex = -1;

          state.workspaces.forEach((ws, wsIdx) => {
            const termIdx = ws.terminals.findIndex((t) => t.id === terminalId);
            if (termIdx !== -1) {
              targetWsIndex = wsIdx;
              targetTermIndex = termIdx;
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
            activeTerminalIndex: targetTermIndex,
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
              activeWorkspace.terminals.length === 0 ||
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
          const targetIndex = Math.max(0, Math.min(index, ws.terminals.length - 1));

          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = {
            ...ws,
            activeTerminalIndex: targetIndex,
          };
          return { workspaces: updatedWorkspaces, isTerminalFullscreen: false };
        });
      },

      moveTerminal: (direction) => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws || ws.terminals.length === 0) return state;

          const newTerminalIndex =
            direction === 'left'
              ? Math.max(0, ws.activeTerminalIndex - 1)
              : Math.min(ws.terminals.length - 1, ws.activeTerminalIndex + 1);

          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = {
            ...ws,
            activeTerminalIndex: newTerminalIndex,
          };
          return { workspaces: updatedWorkspaces, isTerminalFullscreen: false };
        });
      },

      addTerminal: (profileId?: TerminalProfileId) => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws) return state;

          const newTerminal: Terminal = {
            id: createId(),
            title: `Terminal ${ws.terminals.length + 1}`,
            widthFraction: '2/3',
            profileId,
          };
          const updatedWorkspace: Workspace = {
            ...ws,
            terminals: [...ws.terminals, newTerminal],
            activeTerminalIndex: ws.terminals.length,
          };
          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = updatedWorkspace;
          return { workspaces: updatedWorkspaces };
        });
      },

      removeTerminal: () => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws || ws.terminals.length === 0) return state;

          const newWorkspaces = [...state.workspaces];
          const currentWs = { ...ws, terminals: [...ws.terminals] };

          currentWs.terminals.splice(currentWs.activeTerminalIndex, 1);

          if (currentWs.activeTerminalIndex >= currentWs.terminals.length) {
            currentWs.activeTerminalIndex = Math.max(0, currentWs.terminals.length - 1);
          }

          if (currentWs.terminals.length === 0 && newWorkspaces.length > 1) {
            newWorkspaces.splice(state.activeWorkspaceIndex, 1);

            let newWSIndex = state.activeWorkspaceIndex;
            if (newWSIndex >= newWorkspaces.length) {
              newWSIndex = newWorkspaces.length - 1;
            }

            // Final Re-index to ensure Workspace titles always match their visual order
            return {
              workspaces: reindexWorkspaces(newWorkspaces),
              activeWorkspaceIndex: newWSIndex,
              isTerminalFullscreen: false,
            };
          }

          newWorkspaces[state.activeWorkspaceIndex] = currentWs;
          return { workspaces: newWorkspaces, isTerminalFullscreen: false };
        });
      },

      resizeTerminal: (direction) => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws) return state;
          const term = ws.terminals[ws.activeTerminalIndex];
          if (!term) return state;

          const currentIdx = WIDTH_CYCLE.indexOf(term.widthFraction);
          const nextIdx =
            direction === 'shrink'
              ? Math.min(WIDTH_CYCLE.length - 1, currentIdx + 1)
              : Math.max(0, currentIdx - 1);

          const updatedTerminals = [...ws.terminals];
          updatedTerminals[ws.activeTerminalIndex] = {
            ...term,
            widthFraction: WIDTH_CYCLE[nextIdx],
          };
          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = {
            ...ws,
            terminals: updatedTerminals,
          };
          return { workspaces: updatedWorkspaces };
        });
      },

      cycleWidth: () => {
        set((state) => {
          const ws = state.workspaces[state.activeWorkspaceIndex];
          if (!ws) return state;
          const term = ws.terminals[ws.activeTerminalIndex];
          if (!term) return state;

          const currentIdx = WIDTH_CYCLE.indexOf(term.widthFraction);
          const nextIdx = (currentIdx + 1) % WIDTH_CYCLE.length;

          const updatedTerminals = [...ws.terminals];
          updatedTerminals[ws.activeTerminalIndex] = {
            ...term,
            widthFraction: WIDTH_CYCLE[nextIdx],
          };
          const updatedWorkspaces = [...state.workspaces];
          updatedWorkspaces[state.activeWorkspaceIndex] = {
            ...ws,
            terminals: updatedTerminals,
          };
          return { workspaces: updatedWorkspaces };
        });
      },

      addWorkspace: () => {
        set((state) => {
          const activeWorkspace = state.workspaces[state.activeWorkspaceIndex];
          if (!activeWorkspace || activeWorkspace.terminals.length === 0) {
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
      version: 3,
    },
  ),
);
