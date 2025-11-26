export type Coordinate = {
  x: number;
  y: number;
};

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  NONE = 'NONE'
}

export enum TileType {
  WALL = '#',
  DOT = '.',
  POWER_PELLET = 'o',
  EMPTY = ' ',
  PACMAN_SPAWN = 'S',
  GHOST_SPAWN = 'G'
}

export enum GhostMode {
  SCATTER = 'SCATTER',
  CHASE = 'CHASE',
  FRIGHTENED = 'FRIGHTENED',
  EATEN = 'EATEN'
}

export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  GENERATING_LEVEL = 'GENERATING_LEVEL',
  QUIZ = 'QUIZ',
  LEVEL_TRANSITION = 'LEVEL_TRANSITION'
}

export enum MathDifficulty {
  LINEAR = 'LINEAR', // Ecuaciones primer grado
  QUADRATIC = 'QUADRATIC' // Ecuaciones segundo grado
}

export interface Ghost {
  id: number;
  pos: Coordinate;
  color: string;
  startPos: Coordinate;
  mode: GhostMode;
  direction: Direction;
}

export interface LevelData {
  map: string[][];
  pacmanStart: Coordinate;
  ghostStart: Coordinate;
  totalDots: number;
}

export interface MathQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}