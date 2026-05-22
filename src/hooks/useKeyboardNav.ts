import { useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useTerminalPicker } from '../terminal/renderer/context/use-terminal-picker';

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
  } = useCanvasStore();
  const { isOpen: isPickerOpen, openPicker } = useTerminalPicker();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPickerOpen) {
        return;
      }

      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        let handled = false;

        if (key === '+' || key === '=') {
          if (e.shiftKey) {
            adjustGlobalTerminalFontSize('increase');
          } else {
            adjustActiveTerminalFontSize('increase');
          }
          handled = true;
        } else if (key === '-' || key === '_') {
          if (e.shiftKey) {
            adjustGlobalTerminalFontSize('decrease');
          } else {
            adjustActiveTerminalFontSize('decrease');
          }
          handled = true;
        }

        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Intercept Meta (Cmd/Win) or Alt keys
      if (e.metaKey || e.altKey) {
        let handled = false;
        const key = e.key.toLowerCase();

        if (e.altKey && e.shiftKey && key === 'enter') {
          openPicker('terminal');
          handled = true;
        } else if (e.altKey && e.shiftKey && key === 'n') {
          openPicker('workspace');
          handled = true;
        } else if (e.altKey && key === 'b') {
          toggleTerminalFullscreen();
          handled = true;
        } else if (e.altKey && /^[1-9]$/.test(key)) {
          jumpToWorkspace(parseInt(key, 10) - 1);
          handled = true;
        } else {
          switch (key) {
            case 'arrowleft':
            case 'h':
              moveTerminal('left');
              handled = true;
              break;
            case 'arrowright':
            case 'l':
              moveTerminal('right');
              handled = true;
              break;
            case 'arrowup':
            case 'k':
              moveWorkspace('up');
              handled = true;
              break;
            case 'arrowdown':
            case 'j':
              moveWorkspace('down');
              handled = true;
              break;
            case 'enter':
              addTerminal();
              handled = true;
              break;
            case 'n':
              addWorkspace();
              handled = true;
              break;
            case 'w':
            case 'q':
            case 'x':
              removeTerminal();
              handled = true;
              break;
            case 'o':
              toggleOverview();
              handled = true;
              break;
            case 't':
              cycleThemes();
              handled = true;
              break;
            case 'f':
              toggleSearch();
              handled = true;
              break;
            case 'r':
              cycleWidth();
              handled = true;
              break;
            case '-':
              resizeTerminal('shrink');
              handled = true;
              break;
            case '=':
            case '+':
              resizeTerminal('expand');
              handled = true;
              break;
          }
        }

        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
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
    isPickerOpen,
    openPicker,
  ]);
};
