import { describe, it, expect } from 'vitest'
import { Vector3 } from 'three'
import { updateClimbing, SWING_REACH, SWING_COOLDOWN, MINING_STRIKES } from './ClimbingSystem.js'
import { createInitialSurfaceState } from '../state/GameState.js'
import { PLANET_RADIUS } from '../render/PlanetMesh.js'
import type { ResourceNode } from '../render/PlanetMesh.js'

const CENTER = new Vector3(0, 0, 0)
const NO_NODES: ResourceNode[] = []
const CAM_YAW   = 0   // looking in -Z direction
const CAM_PITCH = 0   // level

function onSurface(): Vector3 {
  return new Vector3(0, PLANET_RADIUS + 0.05 /* SURFACE_FOOT */, 0)
}

function swing(axe: 'left' | 'right') {
  return axe === 'left'
    ? { leftAxe: true,  rightAxe: false, rotateLeft: false, rotateRight: false, advance: false, mouseLeft: false, mouseRight: false }
    : { leftAxe: false, rightAxe: true,  rotateLeft: false, rotateRight: false, advance: false, mouseLeft: false, mouseRight: false }
}
const NO_INPUT = { leftAxe: false, rightAxe: false, rotateLeft: false, rotateRight: false, advance: false, mouseLeft: false, mouseRight: false }

describe('updateClimbing', () => {
  it('swinging left axe advances character and starts pull', () => {
    const pos = onSurface()
    const s0  = { ...createInitialSurfaceState(), leftAnchorPos: [0, PLANET_RADIUS, 0] as [number,number,number] }
    const { surface, charWorldPos } = updateClimbing(s0, pos, CENTER, CAM_YAW, CAM_PITCH, swing('left'), 0.016, NO_NODES)
    expect(surface.leftAnchorPos).not.toBeNull()
    expect(surface.pullProgress).toBeGreaterThan(0)
    expect(surface.swingCooldown).toBeCloseTo(SWING_COOLDOWN, 2)
    expect(surface.activeAxe).toBe('right')   // alternates
    void charWorldPos
  })

  it('cannot swing again while on cooldown', () => {
    const pos = onSurface()
    const s0  = { ...createInitialSurfaceState(), swingCooldown: 0.5, activeAxe: 'right' as const }
    const { surface } = updateClimbing(s0, pos, CENTER, CAM_YAW, CAM_PITCH, swing('right'), 0.016, NO_NODES)
    expect(surface.rightAnchorPos).toBeNull()   // no new anchor — blocked by cooldown
  })

  it('cannot swing while pull animation in progress', () => {
    const pos = onSurface()
    const from: [number,number,number] = [0, PLANET_RADIUS, 0]
    const to:   [number,number,number] = [0, PLANET_RADIUS, -SWING_REACH]
    const s0 = { ...createInitialSurfaceState(), pullProgress: 0.5, pullFromPos: from, pullToPos: to, activeAxe: 'right' as const }
    const { surface } = updateClimbing(s0, pos, CENTER, CAM_YAW, CAM_PITCH, swing('right'), 0.016, NO_NODES)
    expect(surface.rightAnchorPos).toBeNull()
  })

  it('pull animation advances charWorldPos toward anchor', () => {
    const pos  = new Vector3(0, PLANET_RADIUS + 0.05 /* SURFACE_FOOT */, 0)
    const from: [number,number,number] = [0, PLANET_RADIUS + 0.05 /* SURFACE_FOOT */, 0]
    const to:   [number,number,number] = [0, PLANET_RADIUS + 0.05 /* SURFACE_FOOT */, -SWING_REACH]
    const s0 = {
      ...createInitialSurfaceState(),
      pullProgress: 0.01,
      pullFromPos:  from,
      pullToPos:    to,
      leftAnchorPos: from,
    }
    const { charWorldPos } = updateClimbing(s0, pos, CENTER, CAM_YAW, CAM_PITCH, NO_INPUT, 0.10, NO_NODES)
    // After a 0.1s tick the character should have moved toward to-pos
    expect(charWorldPos.z).toBeLessThan(0)
  })

  it('pull completes and resets', () => {
    const pos  = new Vector3(0, PLANET_RADIUS + 0.05 /* SURFACE_FOOT */, -SWING_REACH * 0.99)
    const from: [number,number,number] = [0, PLANET_RADIUS + 0.05 /* SURFACE_FOOT */, 0]
    const to:   [number,number,number] = [0, PLANET_RADIUS + 0.05 /* SURFACE_FOOT */, -SWING_REACH]
    const s0 = { ...createInitialSurfaceState(), pullProgress: 0.96, pullFromPos: from, pullToPos: to, leftAnchorPos: from }
    const { surface } = updateClimbing(s0, pos, CENTER, CAM_YAW, CAM_PITCH, NO_INPUT, 0.10, NO_NODES)
    expect(surface.pullProgress).toBe(0)
    expect(surface.pullFromPos).toBeNull()
    expect(surface.pullToPos).toBeNull()
  })

  it('mining: 3 strikes on same node collects ore', () => {
    const nodePos = new Vector3(0, PLANET_RADIUS + 0.05 /* SURFACE_FOOT */, -(SWING_REACH * 0.5))
    const node: ResourceNode = { worldPos: nodePos, collected: false, mesh: null as unknown as import('three').Mesh }

    const pos = onSurface()
    let s = createInitialSurfaceState()

    // Strike once
    const r1 = updateClimbing(s, pos.clone(), CENTER, CAM_YAW, CAM_PITCH, swing('left'), 0.016, [node])
    s = r1.surface
    expect(r1.minedNode).toBeNull()
    expect(s.miningStrikes).toBe(1)

    // Strike twice (clear pull state between strikes so canSwing allows it)
    s.swingCooldown = 0; s.activeAxe = 'right'
    s.pullProgress = 0; s.pullFromPos = null; s.pullToPos = null
    const r2 = updateClimbing(s, pos.clone(), CENTER, CAM_YAW, CAM_PITCH, swing('right'), 0.016, [node])
    s = r2.surface
    expect(s.miningStrikes).toBe(2)
    expect(r2.minedNode).toBeNull()

    // Strike three times → should collect
    s.swingCooldown = 0; s.activeAxe = 'left'
    s.pullProgress = 0; s.pullFromPos = null; s.pullToPos = null
    const r3 = updateClimbing(s, pos.clone(), CENTER, CAM_YAW, CAM_PITCH, swing('left'), 0.016, [node])
    expect(r3.minedNode).toBe(node)
    expect(r3.surface.miningStrikes).toBe(0)
  })

  it('cooldown decays over time', () => {
    const pos = onSurface()
    const s0  = { ...createInitialSurfaceState(), swingCooldown: 0.55 }
    const { surface } = updateClimbing(s0, pos, CENTER, CAM_YAW, CAM_PITCH, NO_INPUT, 0.1, NO_NODES)
    expect(surface.swingCooldown).toBeCloseTo(0.45, 2)
  })

  it('slides when no anchor planted', () => {
    const pos = onSurface()
    const s0  = createInitialSurfaceState()   // no anchors
    const posBefore = pos.clone()
    updateClimbing(s0, pos, CENTER, CAM_YAW, CAM_PITCH, NO_INPUT, 0.5, NO_NODES)
    // Character should have moved (slid) from start
    const moved = pos.distanceTo(posBefore)
    expect(moved).toBeGreaterThan(0)
  })

  it('MINING_STRIKES constant is 3', () => {
    expect(MINING_STRIKES).toBe(3)
  })
})
