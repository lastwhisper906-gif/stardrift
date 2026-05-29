import { PerspectiveCamera, Vector3 } from 'three'
import type { Group } from 'three'
import type { CharacterController } from '../character/CharacterController.js'
import { ROOM } from '../render/CockpitRoom.js'

export type CameraMode = 'walking' | 'piloting'

// 1st-person pilot eye in shipGroup local space
const PILOT_EYE = new Vector3(0, 0.08, 0.10)

// 3rd-person offsets from character position (ship local)
const WALK_UP   = 1.5   // camera above char center
const WALK_BACK = 3.5   // camera behind char

export class CameraController {
  mode: CameraMode = 'walking'

  private readonly _lookTarget = new Vector3()
  private readonly _lookWorld  = new Vector3()

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly shipGroup: Group,
  ) {}

  update(character: CharacterController): void {
    if (this.mode === 'piloting') {
      this.camera.position.copy(PILOT_EYE)
      // Zero out any rotation CameraController may have set previously
      // so the camera just looks along -Z of the shipGroup (forward).
      this.camera.rotation.set(0, 0, 0)
      return
    }

    // ── WALKING: 3rd-person follow ─────────────────────────────────────
    const p = character.position

    // Camera sits behind+above the character (in ship local space)
    const camZ = Math.min(p.z + WALK_BACK, ROOM.backZ - 0.5)
    this.camera.position.set(p.x * 0.6, p.y + WALK_UP, camZ)

    // Look at upper-torso in world space
    this._lookTarget.set(p.x, p.y + 0.28, p.z)
    this.shipGroup.localToWorld(this._lookTarget.clone().copy(this._lookTarget))
    // Use world position:
    this._lookWorld.copy(this._lookTarget)
    this.shipGroup.localToWorld(this._lookWorld)
    this.camera.lookAt(this._lookWorld)
  }

  setMode(mode: CameraMode): void {
    this.mode = mode
  }
}
