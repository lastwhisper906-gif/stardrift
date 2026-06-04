import { Vector3 } from 'three'
import type { SurfaceState } from '../state/GameState.js'
import type { ClimberInput } from '../input/InputTypes.js'
import type { ResourceNode } from '../render/PlanetMesh.js'
import { PLANET_RADIUS, SURFACE_FOOT } from '../render/PlanetMesh.js'
import { CLIMBING } from '../tuning.js'

// Re-exported for backward-compat with anything importing these by name.
export const SWING_REACH    = CLIMBING.swingReach
export const PULL_DURATION  = CLIMBING.pullDuration
export const SWING_COOLDOWN = CLIMBING.swingCooldown
export const SLIDE_SPEED    = CLIMBING.slideSpeed
export const MINING_STRIKES = CLIMBING.miningStrikes
export const MINE_NODE_DIST = CLIMBING.mineNodeDist

// Pre-allocated scratch — no per-frame heap allocation
const _up       = new Vector3()
const _fwd      = new Vector3()
const _fwdT     = new Vector3()
const _aim      = new Vector3()
const _vel      = new Vector3()
const _toAnchor = new Vector3()
const _oc       = new Vector3()
const _hit      = new Vector3()
const _node     = new Vector3()

/** Project a direction onto the sphere tangent plane at the body's surface normal. */
function tangentProject(out: Vector3, dir: Vector3, up: Vector3): Vector3 {
  return out.copy(dir).addScaledVector(up, -up.dot(dir)).normalize()
}

/**
 * Ray-sphere intersection against the planet surface.
 * Returns true and writes the nearest forward hit point into `out`, or false
 * when the aim ray misses the planet or the hit is beyond CLIMBING.axeMaxReach.
 */
function raycastSurface(origin: Vector3, dir: Vector3, center: Vector3, out: Vector3): boolean {
  _oc.copy(origin).sub(center)
  const b = 2 * _oc.dot(dir)
  const c = _oc.dot(_oc) - PLANET_RADIUS * PLANET_RADIUS
  const disc = b * b - 4 * c
  if (disc < 0) return false
  const sq = Math.sqrt(disc)
  let t = (-b - sq) / 2
  if (t < 0) t = (-b + sq) / 2          // origin inside / first root behind us
  if (t < 0 || t > CLIMBING.axeMaxReach) return false
  out.copy(origin).addScaledVector(dir, t)
  return true
}

export interface ClimbingResult {
  surface:      SurfaceState
  charWorldPos: Vector3
  minedNode:    ResourceNode | null   // non-null when a node was struck to full
  minerals:     number                // updated mineral count (or -1 = no change)
  swung:        'left' | 'right' | 'none'   // a new anchor was thrown this frame (for view + shake)
}

/** Accumulate a mining strike when a fresh anchor lands near an ore node. */
function tryMine(
  s: SurfaceState,
  anchor: [number, number, number],
  nodes: ResourceNode[],
): { minedNode: ResourceNode | null; minerals: number } {
  let nearestDist = CLIMBING.mineNodeDist
  let nearestNode: ResourceNode | null = null
  for (const node of nodes) {
    if (node.collected) continue
    _node.set(anchor[0], anchor[1], anchor[2])
    const d = _node.distanceTo(node.worldPos)
    if (d < nearestDist) { nearestDist = d; nearestNode = node }
  }

  if (!nearestNode) {
    s.miningStrikes = 0
    s.miningNodePos = null
    return { minedNode: null, minerals: -1 }
  }

  const sameNode =
    s.miningNodePos !== null &&
    Math.abs(s.miningNodePos[0] - nearestNode.worldPos.x) < 0.1
  if (sameNode) {
    s.miningStrikes++
  } else {
    s.miningStrikes = 1
    s.miningNodePos = [nearestNode.worldPos.x, nearestNode.worldPos.y, nearestNode.worldPos.z]
  }

  if (s.miningStrikes >= CLIMBING.miningStrikes) {
    s.miningStrikes = 0
    s.miningNodePos = null
    return { minedNode: nearestNode, minerals: 1 }
  }
  return { minedNode: null, minerals: -1 }
}

/**
 * Fully zero-gravity, axe-anchor locomotion (P3).
 *
 * The body floats freely: position integrates from a persisted velocity with
 * light damping (Newtonian drift). Holding an axe button casts the aim ray at
 * the planet surface and — on a hit — sets that side's anchor; a damped spring
 * then reels the body toward the anchor. Releasing the button drops the anchor,
 * leaving the body coasting with whatever velocity it had built up.
 *
 * No surface-walking, no snapping to the sphere: the body only stops tunnelling
 * via a soft collision that removes the inward velocity component.
 */
