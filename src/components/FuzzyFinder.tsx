import React, { useState, useEffect, useRef } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';

export const FuzzyFinder: React.FC = () => {
  const { workspaces, theme, isSearchOpen, toggleSearch, jumpToGlobalTerminal } = useCanvasStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Flatten all terminals with their workspace context
  const allTerminals = workspaces.flatMap((ws, wsIdx) =>
    ws.terminals.map(t => ({
      ...t,
      workspaceName: `Workspace ${wsIdx + 1}`,
      wsIdx
    }))
  );

  // Simple fuzzy filter
  const filtered = allTerminals.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.workspaceName.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isSearchOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isSearchOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (filtered[selectedIndex]) {
        jumpToGlobalTerminal(filtered[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      toggleSearch();
    }
  };

  if (!isSearchOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200"
      onClick={toggleSearch}
    >
      {/* Backdrop Blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Main Spotlight Box */}
      <div
        className="relative w-full max-w-[640px] rounded-2xl shadow-2xl overflow-hidden border border-white/10 ring-1 ring-black/50"
        style={{
          background: theme.panelBg,
          backdropFilter: 'blur(40px) saturate(150%)',
          boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px ${theme.border}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Area */}
        <div className="flex items-center px-5 py-4 border-b border-white/5 bg-white/5">
          <svg className="w-5 h-5 opacity-40 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: theme.text }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-xl font-light placeholder:text-white/20"
            placeholder="Search terminals or sessions..."
            style={{ color: theme.text }}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 opacity-30 font-mono" style={{ color: theme.text }}>ESC</div>
        </div>

        {/* Results Area */}
        <div className="max-h-[380px] overflow-y-auto py-2 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center opacity-40 text-sm italic" style={{ color: theme.text }}>
              No terminals found matching "{query}"
            </div>
          ) : (
            filtered.map((t, i) => (
              <div
                key={t.id}
                className={`flex items-center px-4 py-3 mx-2 rounded-xl cursor-pointer transition-all duration-150 group ${i === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                onClick={() => jumpToGlobalTerminal(t.id)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {/* Terminal Icon */}
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 transition-transform ${i === selectedIndex ? 'scale-110' : ''}`}
                  style={{ background: i === selectedIndex ? theme.accent : 'rgba(255,255,255,0.05)' }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: i === selectedIndex ? '#fff' : theme.textDim }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>

                {/* Text Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: i === selectedIndex ? theme.text : theme.textDim }}>
                    {t.title}
                  </div>
                  <div className="text-[10px] opacity-40 truncate flex items-center gap-2 uppercase tracking-widest mt-0.5" style={{ color: theme.text }}>
                    {t.workspaceName}
                  </div>
                </div>

                {/* Jump Hint */}
                {i === selectedIndex && (
                  <div className="text-[10px] font-mono opacity-60 flex items-center gap-1" style={{ color: theme.accent }}>
                    <span>JUMP</span>
                    <span className="bg-black/20 px-1 rounded">↵</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-white/5 bg-black/10 flex justify-between items-center opacity-40 text-[9px] tracking-wider uppercase" style={{ color: theme.text }}>
          <div className="flex gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <div>{filtered.length} Results</div>
        </div>
      </div>
    </div>
  );
};