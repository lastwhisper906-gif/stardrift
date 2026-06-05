import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import type { Group } from 'three'
import type { CharacterController } from '../character/CharacterController.js'
import { ROOM } from '../render/CockpitRoom.js'
import { HANGAR } from '../render/CorridorHangar.js'
import { SURFACE_EYE } from '../render/PlanetMesh.js'

export type CameraMode = 'walking' | 'piloting' | 'exterior' | 'subship_piloting' | 'planet_surface'

const PILOT_EYE      = new Vector3(0, 0.22, 0.08)
const SUBSHIP_EYE    = new Vector3(0, 0.55, 36.7)   // fallback when group not set
const SUBSHIP_LOCAL  = new Vector3(0, 0.55, -3.35)  // fighter-jet: right up against the canopy
const EXT_POS    = new Vector3(0, 14, 38)
const EXT_TARGET = new Vector3(0, 2, 8)
const WALK_UP    = 1.5
const WALK_BACK  = 2.8

const YAW_FOLLOW  = 0.035
const POS_SMOOTH  = 3.5

// Mouse sensitivity for FPS look in piloting / subship modes
const PILOT_MOUSE_SENS = 0.0018

export class CameraController {
  mode: CameraMode = 'walking'

  private camYaw   = Math.PI
  private camPitch = 0          // used only in planet_surface 1st-person
  private shakeAmt = 0
  private shakeX   = 0
  private shakeY   = 0

  // Free-look yaw/pitch for piloting + subship_piloting modes
  private pilotYaw   = 0
  private pilotPitch = 0

  private readonly smoothPos = new Vector3(0, WALK_UP, WALK_BACK)
  private posReady = false

  private readonly _lookWorld  = new Vector3()
  private readonly _tmpV      = new Vector3()
  private readonly _subQ      = new Quaternion()
  private readonly _shipQ     = new Quaternion()
  private readonly _yawQ      = new Quaternion()
  private readonly _pitchQ    = new Quaternion()
  private readonly _lerpStart = new Vector3()
  private readonly _lerpEnd   = new Vector3()
  private subshipGroup: Group | null = null

