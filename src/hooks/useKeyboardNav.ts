import { useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useTerminalPicker } from '../terminal/renderer/context/use-terminal-picker';
import { findKeybind, type KeyAction } from '../lib/keybinds';

export const useKeyboardNav = () => {
  const {
    moveTerminal,
    moveWorkspace,
    jumpToWorkspace,
    addTerminal,
    addWorkspace,
    removeTerminal,
    resizeTerminal,
    adjustActiveTerminalFontSize,
    adjustGlobalTerminalFontSize,
    cycleWidth,
    toggleOverview,
    toggleTerminalFullscreen,
    cycleThemes,
    toggleSearch,
    toggleControls,
    isControlsOpen,
  } = useCanvasStore();
  const { isOpen: isPickerOpen, openPicker } = useTerminalPicker();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPickerOpen) return;

      const matched = findKeybind(e);
      if (!matched) return;

      if (isControlsOpen && matched.action !== 'toggleControls') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      let handled = true;
      const action: KeyAction = matched.action;

      switch (action) {
        // ── Navigation ──
        case 'moveTerminalLeft':
          moveTerminal('left');
          break;
        case 'moveTerminalRight':
          moveTerminal('right');
          break;
        case 'moveWorkspaceUp':
          moveWorkspace('up');
          break;
        case 'moveWorkspaceDown':
          moveWorkspace('down');
          break;
        case 'jumpToWorkspace':
          jumpToWorkspace(parseInt(e.key, 10) - 1);
          break;

        // ── Terminals ──
        case 'addTerminal':
          addTerminal();
          break;
        case 'openTerminalPicker':
          openPicker('terminal');
          break;
        case 'removeTerminal':
          removeTerminal();
          break;

        // ── Workspaces ──
        case 'addWorkspace':
          addWorkspace();
          break;
        case 'openWorkspacePicker':
          openPicker('workspace');
          break;

        // ── Layout ──
        case 'toggleFullscreen':
          toggleTerminalFullscreen();
          break;
        case 'cycleWidth':
          cycleWidth();
          break;
        case 'resizeShrink':
          resizeTerminal('shrink');
          break;
        case 'resizeExpand':
          resizeTerminal('expand');
          break;

        // ── Font size ──
        case 'fontSizeIncrease':
          adjustActiveTerminalFontSize('increase');
          break;
        case 'fontSizeDecrease':
          adjustActiveTerminalFontSize('decrease');
          break;
        case 'globalFontSizeIncrease':
          adjustGlobalTerminalFontSize('increase');
          break;
        case 'globalFontSizeDecrease':
          adjustGlobalTerminalFontSize('decrease');
          break;

        // ── Utilities ──
        case 'toggleOverview':
          toggleOverview();
          break;
        case 'toggleSearch':
          toggleSearch();
          break;
        case 'cycleThemes':
          cycleThemes();
          break;
        case 'toggleControls':
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

    // Use capturing phase to intercept commands reliably
    window.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    moveTerminal,
    moveWorkspace,
    jumpToWorkspace,
    addTerminal,
    addWorkspace,
    removeTerminal,
    resizeTerminal,
    adjustActiveTerminalFontSize,
    adjustGlobalTerminalFontSize,
    cycleWidth,
    toggleOverview,
    toggleTerminalFullscreen,
    cycleThemes,
    toggleSearch,
    toggleControls,
    isControlsOpen,
    isPickerOpen,
    openPicker,
  ]);
};
