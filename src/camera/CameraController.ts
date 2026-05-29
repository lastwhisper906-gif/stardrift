import { PerspectiveCamera, Vector3 } from 'three'
import type { Group } from 'three'
import type { CharacterController } from '../character/CharacterController.js'
import { ROOM } from '../render/CockpitRoom.js'

export type CameraMode = 'walking' | 'piloting' | 'exterior'

const PILOT_EYE  = new Vector3(0, 0.08, 0.10)
// exterior camera in ship-local space (behind & above the ship)
const EXT_POS    = new Vector3(0, 14, 38)
const EXT_TARGET = new Vector3(0, 2, 8)
const WALK_UP    = 1.5
const WALK_BACK  = 3.2

export class CameraController {
  mode: CameraMode = 'walking'

  private camYaw = Math.PI          // smoothly follows character facing
  private readonly _lookWorld = new Vector3()

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly shipGroup: Group,
  ) {}

  update(character: CharacterController): void {
    if (this.mode === 'exterior') {
      // Camera in ship-local space — stays behind/above regardless of ship orientation
      this.camera.position.copy(EXT_POS)
      this._lookWorld.copy(EXT_TARGET)
      this.shipGroup.localToWorld(this._lookWorld)
      this.camera.lookAt(this._lookWorld)
      return
    }

    if (this.mode === 'piloting') {
      this.camera.position.copy(PILOT_EYE)
      this.camera.rotation.set(0, 0, 0)
      return
    }

    const p = character.position

    // Smooth yaw follow with wrap-around handling
    let dyaw = character.facingYaw - this.camYaw
    while (dyaw >  Math.PI) dyaw -= 2 * Math.PI
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI
    this.camYaw += dyaw * 0.12

    // Behind direction = (-sin(yaw), 0, -cos(yaw))
    // Facing direction = (sin(yaw), 0, cos(yaw)), at yaw=π → (0,0,-1) = toward helm
    const bx = -Math.sin(this.camYaw)
    const bz = -Math.cos(this.camYaw)

    const rawX = p.x + bx * WALK_BACK
    const rawZ = p.z + bz * WALK_BACK

    const camX = Math.max(ROOM.leftX  + 0.5, Math.min(ROOM.rightX - 0.5, rawX))
    const camZ = Math.max(ROOM.frontZ + 0.5, Math.min(ROOM.backZ   - 0.5, rawZ))

    this.camera.position.set(camX, p.y + WALK_UP, camZ)

    // Look at character's upper torso in world space
    this._lookWorld.set(p.x, p.y + 0.25, p.z)
    this.shipGroup.localToWorld(this._lookWorld)
    this.camera.lookAt(this._lookWorld)
  }

  setMode(mode: CameraMode): void {
    this.mode = mode
  }

  /** Snap camYaw immediately (call when switching from piloting to walking) */
  setWalkYaw(yaw: number): void {
    this.camYaw = yaw
  }
}
