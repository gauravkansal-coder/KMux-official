import { FileTree, useFileTree } from '@pierre/trees/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { formatCwdHint } from '../terminal/shared/cwd-format';
import { useTerminalRuntime } from '../terminal/renderer/context/useTerminalRuntime';
import type { ExplorerDirectoryEntry } from '../explorer/shared/explorer-types';
import { EXPLORER_SIDEBAR_WIDTH_PX } from '../lib/constants';

type ExplorerStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unavailable';

const ROOT_DIRECTORY = '';

const isHTMLElement = (value: EventTarget | null): value is HTMLElement => {
  return value instanceof HTMLElement;
};

const findTreeItemElement = (event: React.SyntheticEvent<HTMLElement>): HTMLElement | null => {
  const nativeEvent = event.nativeEvent;
  const path = typeof nativeEvent.composedPath === 'function' ? nativeEvent.composedPath() : [];
  for (const target of path) {
    if (!isHTMLElement(target)) {
      continue;
    }
    if (target.dataset.itemPath && target.dataset.itemType) {
      return target;
    }
  }
  return null;
};

const getFolderName = (cwd: string): string => {
  const normalized = cwd.replace(/[\\/]+$/u, '');
  const segments = normalized.split(/[\\/]/u).filter(Boolean);
  return segments.at(-1) ?? cwd;
};

const toPathList = (entries: ExplorerDirectoryEntry[]): string[] => {
  return entries.map((entry) => entry.path);
};

