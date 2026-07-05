import * as THREE from "three";

export const TILE_SIZE = 4;
export const BOARD_SIZE = 10;
export const TOTAL_TILES = BOARD_SIZE * BOARD_SIZE;

export const JUMPS: Record<number, number> = {
  // Ladders
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,
  // Snakes
  17: 7,
  54: 34,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  99: 78,
};

export const PLAYER_COLORS = [0xef4444, 0x3b82f6, 0x22c55e, 0xeab308];
export const PLAYER_COLORS_CSS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

export const SNAKE_COLORS: [number, number][] = [
  [0x4a7c59, 0xb8d4c8],
  [0x7a4e2d, 0xd4a882],
  [0x5c4a7f, 0xc2b0e8],
  [0x8b5e3c, 0xe0c9b4],
  [0x3a6b6e, 0xa8cdd0],
  [0x6b4e71, 0xd4b8d9],
  [0x4e6741, 0xb5c9a8],
  [0x7a3b3b, 0xd9a8a8],
];

/*
 * BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
 * Standard die (opposite faces sum to 7):
 *   +Y=1, -Y=6,  +Z=2, -Z=5,  +X=3, -X=4
 */
export const DICE_FACE_VALUES = [3, 4, 1, 6, 2, 5]; // per face-index
export const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),   // +X → 3
  new THREE.Vector3(-1, 0, 0),  // -X → 4
  new THREE.Vector3(0, 1, 0),   // +Y → 1
  new THREE.Vector3(0, -1, 0),  // -Y → 6
  new THREE.Vector3(0, 0, 1),   // +Z → 2
  new THREE.Vector3(0, 0, -1),  // -Z → 5
];
