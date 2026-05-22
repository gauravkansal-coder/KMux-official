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

type DiffViewMode = 'split' | 'stacked';

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
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>('split');
  const lastRefresh = useRef(0);
  const wasActive = useRef(isActive);
  const previousWidthFraction = useRef(panel.widthFraction);
  const resizeTimer = useRef<number | null>(null);

  const refresh = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastRefresh.current < 500) return;
    lastRefresh.current = now;
    setRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!wasActive.current && isActive) {
      refresh(true);
    }
    wasActive.current = isActive;
  }, [isActive, refresh]);

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
          diffCache.delete(panel.cwd);
          setPanelState({ status: 'error', message: response.message });
          return;
        }

        if (response.patch.trim().length === 0) {
          diffCache.delete(panel.cwd);
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
      <div className="diff-panel-scroll flex-1 min-h-0 overflow-auto px-3 py-3">
        {panelState.status === 'loading' ? (
          <DiffPanelMessage label="loading diff" color={theme.textDim} />
        ) : panelState.status === 'error' ? (
          <DiffPanelMessage label={panelState.message} color={theme.accent} />
        ) : panelState.status === 'empty' ? (
          <DiffPanelMessage label="no changes against HEAD" color={theme.textDim} />
        ) : (
          <div className="relative min-h-full">
            <DiffViewModeControl
              mode={diffViewMode}
              onModeChange={setDiffViewMode}
              accent={theme.accent}
              border={theme.border}
              panelBg={theme.panelBg}
              textDim={theme.textDim}
            />
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
                  diffStyle: diffViewMode === 'split' ? 'split' : 'unified',
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

interface DiffViewModeControlProps {
  mode: DiffViewMode;
  onModeChange: (mode: DiffViewMode) => void;
  accent: string;
  border: string;
  panelBg: string;
  textDim: string;
}

const DiffViewModeControl: React.FC<DiffViewModeControlProps> = ({
  mode,
  onModeChange,
  accent,
  border,
  panelBg,
  textDim,
}) => {
  return (
    <div
      className="absolute right-2 top-2 z-20 flex overflow-hidden border"
      style={{
        background: panelBg,
        borderColor: border,
        fontFamily: 'JetBrains Mono, monospace',
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {(['split', 'stacked'] as const).map((viewMode) => {
        const isSelected = mode === viewMode;

        return (
          <button
            key={viewMode}
            type="button"
            onClick={() => onModeChange(viewMode)}
            className="px-2 py-1 uppercase"
            style={{
              background: isSelected ? accent : 'transparent',
              border: 0,
              color: isSelected ? '#050302' : textDim,
              fontSize: '10px',
              letterSpacing: '0.08em',
            }}
          >
            {viewMode}
          </button>
        );
      })}
    </div>
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
