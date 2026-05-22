import React, { useState, useEffect } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import type { Workspace } from "../store/useCanvasStore";
import { TerminalPanel } from "./TerminalPanel";
import { getWidthVW } from "../utils/layout";
import { CAMERA_PADDING, GAPS_VW, SCREEN_WIDTH_VW } from "../lib/constants";

interface Props {
  workspace: Workspace;
  isActiveWorkspace: boolean;
}

export const WorkspaceRow: React.FC<Props> = ({
  workspace,
  isActiveWorkspace,
}) => {
  const [viewOffset, setViewOffset] = useState(0);
  const { theme, isOverview, isTerminalFullscreen } = useCanvasStore();
  const totalRowWidth = workspace.terminals.reduce(
    (total, terminal) => total + getWidthVW(terminal.widthFraction) + GAPS_VW,
    0,
  );
  const fitsOnScreen = totalRowWidth <= SCREEN_WIDTH_VW;

  /**
   * Cinematic Layout Logic (Infinite Strip / Sliding Window)
   * Calculates the perspective camera's offset based on terminal density and focus.
   */
  useEffect(() => {
    if (workspace.terminals.length === 0) {
      setViewOffset(0);
      return;
    }

    const { activeTerminalIndex, terminals } = workspace;

    // Relative positioning calculations
    let activeLeft = 0;
    for (let i = 0; i < activeTerminalIndex; i++) {
      activeLeft += getWidthVW(terminals[i].widthFraction) + GAPS_VW;
    }
    const activeWidth = getWidthVW(
      terminals[activeTerminalIndex].widthFraction,
    );
    const activeRight = activeLeft + activeWidth + GAPS_VW;

    setViewOffset((currentOffset) => {
      let targetOffset = currentOffset;
      const maxOffset = Math.max(0, totalRowWidth - SCREEN_WIDTH_VW);

      // Single-Terminal Centering (Focal Focus mode)
      if (terminals.length === 1 || totalRowWidth <= SCREEN_WIDTH_VW) {
        targetOffset = 0;
      }
      // Multi-Terminal Panning (Magnetic Strip mode)
      else {
        const isLastTerminal = activeTerminalIndex === terminals.length - 1;

        // Right-edge magnetism for context reveal
        // Clamp to activeLeft so a wide terminal is never scrolled off its own left edge
        if (isLastTerminal) {
          targetOffset = Math.min(
            activeRight - SCREEN_WIDTH_VW + CAMERA_PADDING,
            activeLeft,
          );
        }
        // Lazy tracking for internal strip movement
        else if (activeLeft < currentOffset + CAMERA_PADDING) {
          targetOffset = activeLeft - CAMERA_PADDING;
        } else if (activeRight > currentOffset + SCREEN_WIDTH_VW - CAMERA_PADDING) {
          targetOffset = activeRight - SCREEN_WIDTH_VW + CAMERA_PADDING;
        }

        // Prevent viewport overflow of empty leading or trailing space.
        targetOffset = Math.min(maxOffset, Math.max(0, targetOffset));
      }

      // Threshold-based state update to minimize jitter
      return Math.abs(targetOffset - currentOffset) > 0.01 ? targetOffset : currentOffset;
    });
  }, [workspace.activeTerminalIndex, workspace.terminals, totalRowWidth]);

  const activeTerminal = workspace.terminals[workspace.activeTerminalIndex];
  const visibleTerminals =
    isActiveWorkspace && isTerminalFullscreen && activeTerminal
      ? [activeTerminal]
      : workspace.terminals;
  const shouldCenterTerminals =
    fitsOnScreen || (isActiveWorkspace && isTerminalFullscreen);

  return (
    <div
      className={`w-screen h-screen flex-shrink-0 flex items-center transition-opacity duration-150 ${
        isActiveWorkspace || isOverview ? "opacity-100" : "opacity-40"
      }`}
    >
      {workspace.terminals.length === 0 ? (
        <div className="w-full text-center select-none">
          {isActiveWorkspace ? (
            <div>
              <p
                className="text-xs tracking-[0.4em] uppercase mb-3 animate-pulse"
                style={{
                  color: theme.accent,
                  opacity: 0.5,
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                empty workspace
              </p>
              <p
                style={{
                  color: theme.textDim,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "11px",
                  letterSpacing: "0.2em",
                }}
              >
                press <span style={{ color: theme.accent }}>alt + enter</span>{" "}
                to spawn terminal
              </p>
            </div>
          ) : (
            <p
              className="text-xs tracking-[0.4em] uppercase"
              style={{
                color: theme.textDim,
                opacity: 0.2,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              empty workspace
            </p>
          )}
        </div>
      ) : (
        <div
          className="flex transition-transform duration-[180ms] ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{
            transform: shouldCenterTerminals
              ? "translateX(0)"
              : `translateX(${-viewOffset}vw)`,
            width: shouldCenterTerminals ? "100%" : undefined,
            justifyContent: shouldCenterTerminals ? "center" : undefined,
          }}
        >
          {visibleTerminals.map((term) => {
            const terminalIsActive =
              isActiveWorkspace && term.id === activeTerminal?.id;

            return (
              <TerminalPanel
                key={term.id}
                terminal={term}
                isActive={terminalIsActive}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
