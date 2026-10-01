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
export const FULLSCREEN_KEY = 'KeyF';
export const PAUSE_KEY = 'KeyP';

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

// Momentum and ramming. Holding one direction at full speed builds momentum:
// the top speed climbs, and hitting the opponent fast enough is a ram.
export const RAM = {
  cruise: 0.8, // momentum builds only while going at least this share of SAUCER.maxSpeed along the input
  delay: 0.2, // seconds of straight flight before it starts to build
  build: 1, // seconds more to reach full momentum (ram speed after ~330 px from a standstill)
  boost: 1.5, // top speed at full momentum, times SAUCER.maxSpeed
  speed: 400, // px/s toward the opponent at contact for a ram
  daze: 1.5, // seconds the rammed saucer spins out
  knockback: 500, // px/s extra push on the rammed saucer
  jolt: 30, // degrees: a hit that turns the saucer's course more than this costs its momentum
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
  // Hit this many times in a row, each within `dazeWindow` s of the last, a
  // saucer is dazed for `dazeTime` s. Shots at once (triple shot) count once.
  dazeHits: 3,
  dazeWindow: 2,
  dazeTime: 1.5,
  dazeGrace: 1, // s after a daze wears off before hits count again (no stun-locking)
};

export const HOOK = {
  reach: 200, // from saucer underside to animal top
  grabRadius: 26, // horizontal distance to start a pickup
  stillSpeed: 90, // saucer must be slower than this to lower the hook
  // A pickup in progress holds while the saucer stays within this far sideways
  // of the animal, and no more than `stretch` px beyond `reach` above it (the
  // animal rises with the beam). Flying up or down is fine.
  driftLimit: 40,
  stretch: 60,
  // While the beam is lifting, the saucer is heavier: less thrust, more drag.
  // Small nudges no longer break a pickup; flying away on purpose still does.
  beamAccel: 0.5, // fraction of normal acceleration
  beamDrag: 4, // extra drag, 1/s
  liftTime: { lamb: 1.0, cow: 1.6, greenman: 0.8, crate: 0.8, package: 0.8, wolf: 1.3, timebomb: 0.8 },
};

export const ANIMALS = {
  cows: 4,
  lambs: 5,
  wanderSpeed: { cow: 28, lamb: 40, greenman: 55, crate: 0, package: 0, wolf: 35, timebomb: 0 },
  wanderTime: [1, 3.5], // seconds between direction changes
  idleChance: 0.35,
  gravity: 1400,
  // Drops (the green man, ammo crates) are hooked like animals.
  size: {
    cow: { w: 56, h: 38 },
    lamb: { w: 40, h: 28 },
    greenman: { w: 22, h: 30 },
    crate: { w: 30, h: 26 },
    package: { w: 30, h: 28 },
    wolf: { w: 52, h: 34 },
    timebomb: { w: 28, h: 30 },
  },
  value: { cow: 2, lamb: 1 },
  fieldMargin: 30, // keep field animals this far from the pen fences
};

export const POWERUP = {
  chance: 0.6, // chance that a green man drops at each drop time
  dropTimes: [0.3, 0.6], // when he may drop, as fractions of the round
  longRoundFrom: 120, // rounds this long (s) or more get a third drop, to keep power-ups as frequent
  longDropTimes: [0.25, 0.5, 0.75],
  mysteryChance: 0.2, // share of drops that come as a mystery package: power-up unknown until grabbed
  duration: 15, // seconds a power-up lasts (tuned with npm run sim)
  types: ['speed', 'laser', 'triple', 'steal', 'rocket', 'twin', 'bomb', 'unlimited', 'shield', 'cowRain', 'lambRain', 'timeBomb'],
  singleUse: ['rocket', 'bomb', 'timeBomb'], // kept until used (or the round ends) instead of timed
  instant: ['cowRain', 'lambRain'], // happen the moment they are grabbed; any power-up held is kept
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
  // rocket: one homing rocket, fired with the shoot key
  rocketSpeed: 480,
  rocketTurn: 2.6, // rad/s: slow enough to dodge
  rocketLife: 4.5, // seconds before it burns out
  rocketRadius: 8,
  rocketKnockback: 1300,
  rocketStun: 2, // seconds the hit saucer spins out: no steering, lifting or shooting
  // bomb: dropped with the shoot key; blows animals out of the pen it lands in
  bombLaunch: [650, 950], // upward speed range of the animals thrown out
  // twin: the beam can carry a second animal
  // steal: stolen animals delivered while active are worth this times full value
  stealMultiplier: 2,
  // unlimited: shots cost no ammo and the clip never needs reloading
  // shield: hits and bumps don't move the saucer, break a lift or knock anything loose
  // timeBomb: the shoot key drops it and lights the fuse. On the ground it can be
  // lifted, carried and dropped again by either player. It goes off like the
  // pen bomb; in a beam, it dazes that saucer instead.
  timeBombFuse: 8, // seconds: time to fetch it out of your pen, tight to send it all the way back
  timeBombDaze: 2, // seconds
  // cowRain / lambRain: every lamb (cow) standing in the field bursts and a
  // cow (lamb) parachutes down in its place. Golden animals are left alone.
};