  private static readonly _Y_AXIS = new Vector3(0, 1, 0)
  private static readonly _X_AXIS = new Vector3(1, 0, 0)

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly shipGroup: Group,
  ) {}

  setSubshipGroup(g: Group | null): void { this.subshipGroup = g }

  shake(intensity: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, intensity)
  }

  update(
    character: CharacterController,
    dt = 0.016,
    mouseDX = 0,
    mouseDY = 0,
    planetCtx?: { charWorldPos: Vector3; planetCenter: Vector3; rotateLeft: boolean; rotateRight: boolean; mouseDX?: number; mouseDY?: number },
  ): void {
    // ── Planet surface — 1st-person ice-climbing ──────────────────────────
    if (this.mode === 'planet_surface' && planetCtx) {
      const { charWorldPos, planetCenter, rotateLeft, rotateRight } = planetCtx

      // ── 1. Accumulate yaw / pitch ─────────────────────────────────────
      const MOUSE_SENS = 0.0025
      const YAW_SPEED  = 1.8
      if (rotateLeft)           this.camYaw -= YAW_SPEED * dt
      if (rotateRight)          this.camYaw += YAW_SPEED * dt
      if (planetCtx.mouseDX)   this.camYaw   += planetCtx.mouseDX * MOUSE_SENS
      if (planetCtx.mouseDY)   this.camPitch += planetCtx.mouseDY * MOUSE_SENS
      // Full ±90°: player can look straight down at the planet
      this.camPitch = Math.max(
        -Math.PI / 2 + 0.02,
        Math.min(Math.PI / 2 - 0.02, this.camPitch),
      )

      // ── 2. Surface-normal "up" (radial outward from planet center) ────
      const up = new Vector3().copy(charWorldPos).sub(planetCenter).normalize()

      // ── 3. Stable tangent-plane basis (north + east) ──────────────────
      const worldY = new Vector3(0, 1, 0)
      const dotUpY = up.dot(worldY)
      const north  = Math.abs(dotUpY) < 0.99
        ? worldY.clone().addScaledVector(up, -dotUpY).normalize()
        : new Vector3(1, 0, 0).addScaledVector(up, -up.x).normalize()
      const east = new Vector3().crossVectors(up, north)  // unit if north & up are unit

      // ── 4. Forward direction in tangent plane after yaw ───────────────
      // camYaw = 0 → north;  camYaw = +π/2 → east
      const fwd = new Vector3()
        .addScaledVector(north, Math.cos(this.camYaw))
        .addScaledVector(east,  Math.sin(this.camYaw))

      // Camera right: cross(fwd, up) — stays in tangent plane
      const camRight = new Vector3().crossVectors(fwd, up)

      // ── 5. Apply pitch: tilt forward toward / away from planet ────────
      // camPitch > 0 → look up (away from planet)
      // camPitch < 0 → look down (toward planet center)
      const lookDir = new Vector3()
        .addScaledVector(fwd, Math.cos(this.camPitch))
        .addScaledVector(up,  Math.sin(this.camPitch))

      // Camera up after pitch
      const camUp = new Vector3().crossVectors(camRight, lookDir).normalize()

      // ── 6. Eye position (world space) ────────────────────────────────
      this._lookWorld.copy(charWorldPos).addScaledVector(up, SURFACE_EYE)

      // ── 7. Camera position (convert to ship-local as the rest of file does)
      const eyeLocal = this._lookWorld.clone()
      this.shipGroup.worldToLocal(eyeLocal)
      this.camera.position.set(
        eyeLocal.x + this.shakeX,
        eyeLocal.y + this.shakeY,
        eyeLocal.z,
      )

      // ── 8. Camera orientation from lookDir + camUp ────────────────────
      // Three.js: camera looks down local -Z, local +Y = up
      // Build rotation matrix from right/up/back axes:
      const zAxis = lookDir.clone().negate()                              // +Z = backward
      const xAxis = new Vector3().crossVectors(camUp, zAxis).normalize() // +X = right
      const yAxis = new Vector3().crossVectors(zAxis, xAxis)             // +Y = recomputed up
      const rotMat = new Matrix4().makeBasis(xAxis, yAxis, zAxis)
      this.camera.quaternion.setFromRotationMatrix(rotMat)

      this.posReady = false
      return
    }

    // ── Shake decay ───────────────────────────────────────────────────────
    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 5)
      this.shakeX   = (Math.random() * 2 - 1) * this.shakeAmt * 0.05
      this.shakeY   = (Math.random() * 2 - 1) * this.shakeAmt * 0.05
    } else {
      this.shakeX = this.shakeY = 0
    }

    // ── Exterior view ─────────────────────────────────────────────────────
    if (this.mode === 'exterior') {
      this.camera.position.copy(EXT_POS)
      this._lookWorld.copy(EXT_TARGET)
      this.shipGroup.localToWorld(this._lookWorld)
      this.camera.lookAt(this._lookWorld)
      this.posReady = false
      return
    }

    // ── Piloting (1st-person main cockpit) — FPS free-look ───────────────
    if (this.mode === 'piloting') {
      // Accumulate free-look from mouse
      this.pilotYaw   += mouseDX * PILOT_MOUSE_SENS
      this.pilotPitch = Math.max(-1.3, Math.min(0.8,
        this.pilotPitch - mouseDY * PILOT_MOUSE_SENS))

      this.camera.position.set(
        PILOT_EYE.x + this.shakeX,
        PILOT_EYE.y + this.shakeY,
        PILOT_EYE.z,
      )
      // Build rotation from accumulated yaw/pitch (relative to ship forward = -Z in shipGroup local)
      this.camera.rotation.set(this.pilotPitch, this.pilotYaw, 0, 'YXZ')
      this.posReady = false
      return
    }

    // ── Sub-ship piloting (1st-person sub-ship cockpit) — FPS free-look ──
    if (this.mode === 'subship_piloting') {
      // Accumulate free-look
      this.pilotYaw   += mouseDX * PILOT_MOUSE_SENS
      this.pilotPitch = Math.max(-1.3, Math.min(0.8,
        this.pilotPitch - mouseDY * PILOT_MOUSE_SENS))

      if (this.subshipGroup) {
        // Camera position: subship cockpit eye in shipGroup local space
        this._tmpV.copy(SUBSHIP_LOCAL)
        this.subshipGroup.localToWorld(this._tmpV)
        this.shipGroup.worldToLocal(this._tmpV)
        this.camera.position.set(
          this._tmpV.x + this.shakeX,
          this._tmpV.y + this.shakeY,
          this._tmpV.z,
        )

        // Base orientation: look at subship nose (world space point)
        this._lookWorld.set(0, 0, -20)
        this.subshipGroup.localToWorld(this._lookWorld)
        this.camera.lookAt(this._lookWorld)

        // Apply FPS free-look offset on top of base orientation
        // yaw around world Y (local Y ≈ world Y when ship is level)
        // pitch around camera's right axis
        this._yawQ.setFromAxisAngle(CameraController._Y_AXIS, this.pilotYaw)
        this._pitchQ.setFromAxisAngle(CameraController._X_AXIS, this.pilotPitch)
        this.camera.quaternion.premultiply(this._yawQ).multiply(this._pitchQ)
      } else {
        this.camera.position.set(
          SUBSHIP_EYE.x + this.shakeX,
          SUBSHIP_EYE.y + this.shakeY,
          SUBSHIP_EYE.z,
        )
        this.camera.rotation.set(this.pilotPitch, this.pilotYaw, 0, 'YXZ')
      }
      this.posReady = false
      return
    }

    // ── Walking (3rd-person behind character) ─────────────────────────────
    const p = character.position

    let dyaw = character.facingYaw - this.camYaw
    while (dyaw >  Math.PI) dyaw -= 2 * Math.PI
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI
    this.camYaw += dyaw * (YAW_FOLLOW * Math.min(1, dt / 0.016))

    const bx = -Math.sin(this.camYaw)
    const bz = -Math.cos(this.camYaw)

    const rawX = p.x + bx * WALK_BACK
    const rawZ = p.z + bz * WALK_BACK
    const tgtX = Math.max(ROOM.leftX  + 0.5, Math.min(ROOM.rightX - 0.5, rawX))
    const tgtZ = Math.max(ROOM.frontZ + 0.5, Math.min(HANGAR.backZ - 0.5, rawZ))
    const tgtY = p.y + WALK_UP

    if (!this.posReady) {
      this.smoothPos.copy(this.camera.position)
      this.posReady = true
    }

    const lerpT = Math.min(1, POS_SMOOTH * dt)
    this.smoothPos.x += (tgtX - this.smoothPos.x) * lerpT
    this.smoothPos.y += (tgtY - this.smoothPos.y) * lerpT
    this.smoothPos.z += (tgtZ - this.smoothPos.z) * lerpT

    this.camera.position.copy(this.smoothPos)

    this._lookWorld.set(p.x, p.y + 0.25, p.z)
    this.shipGroup.localToWorld(this._lookWorld)
    this.camera.lookAt(this._lookWorld)
  }

  setMode(mode: CameraMode): void {
    if (mode === 'walking') this.posReady = false
    if (mode === 'planet_surface') this.camPitch = 0
    // Reset free-look when (re-)entering a cockpit
    if (mode === 'piloting' || mode === 'subship_piloting') {
      this.pilotYaw   = 0
      this.pilotPitch = 0
    }
    this.camera.fov = mode === 'subship_piloting' ? 110 : 85
    this.camera.updateProjectionMatrix()
    this.mode = mode
  }

  /** Snap camYaw immediately — prevents a sudden rotation when standing up */
  setWalkYaw(yaw: number): void { this.camYaw = yaw }

  getCamYaw(): number { return this.camYaw }

  getCamPitch(): number { return this.camPitch }

  beginDisembarkLerp(): void {
    this._lerpStart.copy(this.camera.position)
    this.shipGroup.localToWorld(this._lerpStart)
  }

  applyDisembarkLerp(charWorldPos: Vector3, planetCenter: Vector3, t: number): void {
    this._tmpV.copy(charWorldPos).sub(planetCenter).normalize()
    this._lerpEnd.copy(charWorldPos).addScaledVector(this._tmpV, SURFACE_EYE)

    const lerpWorld = new Vector3().lerpVectors(this._lerpStart, this._lerpEnd, t)

    // Weightless float: bob the camera outward along the surface normal as it
    // exits the hatch — peaks mid-move (sin), returns to the eye line at t=1.
    const surfaceNormal = charWorldPos.clone().sub(planetCenter).normalize()
    const arc = surfaceNormal.multiplyScalar(Math.sin(t * Math.PI) * 0.6)
    lerpWorld.add(arc)

    this.shipGroup.worldToLocal(lerpWorld)
    this.camera.position.copy(lerpWorld)

    const fwdWorld = new Vector3().lerpVectors(this._lerpStart, this._lerpEnd, Math.min(1, t + 0.3))
    this.camera.lookAt(fwdWorld)
  }

  beginReboardLerp(subshipGroup: Group): void {
    this._lerpStart.copy(this.camera.position)
    this.shipGroup.localToWorld(this._lerpStart)

    this._tmpV.copy(SUBSHIP_LOCAL)
    subshipGroup.localToWorld(this._tmpV)
    this._lerpEnd.copy(this._tmpV)
  }

  applyReboardLerp(t: number): void {
    const lerpWorld = new Vector3().lerpVectors(this._lerpStart, this._lerpEnd, t)
    this.shipGroup.worldToLocal(lerpWorld)
    this.camera.position.copy(lerpWorld)

    const fwdWorld = new Vector3().lerpVectors(this._lerpStart, this._lerpEnd, Math.min(1, t + 0.3))
    this.camera.lookAt(fwdWorld)
  }
}
