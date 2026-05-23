import { useEffect } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import { useTerminalPicker } from "../terminal/renderer/context/use-terminal-picker";
import { useTerminalRuntime } from "../terminal/renderer/context/useTerminalRuntime";
import { findKeybind, type KeyAction } from "../lib/keybinds";

export const useKeyboardNav = () => {
  const {
    moveTerminal,
    moveWorkspace,
    jumpToWorkspace,
    addTerminal,
    addDiffPanel,
    addWorkspace,
    removeTerminal,
    resizeTerminal,
    adjustActiveTerminalFontSize,
    adjustGlobalTerminalFontSize,
    adjustActiveDiffFontSize,
    cycleWidth,
    toggleOverview,
    toggleTerminalFullscreen,
    cycleThemes,
    toggleSearch,
    toggleControls,
    toggleExplorer,
    isControlsOpen,
    workspaces,
    activeWorkspaceIndex,
  } = useCanvasStore();
  const { sessions } = useTerminalRuntime();
  const { isOpen: isPickerOpen, openPicker } = useTerminalPicker();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPickerOpen) return;

      const matched = findKeybind(e);
      if (!matched) return;

      if (isControlsOpen && matched.action !== "toggleControls") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      let handled = true;
      const action: KeyAction = matched.action;
      const workspace = workspaces[activeWorkspaceIndex];
      const activeItem = workspace?.items[workspace.activeItemIndex];

      switch (action) {
        case "moveTerminalLeft":
          moveTerminal("left");
          break;
        case "moveTerminalRight":
          moveTerminal("right");
          break;
        case "moveWorkspaceUp":
          moveWorkspace("up");
          break;
        case "moveWorkspaceDown":
          moveWorkspace("down");
          break;
        case "jumpToWorkspace":
          jumpToWorkspace(parseInt(e.key, 10) - 1);
          break;
        case "addTerminal":
          addTerminal();
          break;
        case "openTerminalPicker":
          openPicker("terminal");
          break;
        case "removeTerminal":
          removeTerminal();
          break;
        case "addWorkspace":
          addWorkspace();
          break;
        case "openWorkspacePicker":
          openPicker("workspace");
          break;
        case "openDiffPanel":
          if (activeItem?.type === "diff") {
            addDiffPanel(activeItem.cwd, activeItem.sourceTerminalId);
          } else if (activeItem?.type === "terminal") {
            const session = sessions[activeItem.id];
            const cwd =
              session?.currentCwd?.isLocal === true
                ? session.currentCwd.path
                : session?.cwd;
            if (cwd) {
              addDiffPanel(cwd, activeItem.id);
            } else {
              handled = false;
            }
          } else {
            handled = false;
          }
          break;
        case "toggleFullscreen":
          toggleTerminalFullscreen();
          break;
        case "toggleExplorer":
          toggleExplorer();
          break;
        case "cycleWidth":
          cycleWidth();
          break;
        case "resizeShrink":
          resizeTerminal("shrink");
          break;
        case "resizeExpand":
          resizeTerminal("expand");
          break;
        case "fontSizeIncrease":
          if (activeItem?.type === "diff") {
            adjustActiveDiffFontSize("increase");
          } else {
            adjustActiveTerminalFontSize("increase");
          }
          break;
        case "fontSizeDecrease":
          if (activeItem?.type === "diff") {
            adjustActiveDiffFontSize("decrease");
          } else {
            adjustActiveTerminalFontSize("decrease");
          }
          break;
        case "globalFontSizeIncrease":
          adjustGlobalTerminalFontSize("increase");
          break;
        case "globalFontSizeDecrease":
          adjustGlobalTerminalFontSize("decrease");
          break;
        case "toggleOverview":
          toggleOverview();
          break;
        case "toggleSearch":
          toggleSearch();
          break;
        case "cycleThemes":
          cycleThemes();
          break;
        case "toggleControls":
          toggleControls();
          break;
        default:
          handled = false;
      }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    moveTerminal,
    moveWorkspace,
    jumpToWorkspace,
    addTerminal,
    addDiffPanel,
    addWorkspace,
    removeTerminal,
    resizeTerminal,
    adjustActiveTerminalFontSize,
    adjustGlobalTerminalFontSize,
    adjustActiveDiffFontSize,
    cycleWidth,
    toggleOverview,
    toggleTerminalFullscreen,
    cycleThemes,
    toggleSearch,
    toggleControls,
    toggleExplorer,
    isControlsOpen,
    workspaces,
    activeWorkspaceIndex,
    sessions,
    isPickerOpen,
    openPicker,
  ]);
};
