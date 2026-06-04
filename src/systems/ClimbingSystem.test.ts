import { describe, it, expect } from 'vitest'
import { Vector3 } from 'three'
import { updateClimbing, MINING_STRIKES } from './ClimbingSystem.js'
import { createInitialSurfaceState } from '../state/GameState.js'
import { PLANET_RADIUS } from '../render/PlanetMesh.js'
import type { ResourceNode } from '../render/PlanetMesh.js'

const CENTER = new Vector3(0, 0, 0)
const NO_NODES: ResourceNode[] = []
const R = PLANET_RADIUS

// Aim straight down at the surface (toward planet center) from a north-pole float.
const AIM_DOWN_PITCH = -Math.PI / 2
const AIM_UP_PITCH   =  Math.PI / 2
const CAM_YAW = 0

function held(side: 'left' | 'right') {
  return {
    leftAxe:  side === 'left',
    rightAxe: side === 'right',
    advance: false, rotateLeft: false, rotateRight: false,
    mouseLeft: false, mouseRight: false,
  }
}
const NO_INPUT = {
  leftAxe: false, rightAxe: false, advance: false,
  rotateLeft: false, rotateRight: false, mouseLeft: false, mouseRight: false,
}

/** A point floating `h` metres above the north pole. */
function floatingAbovePole(h: number): Vector3 {
  return new Vector3(0, R + h, 0)
}

describe('updateClimbing (zero-g axe locomotion)', () => {
  it('floats with momentum and decays velocity when no axe is held', () => {
    const s0 = { ...createInitialSurfaceState(), charVelocity: [1, 0, 0] as [number, number, number] }
    const pos = floatingAbovePole(5)
    const r = updateClimbing(s0, pos, CENTER, CAM_YAW, 0, NO_INPUT, 0.1, NO_NODES)
    expect(pos.x).toBeGreaterThan(0)                     // drifted along +x
    expect(r.surface.charVelocity[0]).toBeLessThan(1)    // damped
    expect(r.surface.charVelocity[0]).toBeGreaterThan(0) // but still moving
  })

  it('holding an axe aimed at the surface throws an anchor', () => {
    const pos = floatingAbovePole(5)
    const r = updateClimbing(
      createInitialSurfaceState(), pos, CENTER, CAM_YAW, AIM_DOWN_PITCH, held('left'), 0.016, NO_NODES,
    )
    expect(r.surface.leftAnchorPos).not.toBeNull()
    expect(r.swung).toBe('left')
  })

  it('aiming away from the planet finds no anchor', () => {
    const pos = floatingAbovePole(5)
    const r = updateClimbing(
      createInitialSurfaceState(), pos, CENTER, CAM_YAW, AIM_UP_PITCH, held('left'), 0.016, NO_NODES,
    )
    expect(r.surface.leftAnchorPos).toBeNull()
    expect(r.swung).toBe('none')
  })

  it('reels the body toward a held anchor', () => {
    const pos = floatingAbovePole(8)
    let s = createInitialSurfaceState()
    // Press: cast anchor on the surface below
    let r = updateClimbing(s, pos, CENTER, CAM_YAW, AIM_DOWN_PITCH, held('left'), 0.05, NO_NODES)
    s = r.surface
    const distBefore = pos.distanceTo(CENTER)
    // Keep holding: reel in over several frames
    for (let i = 0; i < 12; i++) {
      r = updateClimbing(s, pos, CENTER, CAM_YAW, AIM_DOWN_PITCH, held('left'), 0.05, NO_NODES)
      s = r.surface
    }
    expect(pos.distanceTo(CENTER)).toBeLessThan(distBefore)  // pulled down toward anchor
  })

  it('releasing drops the anchor and the body keeps drifting', () => {
    const s0 = {
      ...createInitialSurfaceState(),
      leftAnchorPos: [0, R, 0] as [number, number, number],
      charVelocity:  [2, 0, 0] as [number, number, number],
    }
    const pos = floatingAbovePole(5)
    const r = updateClimbing(s0, pos, CENTER, CAM_YAW, 0, NO_INPUT, 0.05, NO_NODES)
    expect(r.surface.leftAnchorPos).toBeNull()   // dropped on release
    expect(pos.x).toBeGreaterThan(0)             // coasted with leftover momentum
  })

  it('soft collision pushes the body out and strips inward velocity', () => {
    const pos = new Vector3(0, R - 2, 0)   // start just below the surface
    const s0 = { ...createInitialSurfaceState(), charVelocity: [0, -5, 0] as [number, number, number] }
    const r = updateClimbing(s0, pos, CENTER, CAM_YAW, 0, NO_INPUT, 0.05, NO_NODES)
    expect(pos.distanceTo(CENTER)).toBeGreaterThanOrEqual(R - 1e-3)  // pushed back to surface
    expect(r.surface.charVelocity[1]).toBeGreaterThan(-5)            // inward component removed
  })

  it('mining: 3 anchor-strikes on the same node collects ore', () => {
    const node: ResourceNode = {
      worldPos: new Vector3(0, R, 0),
      collected: false,
      mesh: null as unknown as import('three').Mesh,
    }
    let s = createInitialSurfaceState()
    const cast = () => updateClimbing(s, floatingAbovePole(5), CENTER, CAM_YAW, AIM_DOWN_PITCH, held('left'), 0.016, [node])
    const release = () => updateClimbing(s, floatingAbovePole(5), CENTER, CAM_YAW, AIM_DOWN_PITCH, NO_INPUT, 0.016, [node])

    let r = cast(); s = r.surface
    expect(s.miningStrikes).toBe(1)
    expect(r.minedNode).toBeNull()

    r = release(); s = r.surface     // must release before re-casting
    r = cast(); s = r.surface
    expect(s.miningStrikes).toBe(2)

    r = release(); s = r.surface
    r = cast(); s = r.surface
    expect(r.minedNode).toBe(node)
    expect(r.surface.miningStrikes).toBe(0)
  })

  it('MINING_STRIKES constant is 3', () => {
    expect(MINING_STRIKES).toBe(3)
  })
})
