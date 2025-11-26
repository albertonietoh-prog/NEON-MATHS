import React from 'react';
import { Ghost, Coordinate, TileType, Direction, GhostMode } from '../types';
import { CELL_SIZE } from '../constants';

interface BoardProps {
  map: string[][];
  pacmanPos: Coordinate;
  pacmanDir: Direction;
  ghosts: Ghost[];
  isMouthOpen: boolean;
}

export const Board: React.FC<BoardProps> = ({ map, pacmanPos, pacmanDir, ghosts, isMouthOpen }) => {
  const height = map.length;
  const width = map[0]?.length || 0;

  // Helper to get rotation for pacman
  const getRotation = (dir: Direction) => {
    switch (dir) {
      case Direction.UP: return '-90deg';
      case Direction.DOWN: return '90deg';
      case Direction.LEFT: return '180deg';
      default: return '0deg';
    }
  };

  return (
    <div 
      className="relative bg-slate-900 shadow-2xl shadow-blue-900/50 rounded-lg overflow-hidden border-4 border-slate-800"
      style={{ 
        width: width * CELL_SIZE, 
        height: height * CELL_SIZE 
      }}
    >
      {/* Static Grid Layer */}
      {map.map((row, y) => (
        <div key={y} className="flex">
          {row.map((tile, x) => (
            <div
              key={`${x}-${y}`}
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
              className="flex items-center justify-center"
            >
              {tile === TileType.WALL && (
                <div className="w-full h-full bg-blue-900/40 border border-blue-500/30 shadow-[inset_0_0_8px_rgba(59,130,246,0.5)] rounded-sm" />
              )}
              {tile === TileType.DOT && (
                <div className="w-1.5 h-1.5 bg-pink-200 rounded-full shadow-[0_0_4px_#fbcfe8]" />
              )}
              {tile === TileType.POWER_PELLET && (
                <div className="w-3 h-3 bg-yellow-100 rounded-full animate-pulse shadow-[0_0_8px_#fef08a]" />
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Dynamic Entity Layer */}
      
      {/* Pacman */}
      <div
        className="absolute transition-all duration-150 ease-linear z-20"
        style={{
          left: pacmanPos.x * CELL_SIZE,
          top: pacmanPos.y * CELL_SIZE,
          width: CELL_SIZE,
          height: CELL_SIZE,
          transform: `rotate(${getRotation(pacmanDir)})`
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
            {/* Simple CSS Pacman */}
            <div 
                className={`w-[80%] h-[80%] bg-yellow-400 rounded-full shadow-[0_0_10px_#facc15]`}
                style={{
                    clipPath: isMouthOpen 
                        ? 'polygon(100% 74%, 44% 48%, 100% 21%, 100% 0, 0 0, 0 100%, 100% 100%)'
                        : 'polygon(100% 100%, 100% 0, 0 0, 0 100%)' // Closed-ish
                }}
            />
        </div>
      </div>

      {/* Ghosts */}
      {ghosts.map((ghost) => (
        <div
          key={ghost.id}
          className="absolute transition-all duration-150 ease-linear z-10"
          style={{
            left: ghost.pos.x * CELL_SIZE,
            top: ghost.pos.y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE
          }}
        >
          <div className="w-full h-full flex items-center justify-center p-0.5">
             <GhostIcon color={ghost.mode === GhostMode.FRIGHTENED ? '#3b82f6' : ghost.color} isScared={ghost.mode === GhostMode.FRIGHTENED} />
          </div>
        </div>
      ))}
    </div>
  );
};

const GhostIcon = ({ color, isScared }: { color: string; isScared: boolean }) => (
  <svg viewBox="0 0 16 16" className="w-full h-full drop-shadow-md">
     <path
       fill={color}
       d="M8 1c-3.314 0-6 2.686-6 6v6c0 .552.448 1 1 1 .2 0 .385-.06.54-.16l1.46-1.096 1.46 1.096c.155.1.34.16.54.16s.385-.06.54-.16l1.46-1.096 1.46 1.096c.155.1.34.16.54.16 .552 0 1-.448 1-1v-6c0-3.314-2.686-6-6-6z"
     />
     {isScared ? (
         <g fill="white">
             <rect x="4" y="5" width="2" height="2" />
             <rect x="9" y="5" width="2" height="2" />
             <rect x="5" y="9" width="6" height="1" />
             <rect x="4" y="9" width="1" height="1" />
             <rect x="11" y="9" width="1" height="1" />
         </g>
     ) : (
        <g fill="white">
            <circle cx="5" cy="5" r="2" />
            <circle cx="11" cy="5" r="2" />
            <circle cx="5.8" cy="5" r="1" fill="black"/>
            <circle cx="11.8" cy="5" r="1" fill="black"/>
        </g>
     )}
  </svg>
);