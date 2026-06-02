import { Vector3 } from 'three'
import type { SubshipState } from './SubshipSystem.js'
import { PLANET_RADIUS } from '../render/PlanetMesh.js'

export const PLANET_STOP_RADIUS = PLANET_RADIUS + 5   // 5 m clearance above surface
const DRAG_ZONE_DEPTH = 80                             // drag starts 80 m above stop radius
const DRAG_ZONE_MAX   = 0.25                           // max extra drag factor at surface

// Pre-allocated scratch — no per-frame heap allocation
const _pos    = new Vector3()
const _normal = new Vector3()
const _safe   = new Vector3()
const _vel    = new Vector3()

/**
 * Ramp extra velocity drag from 0 (far) to DRAG_ZONE_MAX (at stop radius).
 * Returns the same state object reference if no drag applies.
 */
export function applyPlanetDrag(state: SubshipState, center: Vector3): SubshipState {
  _pos.set(...state.position)
  const dist = _pos.distanceTo(center)
  const outer = PLANET_STOP_RADIUS + DRAG_ZONE_DEPTH

  if (dist >= outer || dist < PLANET_STOP_RADIUS) return state

  const t     = 1 - (dist - PLANET_STOP_RADIUS) / DRAG_ZONE_DEPTH   // 0 far → 1 at stop
  const extra = t * DRAG_ZONE_MAX
  const scale = 1 - extra
  const [vx, vy, vz] = state.velocity
  return { ...state, velocity: [vx * scale, vy * scale, vz * scale] }
}

/**
 * Push subship outside stop radius and strip any inward velocity component.
 * Robust: runs unconditionally every frame — no tunnelling regardless of speed.
 */
export function resolvePlanetCollision(state: SubshipState, center: Vector3): SubshipState {
  _pos.set(...state.position)
  const dist = _pos.distanceTo(center)
  if (dist >= PLANET_STOP_RADIUS) return state

  // Surface correction
  _normal.copy(_pos).sub(center)
  if (_normal.lengthSq() < 1e-6) {
    // Dead-centre edge case: push along +Y
    _normal.set(0, 1, 0)
  } else {
    _normal.normalize()
  }
  _safe.copy(center).addScaledVector(_normal, PLANET_STOP_RADIUS)

  // Velocity correction — strip inward component, absorb ~50 % energy
  _vel.set(...state.velocity)
  const inward = _vel.dot(_normal)
  if (inward < 0) _vel.addScaledVector(_normal, -inward)
  _vel.multiplyScalar(0.5)

  return {
    ...state,
    position: [_safe.x, _safe.y, _safe.z],
    velocity: [_vel.x, _vel.y, _vel.z],
  }
}
