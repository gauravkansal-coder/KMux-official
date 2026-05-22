import React from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import type { Terminal } from "../types/canvas-types";
import { getWidthVWString } from "../utils/layout";
import { GAPS_VW } from "../lib/constants";
import { TerminalViewport } from "../terminal/renderer/components/TerminalViewport";

interface Props {
  terminal: Terminal;
  isActive: boolean;
}

export const TerminalPanel: React.FC<Props> = ({ terminal, isActive }) => {
  const { theme, isTerminalFullscreen, jumpToGlobalTerminal } =
    useCanvasStore();

  const w =
    isTerminalFullscreen && isActive
      ? "96vw"
      : getWidthVWString(terminal.widthFraction);
  const displayOpacity = isActive ? 1 : 0.9;

  return (
    <div
      onMouseDown={() => {
        if (!isActive) {
          jumpToGlobalTerminal(terminal.id);
        }
      }}
      style={{
        width: w,
        height: isTerminalFullscreen && isActive ? "99vh" : "96vh",
        flexShrink: 0,
        margin: isTerminalFullscreen && isActive ? "0" : `0 ${GAPS_VW / 2}vw`,
        background: theme.panelBg,
        transition:
          "width 150ms cubic-bezier(0.22, 1, 0.36, 1), height 150ms cubic-bezier(0.22, 1, 0.36, 1), margin 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1)",
        opacity: displayOpacity,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
        }}
      >
        <TerminalViewport terminalId={terminal.id} isActive={isActive} />
      </div>
    </div>
  );
};
