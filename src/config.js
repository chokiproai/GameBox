export const HALF_PI = Math.PI / 2;
export const SPACING = 1.01;
export const BODY_SIZE = 0.962;
export const BODY_RADIUS = 0.068;
export const TILE_SIZE = 0.842;
export const FLOOR_Y = -1.79;
export const PLINTH_TOP = -1.491;

export const FACE_COLORS = {
  U: 0xece3d2,
  D: 0xd9ad3d,
  F: 0x0e7a53,
  B: 0x234e9e,
  R: 0xa32c39,
  L: 0xcc6624,
};

export const FACE_KEYS = ["U", "D", "L", "R", "F", "B"];

export const MOVE_DEFS = {
  U: { axis: "y", layer: 1, normal: [0, 1, 0], label: "Trên" },
  D: { axis: "y", layer: -1, normal: [0, -1, 0], label: "Dưới" },
  R: { axis: "x", layer: 1, normal: [1, 0, 0], label: "Phải" },
  L: { axis: "x", layer: -1, normal: [-1, 0, 0], label: "Trái" },
  F: { axis: "z", layer: 1, normal: [0, 0, 1], label: "Trước" },
  B: { axis: "z", layer: -1, normal: [0, 0, -1], label: "Sau" },
};

export const FACE_BY_AXIS = {
  "1,0,0": "R",
  "-1,0,0": "L",
  "0,1,0": "U",
  "0,-1,0": "D",
  "0,0,1": "F",
  "0,0,-1": "B",
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function pad(value, length = 2) {
  return String(value).padStart(length, "0");
}

export function formatTime(milliseconds) {
  const safe = Math.max(0, milliseconds);
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const millis = Math.floor(safe % 1000);
  return `${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

export function notation(face, prime) {
  return `${face}${prime ? "'" : ""}`;
}