export const ExplorerSidebar: React.FC = () => {
  const workspaces = useCanvasStore((state) => state.workspaces);
  const activeWorkspaceIndex = useCanvasStore((state) => state.activeWorkspaceIndex);
  const theme = useCanvasStore((state) => state.theme);
  const { sessions } = useTerminalRuntime();

  const activeWorkspace = workspaces[activeWorkspaceIndex];
  const activeItem = activeWorkspace?.items[activeWorkspace.activeItemIndex];
  const activeTerminal = activeItem?.type === 'terminal' ? activeItem : undefined;
  const activeSession = activeTerminal ? sessions[activeTerminal.id] : undefined;
  const cwdHint = formatCwdHint(activeSession?.currentCwd, activeSession?.cwd);
  const activeCurrentCwd = activeSession?.currentCwd;
  const cwd =
    activeCurrentCwd && activeCurrentCwd.isLocal
      ? activeCurrentCwd.path
      : activeCurrentCwd && !activeCurrentCwd.isLocal
        ? ''
        : activeSession?.cwd ?? '';
  const terminalKey = `${activeTerminal?.id ?? 'none'}:${cwd}`;

  const { model } = useFileTree({
    fileTreeSearchMode: 'hide-non-matches',
    flattenEmptyDirectories: false,
    initialExpansion: 'closed',
    paths: [],
    search: true,
    searchBlurBehavior: 'retain',
  });

  const [status, setStatus] = useState<ExplorerStatus>('idle');
  const [message, setMessage] = useState('');
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const loadedDirectoriesRef = useRef<Set<string>>(new Set());
  const loadingDirectoriesRef = useRef<Set<string>>(new Set());
  const requestVersionRef = useRef(0);

  const loadDirectory = useCallback(
    async (relativePath: string, options?: { replace?: boolean }): Promise<void> => {
      if (!cwd) {
        return;
      }

      const replace = options?.replace === true;
      const requestVersion = requestVersionRef.current;
      if (loadingDirectoriesRef.current.has(relativePath)) {
        return;
      }

      loadingDirectoriesRef.current.add(relativePath);
      setLoadingPath(relativePath);
      if (replace) {
        setStatus('loading');
        setMessage('');
      }

      try {
        const response = await window.explorerApi.listDirectory({
          cwd,
          relativePath,
        });

        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        if (!response.ok) {
          if (replace) {
            model.resetPaths([]);
            setStatus('error');
          }
          setMessage(response.message);
          return;
        }

        loadedDirectoriesRef.current.add(relativePath);
        setMessage('');

        if (replace) {
          model.resetPaths(toPathList(response.entries), { initialExpandedPaths: [] });
          setStatus(response.entries.length === 0 ? 'empty' : 'ready');
          return;
        }

        for (const entry of response.entries) {
          if (!model.getItem(entry.path)) {
            model.add(entry.path);
          }
        }

        const directoryItem = model.getItem(relativePath);
        if (directoryItem && 'expand' in directoryItem) {
          directoryItem.expand();
        }
      } catch (error) {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }
        const nextMessage = error instanceof Error ? error.message : String(error);
        if (replace) {
          model.resetPaths([]);
          setStatus('error');
        }
        setMessage(nextMessage);
      } finally {
        loadingDirectoriesRef.current.delete(relativePath);
        if (requestVersion === requestVersionRef.current) {
          setLoadingPath(null);
        }
      }
    },
    [cwd, model],
  );

  const ensureDirectoryLoaded = useCallback(
    async (relativePath: string): Promise<void> => {
      if (loadedDirectoriesRef.current.has(relativePath)) {
        return;
      }
      await loadDirectory(relativePath);
    },
    [loadDirectory],
  );

  useEffect(() => {
    requestVersionRef.current += 1;
    loadedDirectoriesRef.current.clear();
    loadingDirectoriesRef.current.clear();
    setLoadingPath(null);
    setMessage('');

    if (!activeTerminal) {
      model.resetPaths([]);
      setStatus('idle');
      return;
    }

    if (activeCurrentCwd && !activeCurrentCwd.isLocal) {
      model.resetPaths([]);
      setStatus('unavailable');
      setMessage('Remote cwd is not available to the local file explorer.');
      return;
    }

    if (!cwd) {
      model.resetPaths([]);
      setStatus('loading');
      return;
    }

    void loadDirectory(ROOT_DIRECTORY, { replace: true });
  }, [activeCurrentCwd, activeTerminal, cwd, loadDirectory, model, terminalKey]);

  const handleTreeClickCapture = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = findTreeItemElement(event);
      if (target?.dataset.itemType !== 'folder') {
        return;
      }
      const path = target.dataset.itemPath;
      if (path) {
        void ensureDirectoryLoaded(path);
      }
    },
    [ensureDirectoryLoaded],
  );

  const handleTreeKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Enter' && event.key !== 'ArrowRight') {
        return;
      }

      const target = findTreeItemElement(event);
      if (target?.dataset.itemType !== 'folder') {
        return;
      }
      const path = target.dataset.itemPath;
      if (path) {
        void ensureDirectoryLoaded(path);
      }
    },
    [ensureDirectoryLoaded],
  );

  const title = cwdHint?.folder ?? (cwd ? getFolderName(cwd) : 'Explorer');
  const subtitle = cwdHint
    ? cwdHint.host
      ? `${cwdHint.host}:${cwdHint.shortPath}`
      : cwdHint.shortPath
    : cwd || 'No active terminal';
  const showTree = status === 'ready' || status === 'empty';
  const footerText =
    loadingPath && loadingPath !== ROOT_DIRECTORY
      ? `Loading ${loadingPath}`
      : message || (status === 'empty' ? 'Directory is empty' : '');

  return (
    <aside
      className="h-screen shrink-0 border-r select-none"
      style={{
        width: `${EXPLORER_SIDEBAR_WIDTH_PX}px`,
        background: theme.panelBg,
        borderColor: theme.border,
        color: theme.text,
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b px-4 pb-3 pt-4" style={{ borderColor: theme.border }}>
          <div
            className="text-[10px] font-semibold uppercase"
            style={{ color: theme.accent, letterSpacing: '0.14em' }}
          >
            Files
          </div>
          <div className="mt-2 truncate text-[13px] font-semibold" title={cwd || title}>
            {title}
          </div>
          <div className="mt-1 truncate text-[10px]" style={{ color: theme.textDim }} title={cwd}>
            {subtitle}
          </div>
        </div>

        <div className="min-h-0 flex-1 px-2 py-2">
          {showTree ? (
            <FileTree
              model={model}
              onClickCapture={handleTreeClickCapture}
              onKeyDownCapture={handleTreeKeyDownCapture}
              style={{ height: '100%', width: '100%' }}
            />
          ) : (
            <div className="px-2 py-3 text-[11px]" style={{ color: theme.textDim }}>
              {status === 'loading'
                ? 'Loading files'
                : status === 'unavailable'
                  ? 'Local files unavailable'
                  : status === 'error'
                    ? 'Could not load files'
                    : 'No active terminal'}
            </div>
          )}
        </div>

        {footerText ? (
          <div
            className="shrink-0 border-t px-4 py-3 text-[10px]"
            style={{ borderColor: theme.border, color: theme.textDim }}
            title={footerText}
          >
            <div className="truncate">{footerText}</div>
          </div>
        ) : null}
      </div>
    </aside>
  );
};
