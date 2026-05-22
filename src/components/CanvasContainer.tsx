import React, { useState, useEffect } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import { WorkspaceRow } from "./WorkspaceRow";
import { FuzzyFinder } from "./FuzzyFinder";
import {
  OVERVIEW_SCALE,
  SCREEN_HEIGHT_VH,
  TRANSITION_CANVAS,
  TRANSITION_UI,
  UI_HIDE_TIMEOUT,
  Z_LAYERS,
} from "../lib/constants";

export const CanvasContainer: React.FC = () => {
  const { workspaces, activeWorkspaceIndex, isOverview, theme } =
    useCanvasStore();

  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    let id: number;
    if (controlsVisible) {
      id = window.setTimeout(() => setControlsVisible(false), UI_HIDE_TIMEOUT);
    }
    return () => clearTimeout(id);
  }, [controlsVisible]);

  useEffect(() => {
    const poke = () => setControlsVisible(true);
    window.addEventListener("keydown", poke, true);
    window.addEventListener("mousemove", poke, true);
    return () => {
      window.removeEventListener("keydown", poke, true);
      window.removeEventListener("mousemove", poke, true);
    };
  }, []);

  const translateY = -(activeWorkspaceIndex * SCREEN_HEIGHT_VH);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none cursor-default"
      style={{
        background: theme.bg,
        transition: `background ${TRANSITION_UI}`,
      }}
    >
      <div
        className="w-full h-full"
        style={{
          transition: `transform ${TRANSITION_CANVAS}`,
          transform: isOverview ? `scale(${OVERVIEW_SCALE})` : "scale(1)",
          transformOrigin: "center center",
        }}
      >
        <div
          className="w-full h-full transition-transform"
          style={{
            transition: `transform ${TRANSITION_CANVAS}`,
            transform: `translateY(${translateY}vh)`,
          }}
        >
          {workspaces.map((ws) => (
            <WorkspaceRow
              key={ws.id}
              workspace={ws}
              isActiveWorkspace={ws.id === workspaces[activeWorkspaceIndex]?.id}
            />
          ))}
        </div>
      </div>

      <FuzzyFinder />

      <div
        className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2"
        style={{ zIndex: Z_LAYERS.INDICATORS }}
      >
        {workspaces.map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-center rounded-lg transition-all duration-150 text-[9px] font-mono font-bold"
            style={{
              width: activeWorkspaceIndex === index ? "28px" : "20px",
              height: activeWorkspaceIndex === index ? "28px" : "20px",
              background:
                activeWorkspaceIndex === index
                  ? `${theme.accent}15`
                  : "rgba(255,255,255,0.02)",
              border: `1px solid ${activeWorkspaceIndex === index ? `${theme.accent}88` : theme.border}`,
              color:
                activeWorkspaceIndex === index ? theme.accent : theme.textDim,
              opacity: activeWorkspaceIndex === index ? 1 : 0.4,
              boxShadow:
                activeWorkspaceIndex === index
                  ? `0 4px 12px ${theme.accent}22`
                  : "none",
              transform:
                activeWorkspaceIndex === index ? "scale(1.1)" : "scale(1)",
              marginLeft: activeWorkspaceIndex === index ? "-4px" : "0",
            }}
          >
            {index + 1}
          </div>
        ))}
      </div>

      <div
        className="absolute top-5 right-5 transition-opacity"
        style={{
          zIndex: Z_LAYERS.CONTROLS,
          transition: `opacity ${TRANSITION_UI}`,
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        <div
          className="px-6 py-5 rounded-2xl border backdrop-blur-3xl shadow-3xl text-[10px] tracking-[0.18em] uppercase flex flex-col gap-3"
          style={{
            background: theme.panelBg,
            borderColor: theme.border,
            color: theme.textDim,
          }}
        >
          <div
            className="border-b pb-2 mb-1 flex justify-between"
            style={{ borderColor: theme.border }}
          >
            <span style={{ color: theme.accent, fontWeight: 700 }}>
              KMux Controls
            </span>
            <span>Theme: {theme.name}</span>
          </div>
          <div className="opacity-40 italic mb-1 text-[9px]">
            modifiers: alt or super
          </div>
          <p>arrows - focus terminal / workspace</p>
          <p>1-9 - jump to workspace</p>
          <p>enter - new terminal</p>
          <p>n - new workspace</p>
          <p>shift + alt + enter - choose terminal profile</p>
          <p>shift + alt + n - choose workspace profile</p>
          <p>q/w - close terminal</p>
          <p>o - toggle overview</p>
          <p>f - fuzzy finder</p>
          <p>-/= - resize width</p>
        </div>
      </div>

      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 transition-opacity"
        style={{
          zIndex: Z_LAYERS.CONTROLS,
          transition: `opacity ${TRANSITION_UI}`,
          opacity: controlsVisible ? 0.6 : 0,
        }}
      >
        <span
          className="text-[10px] tracking-[0.5em] font-light uppercase"
          style={{ color: theme.text, fontFamily: "JetBrains Mono, monospace" }}
        >
          {`WORKSPACE ${activeWorkspaceIndex + 1}`}
        </span>
      </div>
    </div>
  );
};