export function updateClimbing(
  surface:      SurfaceState,
  charWorldPos:  Vector3,             // mutated in place
  planetCenter:  Vector3,
  camYaw:        number,              // facing direction (radians)
  camPitch:      number,              // vertical look angle (radians, + = up)
  input:         ClimberInput,
  dt:            number,
  nodes:         ResourceNode[],
): ClimbingResult {
  const s = { ...surface }
  let swung: 'left' | 'right' | 'none' = 'none'
  let minedNode: ResourceNode | null = null
  let minerals = -1

  // ── Aim direction (3D world space) from yaw + pitch in the surface-tangent basis ──
  _up.copy(charWorldPos).sub(planetCenter).normalize()
  _fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw))
  tangentProject(_fwdT, _fwd, _up)
  _aim.copy(_fwdT).multiplyScalar(Math.cos(camPitch))
    .addScaledVector(_up, Math.sin(camPitch)).normalize()

  const leftHeld  = input.leftAxe  || input.mouseLeft
  const rightHeld = input.rightAxe || input.mouseRight

  // ── Anchor acquisition (press = cast) / release (let go = drop) ──
  if (leftHeld && s.leftAnchorPos === null) {
    if (raycastSurface(charWorldPos, _aim, planetCenter, _hit)) {
      s.leftAnchorPos = [_hit.x, _hit.y, _hit.z]
      s.activeAxe = 'left'
      swung = 'left'
      const m = tryMine(s, s.leftAnchorPos, nodes)
      minedNode = m.minedNode; minerals = m.minerals
    }
  } else if (!leftHeld && s.leftAnchorPos !== null) {
    s.leftAnchorPos = null
  }

  if (rightHeld && s.rightAnchorPos === null) {
    if (raycastSurface(charWorldPos, _aim, planetCenter, _hit)) {
      s.rightAnchorPos = [_hit.x, _hit.y, _hit.z]
      s.activeAxe = 'right'
      if (swung === 'none') swung = 'right'
      const m = tryMine(s, s.rightAnchorPos, nodes)
      if (!minedNode) { minedNode = m.minedNode; minerals = m.minerals }
    }
  } else if (!rightHeld && s.rightAnchorPos !== null) {
    s.rightAnchorPos = null
  }

  // ── Velocity: spring reel toward held anchors, then damping ──
  _vel.set(s.charVelocity[0], s.charVelocity[1], s.charVelocity[2])

  const anyAnchor = s.leftAnchorPos !== null || s.rightAnchorPos !== null
  if (s.leftAnchorPos) {
    _toAnchor.set(s.leftAnchorPos[0], s.leftAnchorPos[1], s.leftAnchorPos[2]).sub(charWorldPos)
    _vel.addScaledVector(_toAnchor, CLIMBING.springK * dt)
  }
  if (s.rightAnchorPos) {
    _toAnchor.set(s.rightAnchorPos[0], s.rightAnchorPos[1], s.rightAnchorPos[2]).sub(charWorldPos)
    _vel.addScaledVector(_toAnchor, CLIMBING.springK * dt)
  }

  if (anyAnchor) {
    _vel.multiplyScalar(Math.max(0, 1 - CLIMBING.springDamping * dt))   // strong damping while reeling
  } else {
    _vel.multiplyScalar(Math.pow(CLIMBING.zeroGDamping, dt))            // light coasting damping
  }

  const speed = _vel.length()
  if (speed > CLIMBING.maxSpeed) _vel.multiplyScalar(CLIMBING.maxSpeed / speed)

  // ── Integrate position (Newtonian drift) ──
  charWorldPos.addScaledVector(_vel, dt)

  // ── Soft planet collision — prevent tunnelling without sticking ──
  _up.copy(charWorldPos).sub(planetCenter)
  const dist = _up.length()
  const minDist = PLANET_RADIUS + SURFACE_FOOT
  if (dist > 1e-6 && dist < minDist) {
    _up.multiplyScalar(1 / dist)                                   // normalize
    charWorldPos.copy(planetCenter).addScaledVector(_up, minDist)  // push to surface
    const inward = _vel.dot(_up)
    if (inward < 0) _vel.addScaledVector(_up, -inward)             // strip inward component
    _vel.multiplyScalar(CLIMBING.surfaceFriction)                  // tangential friction
  }

  s.charVelocity = [_vel.x, _vel.y, _vel.z]
  return { surface: s, charWorldPos, minedNode, minerals, swung }
}
