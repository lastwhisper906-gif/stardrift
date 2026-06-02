import { Vector3 } from 'three'
import type { SurfaceState } from '../state/GameState.js'
import type { ClimberInput } from '../input/InputTypes.js'
import type { ResourceNode } from '../render/PlanetMesh.js'
import { PLANET_RADIUS, SURFACE_FOOT } from '../render/PlanetMesh.js'

export const SWING_REACH    = 2.8     // metres advanced per axe plant
export const PULL_DURATION  = 0.38    // seconds to glide to new anchor
export const SWING_COOLDOWN = 0.55    // arm fatigue between swings
export const SLIDE_SPEED    = 0.6     // m/s slide-down when no anchor
export const MINING_STRIKES = 3       // strikes to collect 1 ore
export const MINE_NODE_DIST = 6.0     // metres — axe reach to mine node

// Pre-allocated scratch
const _up      = new Vector3()
const _fwd     = new Vector3()
const _fwdT    = new Vector3()
const _right   = new Vector3()
const _pos     = new Vector3()
const _anchor  = new Vector3()
const _pullFrom = new Vector3()
const _pullTo  = new Vector3()

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function surfaceNormal(worldPos: Vector3, planetCenter: Vector3): Vector3 {
  return _up.copy(worldPos).sub(planetCenter).normalize()
}

/** Project a direction onto the sphere tangent plane at worldPos. */
function tangentProject(dir: Vector3, up: Vector3): Vector3 {
  return _fwdT.copy(dir).addScaledVector(up, -up.dot(dir)).normalize()
}

/** Snap worldPos back onto planet surface at PLANET_RADIUS. */
function snapToSurface(worldPos: Vector3, center: Vector3): void {
  _up.copy(worldPos).sub(center).normalize()
  worldPos.copy(center).addScaledVector(_up, PLANET_RADIUS + SURFACE_FOOT)
}

export interface ClimbingResult {
  surface:      SurfaceState
  charWorldPos: Vector3
  minedNode:    ResourceNode | null   // non-null when a node was struck to full
  minerals:     number                // updated mineral count (or -1 = no change)
}

export function updateClimbing(
  surface:      SurfaceState,
  charWorldPos:  Vector3,             // mutated in place
  planetCenter:  Vector3,
  camYaw:        number,              // facing direction (radians)
  input:         ClimberInput,
  dt:            number,
  nodes:         ResourceNode[],
): ClimbingResult {
  let s = { ...surface }

  // ── Cooldown decay ────────────────────────────────────────────────────────
  if (s.swingCooldown > 0) s.swingCooldown = Math.max(0, s.swingCooldown - dt)

  // ── Pull animation: glide charWorldPos toward anchor ─────────────────────
  if (s.pullProgress > 0 && s.pullFromPos && s.pullToPos) {
    s.pullProgress = Math.min(1, s.pullProgress + dt / PULL_DURATION)
    const t = easeInOut(s.pullProgress)
    _pullFrom.set(...s.pullFromPos)
    _pullTo.set(...s.pullToPos)
    charWorldPos.lerpVectors(_pullFrom, _pullTo, t)
    snapToSurface(charWorldPos, planetCenter)
    if (s.pullProgress >= 1) {
      s.pullProgress = 0
      s.pullFromPos  = null
      s.pullToPos    = null
    }
  }

  // ── Sliding when no anchor planted ───────────────────────────────────────
  const hasAnchor = s.leftAnchorPos !== null || s.rightAnchorPos !== null
  if (!hasAnchor && s.pullProgress === 0) {
    // Slide "down" — along the sphere surface away from current position
    // "Down" = camera backward direction on the sphere (retreating slope)
    const up  = surfaceNormal(charWorldPos, planetCenter)
    _fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw))
    const fwdT = tangentProject(_fwd, up)
    charWorldPos.addScaledVector(fwdT, -SLIDE_SPEED * dt)  // slide back
    snapToSurface(charWorldPos, planetCenter)
  }

  // ── Axe swing (only when not already pulling and cooldown ready) ──────────
  const canSwing = s.swingCooldown <= 0 && s.pullProgress === 0
  const swingLeft  = input.leftAxe  && s.activeAxe === 'left'  && canSwing
  const swingRight = input.rightAxe && s.activeAxe === 'right' && canSwing

  let minedNode: ResourceNode | null = null
  let minerals  = -1

  if (swingLeft || swingRight) {
    // Compute anchor: SWING_REACH metres ahead on sphere surface
    const up   = surfaceNormal(charWorldPos, planetCenter)
    _fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw))
    const fwdT = tangentProject(_fwd, up)

    _pos.copy(charWorldPos)
    _anchor.copy(_pos).addScaledVector(fwdT, SWING_REACH)
    snapToSurface(_anchor, planetCenter)

    const anchorTuple: [number, number, number] = [_anchor.x, _anchor.y, _anchor.z]
    const fromTuple:   [number, number, number] = [_pos.x,    _pos.y,    _pos.z]

    if (swingLeft) {
      s.leftAnchorPos = anchorTuple
      s.activeAxe     = 'right'
    } else {
      s.rightAnchorPos = anchorTuple
      s.activeAxe      = 'left'
    }

    // Start pull animation
    s.pullFromPos  = fromTuple
    s.pullToPos    = anchorTuple
    s.pullProgress = 0.01   // tiny epsilon starts the animation next frame
    s.swingCooldown = SWING_COOLDOWN

    // ── Mining check: is the anchor near an ore node? ─────────────────────
    let nearestDist = MINE_NODE_DIST
    let nearestNode: ResourceNode | null = null
    for (const node of nodes) {
      if (node.collected) continue
      _pos.set(...anchorTuple)
      const d = _pos.distanceTo(node.worldPos)
      if (d < nearestDist) { nearestDist = d; nearestNode = node }
    }

    if (nearestNode) {
      const sameNode =
        s.miningNodePos !== null &&
        Math.abs(s.miningNodePos[0] - nearestNode.worldPos.x) < 0.1

      if (sameNode) {
        s.miningStrikes++
      } else {
        s.miningStrikes  = 1
        s.miningNodePos  = [nearestNode.worldPos.x, nearestNode.worldPos.y, nearestNode.worldPos.z]
      }

      if (s.miningStrikes >= MINING_STRIKES) {
        minedNode       = nearestNode
        minerals        = 1   // +1 ore
        s.miningStrikes = 0
        s.miningNodePos = null
      }
    } else {
      s.miningStrikes = 0
      s.miningNodePos = null
    }
  }

  return { surface: s, charWorldPos, minedNode, minerals }
}
