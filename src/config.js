// All tuning constants and key bindings.

export const WIDTH = 1280;
export const HEIGHT = 720;
export const STEP = 1 / 60;

export const ARENA = {
  flightTop: 0,
  flightBottom: 480,
  groundY: 660,
  pens: {
    red: { left: 0, right: 180 },
    blue: { left: 1100, right: 1280 },
  },
};

export const KEYS = {
  red: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', shoot: 'Space' },
  blue: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', shoot: 'Enter' },
};

export const SAUCER = {
  radius: 34, // collision radius
  halfHeight: 14, // distance from centre to underside
  accel: 1400, // px/s^2
  drag: 3, // 1/s, exponential
  maxSpeed: 320, // px/s, cap for self-propelled speed
  startY: 200,
  startX: { red: 110, blue: 1170 },
};

export const BUMP = {
  strength: 180, // px/s impulse applied to each saucer
};

export const COMBAT = {
  projectileSpeed: 900,
  projectileRadius: 6,
  knockback: 900, // px/s horizontal impulse on hit
  clipSize: 3,
  reloadTime: 1.5,
  ammoPerRound: 12,
  fireCooldown: 0.15,
};

export const HOOK = {
  reach: 200, // from saucer underside to animal top
  grabRadius: 26, // horizontal distance to start a pickup
  stillSpeed: 90, // saucer must be slower than this to lower the hook
  driftLimit: 30,
  liftTime: { lamb: 1.0, cow: 1.6 },
};

export const ANIMALS = {
  cows: 3,
  lambs: 4,
  wanderSpeed: { cow: 28, lamb: 40 },
  wanderTime: [1, 3.5], // seconds between direction changes
  idleChance: 0.35,
  gravity: 1400,
  size: {
    cow: { w: 56, h: 38 },
    lamb: { w: 40, h: 28 },
  },
  value: { cow: 2, lamb: 1 },
  fieldMargin: 30, // keep field animals this far from the pen fences
};

export const ROUND = {
  length: 60,
  countdown: 3,
  resultTime: 4,
  startRounds: 3,
  extraRounds: 2,
};
