import { describe, it, expect } from 'vitest'
import { Vector3 } from 'three'
import { applyPlanetDrag, resolvePlanetCollision, PLANET_STOP_RADIUS } from './PlanetSystem.js'
import { PLANET_RADIUS } from '../render/PlanetMesh.js'

const CENTER = new Vector3(0, 0, 0)

function makeState(pos: [number, number, number], vel: [number, number, number] = [0, 0, 0]) {
  return { position: pos, velocity: vel, rotation: [0, 0, 0] as [number, number, number], throttle: 0 }
}

describe('applyPlanetDrag', () => {
  it('no drag when outside drag zone', () => {
    const far = PLANET_STOP_RADIUS + 81
    const s = makeState([far, 0, 0], [10, 0, 0])
    const out = applyPlanetDrag(s, CENTER)
    expect(out.velocity).toEqual([10, 0, 0])
  })

  it('applies drag when inside drag zone', () => {
    const mid = PLANET_STOP_RADIUS + 40   // halfway through drag zone
    const s = makeState([mid, 0, 0], [10, 0, 0])
    const out = applyPlanetDrag(s, CENTER)
    expect(out.velocity[0]).toBeLessThan(10)
  })

  it('max drag right at stop radius', () => {
    const s = makeState([PLANET_STOP_RADIUS, 0, 0], [10, 0, 0])
    const out = applyPlanetDrag(s, CENTER)
    // extra = 0.25 → scale = 0.75 → vel = 7.5
    expect(out.velocity[0]).toBeCloseTo(7.5, 4)
  })
})

describe('resolvePlanetCollision', () => {
  it('no correction when outside stop radius', () => {
    const s = makeState([PLANET_STOP_RADIUS + 1, 0, 0], [0, 0, -10])
    const out = resolvePlanetCollision(s, CENTER)
    expect(out.position).toEqual([PLANET_STOP_RADIUS + 1, 0, 0])
  })

  it('pushes out when inside stop radius (direct approach)', () => {
    // Subship has tunnelled 3 m into the planet
    const inside = PLANET_STOP_RADIUS - 3
    const s = makeState([inside, 0, 0], [-20, 0, 0])   // moving inward (negative X)
    const out = resolvePlanetCollision(s, CENTER)

    const pushedOut = Math.sqrt(out.position[0] ** 2 + out.position[1] ** 2 + out.position[2] ** 2)
    expect(pushedOut).toBeCloseTo(PLANET_STOP_RADIUS, 3)
  })

  it('strips inward velocity component', () => {
    const inside = PLANET_STOP_RADIUS - 1
    const s = makeState([inside, 0, 0], [-20, 0, 0])   // moving toward center (-X)
    const out = resolvePlanetCollision(s, CENTER)
    // After correction, velocity component toward center should be gone (≤ 0)
    expect(out.velocity[0]).toBeGreaterThanOrEqual(0)
  })

  it('preserves tangential velocity (oblique approach)', () => {
    const inside = PLANET_STOP_RADIUS - 1
    // Moving mostly downward (-Y) with some sideways (+Z) — oblique hit
    const s = makeState([inside, 0, 0], [-5, 0, 10])
    const out = resolvePlanetCollision(s, CENTER)
    // Tangential component (Z) should survive, though halved by energy absorption
    expect(Math.abs(out.velocity[2])).toBeGreaterThan(0)
  })

  it('handles already-stopped subship (no velocity change needed)', () => {
    const stopped = makeState([PLANET_STOP_RADIUS - 0.1, 0, 0], [0, 0, 0])
    const out = resolvePlanetCollision(stopped, CENTER)
    const dist = Math.sqrt(out.position[0] ** 2 + out.position[1] ** 2 + out.position[2] ** 2)
    expect(dist).toBeCloseTo(PLANET_STOP_RADIUS, 3)
  })

  it('PLANET_STOP_RADIUS is larger than PLANET_RADIUS', () => {
    expect(PLANET_STOP_RADIUS).toBeGreaterThan(PLANET_RADIUS)
  })
})
