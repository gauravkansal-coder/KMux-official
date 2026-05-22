import { parsePatchFiles } from '@pierre/diffs';
import { CodeView, type CodeViewItem } from '@pierre/diffs/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { DiffPanel as DiffPanelItem } from '../types/canvas-types';
import { GAPS_VW } from '../lib/constants';
import { getWidthVWString } from '../utils/layout';

interface Props {
  panel: DiffPanelItem;
  isActive: boolean;
}

type DiffPanelState =
  | { status: 'loading' }
  | { status: 'ready'; items: CodeViewItem[] }
  | { status: 'empty' }
  | { status: 'error'; message: string };

const diffCache = new Map<string, { patch: string; items: CodeViewItem[] }>();
const RESIZE_PLACEHOLDER_MS = 180;

export const DiffPanel: React.FC<Props> = ({ panel, isActive }) => {
  const theme = useCanvasStore((state) => state.theme);
  const isTerminalFullscreen = useCanvasStore((state) => state.isTerminalFullscreen);
  const focusWorkspaceItem = useCanvasStore((state) => state.focusWorkspaceItem);

  const cached = diffCache.get(panel.cwd);
  const [panelState, setPanelState] = useState<DiffPanelState>(
    cached ? { status: 'ready', items: cached.items } : { status: 'loading' },
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const lastRefresh = useRef(0);
  const previousWidthFraction = useRef(panel.widthFraction);
  const resizeTimer = useRef<number | null>(null);

  const refresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefresh.current < 500) return;
    lastRefresh.current = now;
    diffCache.delete(panel.cwd);
    setRefreshKey((key) => key + 1);
  }, [panel.cwd]);

  useEffect(() => {
    if (previousWidthFraction.current === panel.widthFraction) {
      return;
    }

    previousWidthFraction.current = panel.widthFraction;
    setIsResizing(true);

    if (resizeTimer.current !== null) {
      window.clearTimeout(resizeTimer.current);
    }

    resizeTimer.current = window.setTimeout(() => {
      setIsResizing(false);
      resizeTimer.current = null;
    }, RESIZE_PLACEHOLDER_MS);
  }, [panel.widthFraction]);

  useEffect(() => {
    return () => {
      if (resizeTimer.current !== null) {
        window.clearTimeout(resizeTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!diffCache.has(panel.cwd)) {
      setPanelState({ status: 'loading' });
    }

    void window.diffApi
      .getGitWorkingTreeDiff({ cwd: panel.cwd })
      .then((response) => {
        if (cancelled) return;

        if (!response.ok) {
          setPanelState({ status: 'error', message: response.message });
          return;
        }

        if (response.patch.trim().length === 0) {
          setPanelState({ status: 'empty' });
          return;
        }

        try {
          const items = parsePatchFiles(response.patch).flatMap((patch, patchIndex) =>
            patch.files.map((fileDiff, fileIndex) => ({
              id: `${patchIndex}:${fileIndex}:${fileDiff.name}`,
              type: 'diff' as const,
              fileDiff,
            })),
          );
          const nextState = items.length > 0 ? { status: 'ready' as const, items } : { status: 'empty' as const };
          diffCache.set(panel.cwd, { patch: response.patch, items });
          setPanelState(nextState);
        } catch (error) {
          setPanelState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPanelState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [panel.cwd, refreshKey]);

  const widthFractionChanged = previousWidthFraction.current !== panel.widthFraction;
  const shouldShowResizePlaceholder =
    panelState.status === 'ready' && (isResizing || widthFractionChanged);

  const width =
    isTerminalFullscreen && isActive ? '96vw' : getWidthVWString(panel.widthFraction);

  return (
    <section
      onMouseDown={() => {
        if (!isActive) {
          focusWorkspaceItem(panel.id);
        }
      }}
      style={{
        width,
        height: isTerminalFullscreen && isActive ? '99vh' : '96vh',
        flexShrink: 0,
        margin: isTerminalFullscreen && isActive ? '0' : `0 ${GAPS_VW / 2}vw`,
        background: theme.panelBg,
        transition:
          'width 150ms cubic-bezier(0.22, 1, 0.36, 1), height 150ms cubic-bezier(0.22, 1, 0.36, 1), margin 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
        opacity: isActive ? 1 : 0.9,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <header
        className="flex items-center justify-between gap-3 px-3 py-2 border-b"
        style={{ borderColor: theme.border }}
      >
        <div className="min-w-0">
          <div
            className="truncate uppercase"
            style={{
              color: isActive ? theme.accent : theme.textDim,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              letterSpacing: '0.16em',
              fontWeight: 700,
            }}
          >
            {panel.title}
          </div>
          <div
            className="truncate"
            title={panel.cwd}
            style={{
              color: theme.textDim,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              marginTop: '3px',
            }}
          >
            {panel.cwd}
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            refresh();
          }}
          className="px-2 py-1 border uppercase"
          style={{
            borderColor: theme.border,
            color: theme.textDim,
            background: 'transparent',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            letterSpacing: '0.12em',
          }}
        >
          refresh
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-auto px-3 py-2">
        {panelState.status === 'loading' ? (
          <DiffPanelMessage label="loading diff" color={theme.textDim} />
        ) : panelState.status === 'error' ? (
          <DiffPanelMessage label={panelState.message} color={theme.accent} />
        ) : panelState.status === 'empty' ? (
          <DiffPanelMessage label="no changes against HEAD" color={theme.textDim} />
        ) : (
          <div className="relative min-h-full">
            {shouldShowResizePlaceholder ? (
              <div className="absolute inset-0 z-10">
                <DiffPanelMessage label="resizing diff" color={theme.textDim} />
              </div>
            ) : null}
            <div
              aria-hidden={shouldShowResizePlaceholder}
              style={{
                contentVisibility: shouldShowResizePlaceholder ? 'hidden' : 'visible',
                containIntrinsicSize: shouldShowResizePlaceholder ? '1200px' : undefined,
                pointerEvents: shouldShowResizePlaceholder ? 'none' : undefined,
              }}
            >
              <CodeView
                items={panelState.items}
                options={{
                  theme: 'pierre-dark',
                  diffStyle: 'split',
                  disableBackground: true,
                  lineDiffType: 'word',
                }}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const DiffPanelMessage: React.FC<{ label: string; color: string }> = ({ label, color }) => {
  return (
    <div
      className="h-full flex items-center justify-center text-center px-6"
      style={{
        color,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        letterSpacing: '0.08em',
      }}
    >
      {label}
    </div>
  );
};
