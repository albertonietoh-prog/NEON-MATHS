import { Direction } from './types';

export const CELL_SIZE = 25; // Standard size
export const GAME_SPEED = 180; // ms per tick (lower is faster)
export const GHOST_SPEED_MODIFIER = 1; // Move every N ticks? Currently 1:1
export const FRIGHTENED_DURATION = 50; // ticks

export const DIRECTIONS = [
  Direction.UP,
  Direction.DOWN,
  Direction.LEFT,
  Direction.RIGHT
];

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  [Direction.UP]: Direction.DOWN,
  [Direction.DOWN]: Direction.UP,
  [Direction.LEFT]: Direction.RIGHT,
  [Direction.RIGHT]: Direction.LEFT,
  [Direction.NONE]: Direction.NONE
};

export const DIRECTION_OFFSETS: Record<Direction, { x: number; y: number }> = {
  [Direction.UP]: { x: 0, y: -1 },
  [Direction.DOWN]: { x: 0, y: 1 },
  [Direction.LEFT]: { x: -1, y: 0 },
  [Direction.RIGHT]: { x: 1, y: 0 },
  [Direction.NONE]: { x: 0, y: 0 }
};

// Default static level (28 tiles wide - Standard)
export const DEFAULT_LEVEL_STRING = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "#............GG............#",
  "######.#####.##.#####.######",
  "#............S.............#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......##.......##..o#",
  "###.##.#####.##.#####.##.###",
  "#......##..........##......#",
  "############################"
];