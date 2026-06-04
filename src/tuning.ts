/**
 * tuning.ts — single source of truth for all gameplay-affecting constants.
 *
 * Grouped by system so "steering feels too fast" → edit HELM,
 * "asteroids spawn too close" → edit ASTEROID, etc.
 *
 * Pure render/frame constants (eye positions, TARGET_MS, mesh geometry) stay
 * in their respective files and are NOT duplicated here.
 */

// ── Main ship helm ──────────────────────────────────────────────────────────
export const HELM = {
  yawSpeed:        1.5,   // rad/s
  pitchSpeed:      1.0,   // rad/s
  rollSpeed:       0.8,   // rad/s
  pitchLevelDecay: 0.25,  // fraction remaining/s when idle (settles in ~3 s)
  rollLevelDecay:  0.15,
}

// ── Main ship physics ───────────────────────────────────────────────────────
export const PHYSICS = {
  forwardAccel:      12,    // m/s² per throttle unit
  dragPerSec:        0.08,  // velocity fraction remaining after 1 s
  angularDragPerSec: 0.15,
  o2IdleDrain:       0.04,  // %/s always
  o2FlightDrain:     0.18,  // %/s extra when throttle > 0
}

// ── Main ship throttle ──────────────────────────────────────────────────────
export const THROTTLE = {
  rate:  12.0,  // units/s increase (W key)
  decay: 10.0,  // units/s drop when no input
  max:   5,
  min:  -2,
}

// ── Main ship vertical thrust ───────────────────────────────────────────────
export const VERTICAL = {
  accel: 50,  // units/s²
}

// ── Sub-ship piloting physics ───────────────────────────────────────────────
export const SUBSHIP = {
  dragPerSec:    0.08,
  forwardAccel:  8,
  verticalAccel: 40,
  throttleRate:  12,
  yawSpeed:      1.2,   // rad/s
  pitchSpeed:    0.8,   // rad/s
  rollSpeed:     0.6,   // rad/s
}

// ── Planet surface climbing ─────────────────────────────────────────────────
export const CLIMBING = {
  swingReach:    3.8,   // (legacy) retained for re-exported test constants
  pullDuration:  0.38,  // (legacy)
  swingCooldown: 0.55,  // (legacy)
  slideSpeed:    0.6,   // (legacy)
  miningStrikes: 3,     // consecutive strikes to collect 1 ore
  mineNodeDist:  7.5,   // m axe-anchor reach to mine node
  // Strike animation phases (seconds)
  strikeWindUp:  0.10,  // axe pulls back quickly
  strikeImpact:  0.08,  // axe drives sharply forward/down into surface
  strikeHold:    0.12,  // brief hold at impact (weight feeling)
  strikeReturn:  0.20,  // slow pull back to rest

  // ── Zero-g axe locomotion (P3) ──
  zeroGDamping:    0.8,   // velocity fraction retained per second when coasting (Newtonian drift)
  springK:         7,     // m/s² per metre of axe stretch (hold-to-reel stiffness)
  springDamping:   2.2,   // s⁻¹ velocity damping while reeling (prevents oscillation)
  axeMaxReach:     50,    // m — max grapple distance; aiming beyond this finds no anchor
  maxSpeed:        22,    // m/s — clamp to prevent runaway drift
  surfaceFriction: 1.0,   // tangential velocity retained on surface graze (1.0 = no ground friction, per P3)
}

// ── Asteroid event ──────────────────────────────────────────────────────────
export const ASTEROID = {
  spawnDist:   120,
  speed:        18,   // m/s
  hitDist:       6.5, // m
  hitDamage:    12,
  hitCooldown:   2.5, // s — prevents multi-hit per pass
  escapeDist:  150,   // m — asteroid flew past, event ends
  maxDuration:  38,   // s — safety timeout
}

// ── Alien event ─────────────────────────────────────────────────────────────
export const ALIEN = {
  spawnDist:     200,
  approachSpeed:  14,  // m/s
  shootRange:     90,  // m — alien starts shooting
  shootDamage:    10,
  shootInterval:   5,  // s between shots
  ramDist:        14,  // m — ram damage threshold
  ramDamage:      25,
  maxDuration:    55,  // s before alien retreats
}

// ── Black hole event ────────────────────────────────────────────────────────
export const BLACKHOLE = {
  spawnDist:    250,
  escapeDist:   380,
  destroyDist:   12,
  gravityCoeff: 350,   // m³/s²
  maxDuration:   60,   // s
}

// ── Subship scout probe event ───────────────────────────────────────────────
export const PROBE = {
  deployDuration: 35,  // s before probe returns
  patrolRadius:   60,  // m
  patrolSpeed:    28,  // m/s
}

// ── EVA event ───────────────────────────────────────────────────────────────
export const EVA = {
  duration:  25,   // s to complete EVA repair
  o2Drain:   0.8,  // %/s extra O2 drain during EVA
  hullRepair: 45,  // hull points restored on completion
}

// ── Sub-ship hangar launch animation ────────────────────────────────────────
export const LAUNCH = {
  descentTarget: -8.0,  // m — subship Y below hangar floor before world detach
  animSpeed:      4.5,  // m/s — descent / ascent animation speed
}

// ── Planet landing / surface sequence ───────────────────────────────────────
export const LANDING = {
  touchdownDur: 2.5,  // s — subship descends to surface (~2–3 s per spec)
  disembarkDur: 1.4,  // s — camera lerps from cockpit to surface eye
  reboardDur:   1.4,  // s — camera lerps back to cockpit on re-board
  reboardDist:  8,    // m — must be within this distance of subship to re-board
}
