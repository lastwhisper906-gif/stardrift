import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import type { Group } from 'three'
import type { CharacterController } from '../character/CharacterController.js'
import { ROOM } from '../render/CockpitRoom.js'
import { HANGAR } from '../render/CorridorHangar.js'
import { SURFACE_EYE } from '../render/PlanetMesh.js'
import { SUBSHIP_ROOM } from '../render/SubshipVehicle.js'

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

  // Disembark path waypoints (world space)
  private readonly _disembarkHatch = new Vector3()
  private _hasDisembarkHatch = false

  // Reboard path waypoints (world space)
  private readonly _reboardHatchOut = new Vector3()  // outside the hull
  private readonly _reboardHatchIn  = new Vector3()  // just inside the doorframe
  private readonly _reboardSeat     = new Vector3()  // cockpit eye
  private readonly _reboardSurfUp   = new Vector3()  // surface normal at reboard start

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

      const YAW_SPEED  = 1.8
      const MOUSE_SENS = 0.0022
      if (rotateLeft)  this.camYaw -= YAW_SPEED * dt
      if (rotateRight) this.camYaw += YAW_SPEED * dt
      if (planetCtx.mouseDX) this.camYaw   += planetCtx.mouseDX * MOUSE_SENS
      if (planetCtx.mouseDY) this.camPitch  = Math.max(-1.48, Math.min(0.8,
        this.camPitch - planetCtx.mouseDY * MOUSE_SENS))

      const up  = this._tmpV.copy(charWorldPos).sub(planetCenter).normalize()

      this._lookWorld.copy(charWorldPos).addScaledVector(up, SURFACE_EYE)
      this.shipGroup.worldToLocal(this._lookWorld)
      this.camera.position.set(
        this._lookWorld.x + this.shakeX,
        this._lookWorld.y + this.shakeY,
        this._lookWorld.z,
      )

      const cf   = new Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))
      const fwdT = cf.clone().addScaledVector(up, -up.dot(cf)).normalize()

      const lookTarget = charWorldPos.clone()
        .addScaledVector(up, SURFACE_EYE)
        .addScaledVector(fwdT, 5 * Math.cos(this.camPitch))
        .addScaledVector(up,   5 * Math.sin(this.camPitch))
      this.camera.lookAt(lookTarget)

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

  /**
   * Call once when disembark begins.
   * hatchWorldPos: world-space center of the open hatch (SubshipVehicle.hatchWorldPos).
   * This is stored as the bezier control point so the camera exits through the door.
   */
  beginDisembarkLerp(hatchWorldPos?: Vector3): void {
    // Capture camera start in world space
    this._lerpStart.copy(this.camera.position)
    this.shipGroup.localToWorld(this._lerpStart)

    if (hatchWorldPos) {
      this._disembarkHatch.copy(hatchWorldPos)
      this._hasDisembarkHatch = true
    } else {
      this._hasDisembarkHatch = false
    }
  }

  /**
   * Call every frame during disembarking (t: 0→1, pre-eased).
   * Uses a quadratic bezier: cockpit eye → hatch opening → surface eye.
   * Converts world→ship-local each frame so mothership drift doesn't cause teleport.
   */
  applyDisembarkLerp(charWorldPos: Vector3, planetCenter: Vector3, t: number): void {
    // Compute surface eye destination every frame (planet may be moving relative to ship)
    const up = new Vector3().copy(charWorldPos).sub(planetCenter).normalize()
    this._lerpEnd.copy(charWorldPos).addScaledVector(up, SURFACE_EYE)

    let worldPos: Vector3

    if (this._hasDisembarkHatch) {
      // Quadratic bezier: P0=cockpit, P1=hatch, P2=surface eye
      // This curves the path through the hatch opening naturally.
      const s = 1 - t
      worldPos = new Vector3()
        .addScaledVector(this._lerpStart,      s * s)
        .addScaledVector(this._disembarkHatch, 2 * s * t)
        .addScaledVector(this._lerpEnd,        t * t)
    } else {
      // Fallback: straight lerp
      worldPos = new Vector3().lerpVectors(this._lerpStart, this._lerpEnd, t)
    }

    // Convert world → ship-local EACH frame to prevent mothership drift glitch
    const localPos = worldPos.clone()
    this.shipGroup.worldToLocal(localPos)
    this.camera.position.copy(localPos)

    // Camera looks toward the destination: toward hatch for first half, then toward surface
    const lookTarget = t < 0.6
      ? this._disembarkHatch.clone()
      : this._lerpEnd.clone()
    this.camera.lookAt(lookTarget)
  }

  /**
   * Call once when reboard begins.
   * Precomputes all waypoints in world space so the 3-phase path is stable.
   *
   * Phase A (t 0.00–0.30): arc from surface to just outside the hatch
   * Phase B (t 0.30–0.58): climb from outside into the doorframe
   * Phase C (t 0.58–1.00): slide from doorframe into pilot seat
   */
  beginReboardLerp(
    subshipGroup: Group,
    charWorldPos: Vector3,
    planetCenter: Vector3,
  ): void {
    // Capture current camera position in world space
    this._lerpStart.copy(this.camera.position)
    this.shipGroup.localToWorld(this._lerpStart)

    // Surface normal (radial outward) at the character's feet
    this._reboardSurfUp.copy(charWorldPos).sub(planetCenter).normalize()

    // Waypoint A — just outside the hatch opening (+X side of hull)
    // Subship-local: X=2.0 (outside 1.3 wall), Y=mid-height, Z=1.8 (mid-door)
    this._reboardHatchOut
      .set(2.0, SUBSHIP_ROOM.floorY + 0.9, 1.8)
      .applyQuaternion(subshipGroup.quaternion)
      .add(subshipGroup.position)

    // Waypoint B — just inside the doorframe (0.5 m inward from the wall)
    this._reboardHatchIn
      .set(0.7, SUBSHIP_ROOM.floorY + 0.7, 1.8)
      .applyQuaternion(subshipGroup.quaternion)
      .add(subshipGroup.position)

    // Waypoint C — cockpit eye (SUBSHIP_LOCAL in world space)
    this._reboardSeat.copy(SUBSHIP_LOCAL)
      .applyQuaternion(subshipGroup.quaternion)
      .add(subshipGroup.position)

    this._lerpEnd.copy(this._reboardSeat)
  }

  /**
   * Call every frame during reboarding (t: 0→1, pre-eased).
   * Three phases give the feeling of walking to the ship, climbing in, and sitting down.
   */
  applyReboardLerp(t: number): void {
    const PHASE_A = 0.30   // 0.00–0.30 walk to hatch
    const PHASE_B = 0.58   // 0.30–0.58 climb through hatch
    //                        0.58–1.00 slide into seat

    let worldPos: Vector3
    let lookAt: Vector3

    if (t <= PHASE_A) {
      // Phase A: quadratic bezier arc from surface → hatch exterior
      // Arc slightly upward (surface normal direction) so it looks like climbing a step.
      const tA = t / PHASE_A
      const eA = tA < 0.5 ? 2 * tA * tA : 1 - Math.pow(-2 * tA + 2, 2) / 2
      const mid = new Vector3()
        .addVectors(this._lerpStart, this._reboardHatchOut)
        .multiplyScalar(0.5)
        .addScaledVector(this._reboardSurfUp, 0.5)   // lift arc 0.5 m upward
      const s = 1 - eA
      worldPos = new Vector3()
        .addScaledVector(this._lerpStart,       s * s)
        .addScaledVector(mid,                   2 * s * eA)
        .addScaledVector(this._reboardHatchOut, eA * eA)
      lookAt = this._reboardHatchOut.clone()

    } else if (t <= PHASE_B) {
      // Phase B: straight lerp from hatch exterior → inside doorframe
      const tB = (t - PHASE_A) / (PHASE_B - PHASE_A)
      const eB = tB < 0.5 ? 2 * tB * tB : 1 - Math.pow(-2 * tB + 2, 2) / 2
      worldPos = new Vector3().lerpVectors(this._reboardHatchOut, this._reboardHatchIn, eB)
      lookAt = this._reboardSeat.clone()

    } else {
      // Phase C: ease into pilot seat — slow start (ducking in), smooth end (settling)
      const tC = (t - PHASE_B) / (1.0 - PHASE_B)
      const eC = tC < 0.5 ? 2 * tC * tC : 1 - Math.pow(-2 * tC + 2, 2) / 2
      worldPos = new Vector3().lerpVectors(this._reboardHatchIn, this._reboardSeat, eC)
      // Look toward the subship nose as we settle in
      if (this.subshipGroup) {
        lookAt = new Vector3(0, 0, -20)
          .applyQuaternion(this.subshipGroup.quaternion)
          .add(this.subshipGroup.position)
      } else {
        lookAt = this._reboardSeat.clone()
      }
    }

    // Convert world → ship-local EACH FRAME (prevents mothership drift teleport glitch)
    const localPos = worldPos.clone()
    this.shipGroup.worldToLocal(localPos)
    this.camera.position.copy(localPos)

    this.camera.lookAt(lookAt)
  }
}
