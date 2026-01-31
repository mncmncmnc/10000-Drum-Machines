
import React, { useState, useCallback, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { DrumType } from './types';

const NEON_COLORS: Record<DrumType, string> = {
  [DrumType.KICK]: '#39FF14',
  [DrumType.SNARE]: '#FF00FF',
  [DrumType.HIHAT]: '#00FFFF',
  [DrumType.CLAP]: '#FEFE33',
  [DrumType.CRASH]: '#FF5F1F',
};

const DrumIcon: React.FC<{ type: DrumType; className?: string }> = ({ type, className }) => {
  switch (type) {
    case DrumType.KICK:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <rect x="6" y="2" width="12" height="20" />
        </svg>
      );
    case DrumType.SNARE:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <polygon points="12,2 22,22 2,22" />
        </svg>
      );
    case DrumType.HIHAT:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case DrumType.CRASH:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <polygon points="12,2 22,12 12,22 2,12" />
        </svg>
      );
    case DrumType.CLAP:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
        </svg>
      );
    default:
      return null;
  }
};

const App: React.FC = () => {
  const [bpm, setBpm] = useState<number>(120);
  const [barrelInterval, setBarrelInterval] = useState<number>(8);
  const [selectedDrum, setSelectedDrum] = useState<DrumType>(DrumType.KICK);
  const [triggerCount, setTriggerCount] = useState<number>(0);
  const [resetRequested, setResetRequested] = useState<boolean>(false);
  const [godMode, setGodMode] = useState<boolean>(true);

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBpm(Number(e.target.value));
  };

  const handleBarrelIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarrelInterval(Number(e.target.value));
  };

  const handleReset = (e?: React.MouseEvent<HTMLButtonElement>) => {
    setResetRequested(true);
    if (e) e.currentTarget.blur();
  };

  const onResetComplete = useCallback(() => {
    setResetRequested(false);
  }, []);

  // Cycle drums with Shift key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setSelectedDrum((prev) => {
          const drums = Object.values(DrumType);
          const currentIndex = drums.indexOf(prev);
          const nextIndex = (currentIndex + 1) % drums.length;
          return drums[nextIndex];
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const barrelsPerMinute = Math.round(bpm / barrelInterval);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2 tracking-widest border-b border-white inline-block px-4">
          Kong Drummer
        </h1>
        <p className="text-gray-400 text-sm mt-2 uppercase tracking-tighter">
          Place objects to form a beat
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 w-full max-w-6xl items-stretch">
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 bg-neutral-900 p-6 border border-white flex flex-col h-full">
          
          <div className="space-y-6">
            
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                Selected Drum
              </label>
              <div className="flex flex-col gap-2">
                {Object.values(DrumType).map((type) => (
                  <button
                    key={type}
                    onClick={(e) => {
                      setSelectedDrum(type);
                      e.currentTarget.blur();
                    }}
                    className={`w-full py-3 pl-6 pr-4 text-[10px] border transition-colors flex items-center justify-start gap-4 ${
                      selectedDrum === type
                        ? 'bg-neutral-800 text-white border-white'
                        : 'bg-black text-white border-gray-600 hover:border-white'
                    }`}
                  >
                    <div style={{ color: selectedDrum === type ? NEON_COLORS[type] : 'currentColor' }}>
                        <DrumIcon type={type} className="w-4 h-4" />
                    </div>
                    <span className="font-bold">{type}</span>
                  </button>
                ))}
              </div>
            </div>

             <div className="pt-2">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={godMode}
                  onChange={(e) => setGodMode(e.target.checked)}
                  className="w-4 h-4 text-white bg-black border-gray-600 rounded focus:ring-offset-0 focus:ring-0 accent-white"
                />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">
                  God Mode
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold mb-4 text-gray-400 uppercase tracking-widest">
                Beats per minute: {bpm}
              </label>
              <input
                type="range"
                min="40"
                max="240"
                value={bpm}
                onChange={handleBpmChange}
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-4 text-gray-400 uppercase tracking-widest">
                Barrels per minute: {barrelsPerMinute}
              </label>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                value={barrelInterval}
                onChange={handleBarrelIntervalChange}
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
              />
              <div className="text-[10px] text-gray-500 mt-1">
                (Spawning every {barrelInterval} beats)
              </div>
            </div>

          </div>

          <div className="flex-grow"></div>

          <div className="pt-6 mt-6 border-t border-gray-800 flex flex-col gap-4">
            <div className="text-[9px] leading-relaxed text-gray-500 italic">
              How to play:<br/>
              - ARROWS to move/jump.<br/>
              - SPACE to place/remove triggers.<br/>
              - SHIFT to cycle drum sounds.<br/>
              - Barrels play sounds on contact.<br/>
            </div>
            
            <button
              onClick={handleReset}
              className="w-full py-3 bg-black hover:bg-neutral-800 border border-white text-white text-xs font-bold transition-all uppercase"
            >
              Clear All Triggers
            </button>
          </div>
        </div>

        {/* Game Area */}
        <div className="lg:col-span-3 flex justify-center h-full">
          <GameCanvas 
            bpm={bpm} 
            barrelInterval={barrelInterval}
            selectedDrum={selectedDrum} 
            onTriggersChange={setTriggerCount}
            resetRequested={resetRequested}
            onResetComplete={onResetComplete}
            godMode={godMode}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 text-gray-600 text-[10px] uppercase tracking-widest">
        Created by <a href="https://www.codychar.com" target="_blank" rel="noopener noreferrer" className="hover:text-white underline decoration-dotted">Cody Char</a>
      </footer>
    </div>
  );
};

export default App;
