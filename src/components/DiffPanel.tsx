import { parsePatchFiles } from "@pierre/diffs";
import { CodeView, type CodeViewItem } from "@pierre/diffs/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import type { DiffPanel as DiffPanelItem } from "../types/canvas-types";
import { GAPS_VW } from "../lib/constants";
import { getWidthVWString } from "../utils/layout";

interface Props {
  panel: DiffPanelItem;
  isActive: boolean;
}

type DiffPanelState =
  | { status: "loading" }
  | { status: "ready"; items: CodeViewItem[] }
  | { status: "empty" }
  | { status: "error"; message: string };

type DiffViewMode = "split" | "stacked";

const diffCache = new Map<string, { patch: string; items: CodeViewItem[] }>();

export const DiffPanel: React.FC<Props> = ({ panel, isActive }) => {
  const theme = useCanvasStore((s) => s.theme);
  const isTerminalFullscreen = useCanvasStore((s) => s.isTerminalFullscreen);
  const focusWorkspaceItem = useCanvasStore((s) => s.focusWorkspaceItem);
  const diffFontSize = useCanvasStore(
    (s) => s.diffFontSizes?.[panel.id] ?? s.diffFontSize,
  );

  const cached = diffCache.get(panel.cwd);
  const [panelState, setPanelState] = useState<DiffPanelState>(
    cached ? { status: "ready", items: cached.items } : { status: "loading" },
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>("split");

  const lastRefreshRef = useRef(0);
  const wasActiveRef = useRef(isActive);

  const refresh = useCallback((force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshRef.current < 500) return;
    lastRefreshRef.current = now;
    setRefreshKey((k) => k + 1);
  }, []);

  // Refresh when panel becomes active
  useEffect(() => {
    if (!wasActiveRef.current && isActive) refresh(true);
    wasActiveRef.current = isActive;
  }, [isActive, refresh]);

  useEffect(() => {
    let cancelled = false;
    if (!diffCache.has(panel.cwd)) setPanelState({ status: "loading" });

    void window.diffApi
      .getGitWorkingTreeDiff({ cwd: panel.cwd })
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          diffCache.delete(panel.cwd);
          setPanelState({ status: "error", message: response.message });
          return;
        }
        if (!response.patch.trim()) {
          diffCache.delete(panel.cwd);
          setPanelState({ status: "empty" });
          return;
        }
        try {
          const items = parsePatchFiles(response.patch).flatMap((patch, pi) =>
            patch.files.map((fileDiff, fi) => ({
              id: `${pi}:${fi}:${fileDiff.name}`,
              type: "diff" as const,
              fileDiff,
            })),
          );
          const nextState =
            items.length > 0
              ? { status: "ready" as const, items }
              : { status: "empty" as const };
          diffCache.set(panel.cwd, { patch: response.patch, items });
          setPanelState(nextState);
        } catch (error) {
          setPanelState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPanelState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [panel.cwd, refreshKey]);

  const width =
    isTerminalFullscreen && isActive
      ? "96vw"
      : getWidthVWString(panel.widthFraction);

  const diffLineHeight = Math.round(diffFontSize * 1.67);

  return (
    <section
      onMouseDown={() => {
        if (!isActive) focusWorkspaceItem(panel.id);
      }}
      className="diff-panel-section"
      style={{
        width,
        height: isTerminalFullscreen && isActive ? "99vh" : "96vh",
        margin: isTerminalFullscreen && isActive ? "0" : `0 ${GAPS_VW / 2}vw`,
        background: theme.panelBg,
        opacity: isActive ? 1 : 0.9,
      }}
    >
      <div className="diff-panel-scroll flex-1 min-h-0 overflow-auto px-3 py-3">
        <DiffViewModeControl
          mode={diffViewMode}
          onModeChange={setDiffViewMode}
          accent={theme.accent}
          border={theme.border}
          panelBg={theme.panelBg}
          textDim={theme.textDim}
        />
        {panelState.status === "loading" ? (
          <DiffPanelMessage label="loading diff" color={theme.textDim} />
        ) : panelState.status === "error" ? (
          <DiffPanelMessage label={panelState.message} color={theme.accent} />
        ) : panelState.status === "empty" ? (
          <DiffPanelMessage
            label="no changes against HEAD"
            color={theme.textDim}
          />
        ) : (
          <div className="relative min-h-full">
            <div
              style={{
                width: "100%",
              }}
            >
              <CodeView
                items={panelState.items}
                style={
                  {
                    "--diffs-font-family": "JetBrains Mono, monospace",
                    "--diffs-font-size": `${diffFontSize}px`,
                    "--diffs-line-height": `${diffLineHeight}px`,
                  } as React.CSSProperties
                }
                options={{
                  theme: "pierre-dark",
                  diffStyle: diffViewMode === "split" ? "split" : "unified",
                  disableBackground: true,
                  lineDiffType: "word",
                  itemMetrics: { lineHeight: diffLineHeight },
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
}) => (
  <div
    className="absolute right-2 top-2 z-20 flex overflow-hidden border"
    style={{
      background: panelBg,
      borderColor: border,
      fontFamily: "JetBrains Mono, monospace",
    }}
    onMouseDown={(e) => e.stopPropagation()}
  >
    {(["split", "stacked"] as const).map((viewMode) => {
      const selected = mode === viewMode;
      return (
        <button
          key={viewMode}
          type="button"
          onClick={() => onModeChange(viewMode)}
          className="px-2 py-1 uppercase"
          style={{
            background: selected ? accent : "transparent",
            border: 0,
            color: selected ? "#050302" : textDim,
            fontSize: "10px",
            letterSpacing: "0.08em",
          }}
        >
          {viewMode}
        </button>
      );
    })}
  </div>
);

const DiffPanelMessage: React.FC<{ label: string; color: string }> = ({
  label,
  color,
}) => (
  <div
    className="h-full flex items-center justify-center text-center px-6"
    style={{
      color,
      fontFamily: "JetBrains Mono, monospace",
      fontSize: "11px",
      letterSpacing: "0.08em",
    }}
  >
    {label}
  </div>
);