// A drop to break a stalemate: the field is empty and someone is out of shots.
export const SUPPLY = {
  after: 3, // seconds the stalemate must last
  crateChance: 0.5, // otherwise a green man (or mystery package)
};

// If a player runs out of ammo early, an ammo crate parachutes in.
// Either player can grab it; it goes into the ship like the green man.
export const AMMO_CRATE = {
  before: 0.5, // only when someone runs out before this share of the round
  refill: 9, // shots it gives (up to COMBAT.ammoPerRound)
};

// Animals that fall further than this burst in a cloud of blood and are lost
// (dropped by hand, knocked loose by a shot, or dropped mid-lift). Animals
// thrown out of a pen by a bomb land safely. Over your own pen, a carried
// animal is released automatically only when it would fall no further than this.
export const SPLAT = {
  height: 260, // px, from the animal's feet to the ground
};

// New animals parachute into the field when every cow and lamb has splatted,
// or when the field has stood empty for a while (so nobody can just sit on a lead).
export const RESTOCK = {
  aliveAtMost: 0, // restock when this many (or fewer) animals are left alive
  count: 3,
  emptyFieldAfter: 10, // seconds the field may stand empty
  emptyFieldCount: 2,
  maxAlive: 24, // no field restock while this many animals are alive (a safety cap; bots never reach 20)
};

// A saucer hovering over its own pen too long spooks the animals in it:
// they jump the fence into the field, one at a time. Stops pen camping.
export const SPOOK = {
  after: 3, // seconds over your own pen before they panic
  every: 2, // seconds between animals jumping out
  warn: 1.5, // seconds over the pen before they look nervous
};

// A rare comeback drop: a golden cow or lamb that evens the score if the
// trailing player delivers it.
// The wolf: some rounds it parachutes in and eats every lamb it can reach.
export const WOLF = {
  chance: 0.35, // chance of a wolf each round
  window: [0.25, 0.7], // it drops at a random time in this part of the round
  speed: 130, // chasing, px/s
  leaveSpeed: 260, // running off, px/s
  bite: 30, // px between centres to catch a lamb
  eatTime: 1, // seconds spent on each lamb
  boredAfter: 6, // seconds without a lamb in reach before it leaves
  scareRange: 220, // lambs in the field closer than this run away
  fleeSpeed: 85, // px/s
  chuteHeight: 140, // dropped from higher than this (px above the ground), it opens a parachute
};

export const GOLDEN = {
  checkAt: 2 / 3, // when to check, as a fraction of the round
  minLead: 3, // only when someone leads by at least this many points
  chance: 0.5, // chance it drops when the lead is that big
};

// Computer player skill per difficulty (see logic/bot.js for what each means).
export const BOT = {
  easy: { gain: 1.8, react: 0.3, aim: 7, hunter: 0.05, huntWithGun: 0.3, picky: true, sloppy: 0.3, jitter: 30, raid: false, carryLow: false },
  normal: { gain: 3, react: 0.16, aim: 12, hunter: 0.3, huntWithGun: 0.6, picky: false, sloppy: 0.1, jitter: 12, raid: true, carryLow: true },
  hard: { gain: 5, react: 0.07, aim: 18, hunter: 0.6, huntWithGun: 0.9, picky: false, sloppy: 0, jitter: 4, raid: true, carryLow: true },
};

export const ROUND = {
  length: 90,
  countdown: 3,
  resultTime: 4,
  startRounds: 3, // default best of (the title menu offers 1, 3, 5 and 7)
  extraRounds: 1, // sudden death: one more round at a time while wins are level
};
