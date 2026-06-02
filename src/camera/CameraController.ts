import { PerspectiveCamera, Quaternion, Vector3 } from 'three'
import type { Group } from 'three'
import type { CharacterController } from '../character/CharacterController.js'
import { ROOM } from '../render/CockpitRoom.js'
import { HANGAR } from '../render/CorridorHangar.js'

export type CameraMode = 'walking' | 'piloting' | 'exterior' | 'subship_piloting' | 'planet_surface'

const PILOT_EYE      = new Vector3(0, 0.22, 0.08)
const SUBSHIP_EYE    = new Vector3(0, 0.55, 36.7)   // fallback when group not set
const SUBSHIP_LOCAL  = new Vector3(0, 0.55, -3.35)  // fighter-jet: right up against the canopy
const EXT_POS    = new Vector3(0, 14, 38)
const EXT_TARGET = new Vector3(0, 2, 8)
const WALK_UP    = 1.5
const WALK_BACK  = 2.8

// How fast camera yaw tracks character facing (lower = less dizzy)
const YAW_FOLLOW  = 0.035
// How fast camera position smooths toward target (lower = smoother but more lag)
const POS_SMOOTH  = 3.5

export class CameraController {
  mode: CameraMode = 'walking'

  private camYaw   = Math.PI
  private shakeAmt = 0
  private shakeX   = 0
  private shakeY   = 0

  // Smoothed camera position — avoids instant jumps on mode switch
  private readonly smoothPos = new Vector3(0, WALK_UP, WALK_BACK)
  private posReady = false          // false = re-init from current camera on next frame

  private readonly _lookWorld = new Vector3()
  private readonly _tmpV     = new Vector3()
  private readonly _subQ     = new Quaternion()
  private readonly _shipQ    = new Quaternion()
  private subshipGroup: Group | null = null

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly shipGroup: Group,
  ) {}

  setSubshipGroup(g: Group | null): void { this.subshipGroup = g }

  shake(intensity: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, intensity)
  }

  update(character: CharacterController, dt = 0.016, planetCtx?: { charWorldPos: Vector3; planetCenter: Vector3 }): void {
    // ── Planet surface mode ───────────────────────────────────────────────
    if (this.mode === 'planet_surface' && planetCtx) {
      const { charWorldPos, planetCenter } = planetCtx
      const up = charWorldPos.clone().sub(planetCenter).normalize()
      const camFwd = new Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw))

      // Camera: above and behind the character, in world space
      const camWorld = charWorldPos.clone()
        .addScaledVector(up, 3.5)
        .addScaledVector(camFwd, -3.2)

      // World → shipGroup local
      this._tmpV.copy(camWorld)
      this.shipGroup.worldToLocal(this._tmpV)
      this.camera.position.set(
        this._tmpV.x + this.shakeX,
        this._tmpV.y + this.shakeY,
        this._tmpV.z,
      )

      // lookAt takes world coords; Three.js handles parent inverse automatically
      this._lookWorld.copy(charWorldPos).addScaledVector(up, 0.8)
      this.camera.lookAt(this._lookWorld)
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

    // ── Piloting (1st-person main cockpit) ───────────────────────────────
    if (this.mode === 'piloting') {
      this.camera.position.set(
        PILOT_EYE.x + this.shakeX,
        PILOT_EYE.y + this.shakeY,
        PILOT_EYE.z,
      )
      this.camera.rotation.set(0, 0, 0)
      this.posReady = false
      return
    }

    // ── Sub-ship piloting (1st-person sub-ship cockpit) ───────────────────
    if (this.mode === 'subship_piloting') {
      if (this.subshipGroup) {
        // Eye position: convert from subship local → world → shipGroup local
        this._tmpV.copy(SUBSHIP_LOCAL)
        this.subshipGroup.localToWorld(this._tmpV)
        this.shipGroup.worldToLocal(this._tmpV)
        this.camera.position.set(
          this._tmpV.x + this.shakeX,
          this._tmpV.y + this.shakeY,
          this._tmpV.z,
        )
        // Orientation: use lookAt toward the subship nose (z=-20 in subship local).
        // lookAt() handles the shipGroup parent transform automatically.
        this._lookWorld.set(0, 0, -20)
        this.subshipGroup.localToWorld(this._lookWorld)
        this.camera.lookAt(this._lookWorld)
      } else {
        this.camera.position.set(
          SUBSHIP_EYE.x + this.shakeX,
          SUBSHIP_EYE.y + this.shakeY,
          SUBSHIP_EYE.z,
        )
        this.camera.rotation.set(0, 0, 0)
      }
      this.posReady = false
      return
    }

    // ── Walking (3rd-person behind character) ─────────────────────────────
    const p = character.position

    // Slowly follow character's facing direction (low factor = less dizzy)
    let dyaw = character.facingYaw - this.camYaw
    while (dyaw >  Math.PI) dyaw -= 2 * Math.PI
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI
    this.camYaw += dyaw * (YAW_FOLLOW * Math.min(1, dt / 0.016))

    // Compute where the camera wants to be (behind + above character)
    const bx = -Math.sin(this.camYaw)
    const bz = -Math.cos(this.camYaw)

    const rawX = p.x + bx * WALK_BACK
    const rawZ = p.z + bz * WALK_BACK
    const tgtX = Math.max(ROOM.leftX  + 0.5, Math.min(ROOM.rightX - 0.5, rawX))
    const tgtZ = Math.max(ROOM.frontZ + 0.5, Math.min(HANGAR.backZ - 0.5, rawZ))
    const tgtY = p.y + WALK_UP  // Y also smoothed to absorb jumps/bobs

    // First frame after entering walking mode: seed smoothPos from current position
    // so the camera glides from the pilot eye to behind the character (no hard cut)
    if (!this.posReady) {
      this.smoothPos.copy(this.camera.position)
      this.posReady = true
    }

    // Smoothly move toward target (lerp factor capped so it can't overshoot)
    const lerpT = Math.min(1, POS_SMOOTH * dt)
    this.smoothPos.x += (tgtX - this.smoothPos.x) * lerpT
    this.smoothPos.y += (tgtY - this.smoothPos.y) * lerpT
    this.smoothPos.z += (tgtZ - this.smoothPos.z) * lerpT

    this.camera.position.copy(this.smoothPos)

    // Look at character's upper torso (world space)
    this._lookWorld.set(p.x, p.y + 0.25, p.z)
    this.shipGroup.localToWorld(this._lookWorld)
    this.camera.lookAt(this._lookWorld)
  }

  setMode(mode: CameraMode): void {
    if (mode === 'walking') {
      this.posReady = false
    }
    this.camera.fov = mode === 'subship_piloting' ? 110 : 85
    if (mode === 'planet_surface') this.camera.fov = 85
    this.camera.updateProjectionMatrix()
    this.mode = mode
  }

  /** Snap camYaw immediately — prevents a sudden rotation when standing up */
  setWalkYaw(yaw: number): void { this.camYaw = yaw }

  /** Exposed for character-relative movement in main.ts */
  getCamYaw(): number { return this.camYaw }
}
