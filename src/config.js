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

export const MUTE_KEY = 'KeyM';

export const SAUCER = {
  radius: 34, // collision radius
  halfHeight: 14, // distance from centre to underside
  top: 30, // distance from centre to top of dome
  accel: 1400, // px/s^2
  drag: 3, // 1/s, exponential
  maxSpeed: 320, // px/s, cap for self-propelled speed
  startY: 200,
  startX: { red: 110, blue: 1170 },
};

export const BUMP = {
  strength: 180, // px/s impulse applied to each saucer
  rearm: 25, // px the saucers must separate before another contact counts as a new bump
};

export const COMBAT = {
  projectileSpeed: 900,
  projectileRadius: 6,
  knockback: 900, // px/s horizontal impulse on hit
  knockLoose: true, // a hit also knocks a fully lifted (carried) animal loose
  clipSize: 3,
  reloadTime: 1.5,
  ammoPerRound: 18,
  fireCooldown: 0.15,
};

export const HOOK = {
  reach: 200, // from saucer underside to animal top
  grabRadius: 26, // horizontal distance to start a pickup
  stillSpeed: 90, // saucer must be slower than this to lower the hook
  driftLimit: 30,
  // While the beam is lifting, the saucer is heavier: less thrust, more drag.
  // Small nudges no longer break a pickup; flying away on purpose still does.
  beamAccel: 0.5, // fraction of normal acceleration
  beamDrag: 4, // extra drag, 1/s
  liftTime: { lamb: 1.0, cow: 1.6, greenman: 0.8, crate: 0.8 },
};

export const ANIMALS = {
  cows: 3,
  lambs: 4,
  wanderSpeed: { cow: 28, lamb: 40, greenman: 55, crate: 0 },
  wanderTime: [1, 3.5], // seconds between direction changes
  idleChance: 0.35,
  gravity: 1400,
  // Drops (the green man, ammo crates) are hooked like animals.
  size: {
    cow: { w: 56, h: 38 },
    lamb: { w: 40, h: 28 },
    greenman: { w: 22, h: 30 },
    crate: { w: 30, h: 26 },
  },
  value: { cow: 2, lamb: 1 },
  fieldMargin: 30, // keep field animals this far from the pen fences
};

export const POWERUP = {
  chance: 0.5, // chance per round that a green man drops
  dropAt: 0.5, // when, as a fraction of the round
  duration: 15, // seconds a power-up lasts (tuned with npm run sim)
  types: ['speed', 'laser', 'triple', 'steal'],
  fallSpeed: 110, // parachute descent, px/s
  dropMargin: 0.2, // keep the landing spot this share of the field away from the fences
  // speed: faster saucer
  speedBoost: 1.6, // max speed multiplier
  accelBoost: 1.5,
  // laser: hold shoot for a continuous beam; no ammo
  laserPush: 2600, // px/s^2 horizontal push on the opponent
  laserHalfWidth: 7,
  // triple: three shots per trigger pull, one ammo
  tripleSpread: 26, // px between the shots
  // steal: stolen animals delivered while active are worth this times full value
  stealMultiplier: 2,
};

// If a player runs out of ammo early, an ammo crate parachutes in.
// Either player can grab it; it goes into the ship like the green man.
export const AMMO_CRATE = {
  before: 0.5, // only when someone runs out before this share of the round
  refill: 9, // shots it gives (up to COMBAT.ammoPerRound)
};

// A rare comeback drop: a golden cow or lamb that evens the score if the
// trailing player delivers it.
export const GOLDEN = {
  checkAt: 2 / 3, // when to check, as a fraction of the round
  minLead: 3, // only when someone leads by at least this many points
  chance: 0.5, // chance it drops when the lead is that big
};

// Computer player skill per difficulty (see logic/bot.js for what each means).
export const BOT = {
  easy: { gain: 1.8, react: 0.3, aim: 7, hunter: 0.05, huntWithGun: 0.3, picky: true, sloppy: 0.3, jitter: 30, raid: false },
  normal: { gain: 3, react: 0.16, aim: 12, hunter: 0.3, huntWithGun: 0.6, picky: false, sloppy: 0.1, jitter: 12, raid: true },
  hard: { gain: 5, react: 0.07, aim: 18, hunter: 0.6, huntWithGun: 0.9, picky: false, sloppy: 0, jitter: 4, raid: true },
};

export const ROUND = {
  length: 90,
  countdown: 3,
  resultTime: 4,
  startRounds: 3,
  extraRounds: 2,
};
