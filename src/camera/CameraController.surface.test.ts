import { describe, it, expect } from 'vitest'
import { Group, PerspectiveCamera, Vector3 } from 'three'
import { CameraController } from './CameraController.js'
import { PLANET_RADIUS, SURFACE_EYE } from '../render/PlanetMesh.js'
import type { CharacterController } from '../character/CharacterController.js'

// The planet_surface branch never touches `character`, so a bare stub is fine.
const CHAR = {} as unknown as CharacterController
const CENTER = new Vector3(0, 0, 0)

/** Build a controller in planet_surface mode with an identity-transform shipGroup. */
function makeController(): { ctrl: CameraController; cam: PerspectiveCamera; group: Group } {
  const cam = new PerspectiveCamera()
  const group = new Group()
  group.add(cam)
  group.updateMatrixWorld(true)
  const ctrl = new CameraController(cam, group)
  ctrl.setMode('planet_surface')
  return { ctrl, cam, group }
}

/** Character foot position floating above the sphere at a given surface normal. */
function charAt(normal: Vector3): Vector3 {
  return normal.clone().normalize().multiplyScalar(PLANET_RADIUS + 3.0)
}

/** World-space forward the camera is looking down (-Z of its quaternion). */
function camForward(cam: PerspectiveCamera): Vector3 {
  return new Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
}

/** Drive one surface-mode update with the given mouse deltas. */
function look(ctrl: CameraController, charWorldPos: Vector3, mouseDX = 0, mouseDY = 0) {
  ctrl.update(CHAR, 0.016, 0, 0, {
    charWorldPos, planetCenter: CENTER,
    rotateLeft: false, rotateRight: false,
    mouseDX, mouseDY,
  })
}

// A spread of landing latitudes/longitudes — including non-pole sites where the
// old Y=0 forward vector produced wrong tangent projections.
const SITES: Array<[string, Vector3]> = [
  ['north pole',  new Vector3(0, 1, 0)],
  ['equator +X',  new Vector3(1, 0, 0)],
  ['equator +Z',  new Vector3(0, 0, 1)],
  ['mid-lat',     new Vector3(0.5, 0.7, 0.3)],
  ['near south',  new Vector3(0.1, -0.95, 0.2)],
]

describe('CameraController — planet_surface look basis', () => {
  it('eye sits SURFACE_EYE above the character along the surface normal', () => {
    for (const [name, n] of SITES) {
      const { ctrl, cam, group } = makeController()
      const charWorldPos = charAt(n)
      look(ctrl, charWorldPos)
      // camera is a child of an identity-transform group → local == world
      const eyeWorld = cam.position.clone()
      group.localToWorld(eyeWorld)
      const up = charWorldPos.clone().sub(CENTER).normalize()
      const expected = charWorldPos.clone().addScaledVector(up, SURFACE_EYE)
      expect(eyeWorld.distanceTo(expected), `eye at ${name}`).toBeLessThan(1e-4)
    }
  })

  it('at pitch 0 the view is tangent to the sphere (perpendicular to up) at every site', () => {
    for (const [name, n] of SITES) {
      const { ctrl, cam } = makeController()
      const charWorldPos = charAt(n)
      look(ctrl, charWorldPos)               // camPitch resets to 0 on setMode
      const up = charWorldPos.clone().sub(CENTER).normalize()
      const fwd = camForward(cam)
      expect(Math.abs(fwd.dot(up)), `tangent at ${name}`).toBeLessThan(1e-4)
    }
  })

  it('mouse-down (negative camPitch) aims toward the planet center', () => {
    for (const [name, n] of SITES) {
      const { ctrl, cam } = makeController()
      const charWorldPos = charAt(n)
      const up = charWorldPos.clone().sub(CENTER).normalize()
      // Spec: camPitch += mouseDY * SENS, and camPitch < 0 looks down toward planet.
      // So a negative mouseDY drives the view downward.
      look(ctrl, charWorldPos, 0, -400)
      const fwd = camForward(cam)
      // Looking down → forward has a component pointing inward (against up).
      expect(fwd.dot(up), `look-down at ${name}`).toBeLessThan(-0.3)
    }
  })

  it('mouse-up (positive camPitch) aims away from the planet (toward open space)', () => {
    for (const [name, n] of SITES) {
      const { ctrl, cam } = makeController()
      const charWorldPos = charAt(n)
      const up = charWorldPos.clone().sub(CENTER).normalize()
      look(ctrl, charWorldPos, 0, 400)
      const fwd = camForward(cam)
      expect(fwd.dot(up), `look-up at ${name}`).toBeGreaterThan(0.3)
    }
  })

  it('yaw rotates the tangent forward without flipping or losing tangency', () => {
    for (const [name, n] of SITES) {
      const charWorldPos = charAt(n)
      const up = charWorldPos.clone().sub(CENTER).normalize()

      // Accumulate yaw across several mouse moves; track forward continuity.
      const { ctrl, cam } = makeController()
      let prev = (look(ctrl, charWorldPos, 0, 0), camForward(cam))
      for (let i = 0; i < 8; i++) {
        look(ctrl, charWorldPos, 120, 0)  // turn right a bit each step
        const cur = camForward(cam)
        // stays tangent
        expect(Math.abs(cur.dot(up)), `yaw tangency ${name} step ${i}`).toBeLessThan(1e-4)
        // no sudden flip — small step => high correlation with previous forward
        expect(cur.dot(prev), `yaw continuity ${name} step ${i}`).toBeGreaterThan(0.7)
        prev = cur
      }
    }
  })

  it('produces an orthonormal camera orientation (valid quaternion)', () => {
    for (const [name, n] of SITES) {
      const { ctrl, cam } = makeController()
      look(ctrl, charAt(n), 50, -50)
      const len = cam.quaternion.length()
      expect(Math.abs(len - 1), `unit quat at ${name}`).toBeLessThan(1e-5)
    }
  })
})
