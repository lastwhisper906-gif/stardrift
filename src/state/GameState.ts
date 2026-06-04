import type { Vector3Tuple, EulerTuple } from '../types/math.js'

// ── Surface climbing state (planet_surface mode) ──────────────────────────────
export type LandingPhase = 'none' | 'touching_down' | 'disembarking' | 'tethering' | 'on_surface' | 'reboarding'

export interface SurfaceState {
  // ── Landing / disembark sequence ──
  landingPhase:   LandingPhase
  landingProgress: number               // 0–1: progress through current landing phase

  // ── Zero-g axe locomotion (P3) ──
  charVelocity:   Vector3Tuple          // world-space body velocity (Newtonian drift)
  leftAnchorPos:  Vector3Tuple | null   // world-space left-axe anchor (non-null = held)
  rightAnchorPos: Vector3Tuple | null   // world-space right-axe anchor (non-null = held)
  activeAxe:      'left' | 'right'      // retained for view animation bookkeeping
  swingCooldown:  number                // retained (unused in zero-g model)
  pullProgress:   number                // retained (unused in zero-g model)
  pullFromPos:    Vector3Tuple | null   // retained (unused in zero-g model)
  pullToPos:      Vector3Tuple | null   // retained (unused in zero-g model)
  miningStrikes:  number                // consecutive strikes on current node
  miningNodePos:  Vector3Tuple | null   // world-space of node being struck
}

export interface ShipState {
  position: Vector3Tuple
  rotation: EulerTuple
  velocity: Vector3Tuple
  angularVelocity: Vector3Tuple
  throttle: number
  oxygen: number
  hull: number
  minerals: number
}

export type GamePhase = 'PILOTING' | 'IN_EVENT'

export interface GameState {
  ship:    ShipState
  phase:   GamePhase
  tick:    number
  surface: SurfaceState
}

export function createInitialSurfaceState(): SurfaceState {
  return {
    landingPhase:    'none',
    landingProgress: 0,
    charVelocity:    [0, 0, 0],
    leftAnchorPos:   null,
    rightAnchorPos:  null,
    activeAxe:       'left',
    swingCooldown:   0,
    pullProgress:    0,
    pullFromPos:     null,
    pullToPos:       null,
    miningStrikes:   0,
    miningNodePos:   null,
  }
}

export function createInitialGameState(): GameState {
  return {
    ship: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      throttle: 0,
      oxygen: 100,
      hull: 100,
      minerals: 0,
    },
    phase:   'PILOTING',
    tick:    0,
    surface: createInitialSurfaceState(),
  }
}
