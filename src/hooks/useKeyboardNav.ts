import { useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';

export const useKeyboardNav = () => {
  const {
    moveTerminal,
    moveWorkspace,
    jumpToTerminal,
    addTerminal,
    addWorkspace,
    removeTerminal,
    resizeTerminal,
    cycleWidth,
    toggleOverview,
    cycleThemes,
    toggleSearch,
  } = useCanvasStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept Meta (Cmd/Win) or Alt keys
      if (e.metaKey || e.altKey) {
        let handled = false;
        const key = e.key.toLowerCase();

        // 1-9 for direct terminal jumping
        if (/^[1-9]$/.test(key)) {
          jumpToTerminal(parseInt(key) - 1);
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
    jumpToTerminal,
    addTerminal,
    addWorkspace,
    removeTerminal,
    resizeTerminal,
    cycleWidth,
    toggleOverview,
    cycleThemes,
    toggleSearch
  ]);
};
