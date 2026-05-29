import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import { ROOM, HELM_SEAT_Z, COLLISION_BOXES } from '../render/CockpitRoom.js'

export const CHAR_HEIGHT   = 1.58
export const CHAR_SPEED    = 4.0   // m/s
export const CHAR_FOOT_Y   = ROOM.floorY
export const CHAR_CENTER_Y = CHAR_FOOT_Y + CHAR_HEIGHT / 2

const CHAR_RADIUS = 0.38

export class CharacterController {
  readonly mesh: Group
  /** Position in shipGroup local space (center of character body) */
  readonly position: Vector3

  constructor() {
    this.position = new Vector3(0, CHAR_CENTER_Y, 8.0)  // start mid-room
    this.mesh = this.buildMesh()
    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = Math.PI  // start facing helm (-Z)
  }

  private buildMesh(): Group {
    const g = new Group()
    const suit   = new MeshStandardMaterial({ color: 0x252d3a, roughness: 0.82, metalness: 0.18 })
    const helmet = new MeshStandardMaterial({ color: 0x1a2230, roughness: 0.65, metalness: 0.45 })
    const visor  = new MeshStandardMaterial({ color: 0x334466, roughness: 0.15, metalness: 0.85, emissive: 0x112233, emissiveIntensity: 0.25 })
    const glove  = new MeshStandardMaterial({ color: 0x141c28, roughness: 0.80 })

    const add = (geo: BoxGeometry | CylinderGeometry, mat: MeshStandardMaterial, x: number, y: number, z: number, rx = 0, rz = 0): void => {
      const m = new Mesh(geo, mat)
      m.position.set(x, y, z)
      m.rotation.x = rx
      m.rotation.z = rz
      g.add(m)
    }

    // Torso
    add(new BoxGeometry(0.36, 0.46, 0.20), suit, 0, 0.10, 0)
    // Chest pack
    add(new BoxGeometry(0.18, 0.14, 0.04), helmet, 0, 0.10, -0.12)

    // Head / helmet
    add(new BoxGeometry(0.24, 0.24, 0.22), helmet, 0, 0.50, 0)
    // Visor
    add(new BoxGeometry(0.16, 0.10, 0.025), visor, 0, 0.51, -0.115)

    // Shoulders & arms (both sides)
    for (const sx of [-1, 1] as const) {
      const sign = sx
      // Shoulder pad
      add(new BoxGeometry(0.10, 0.09, 0.14), suit, sign * 0.23, 0.27, 0)
      // Upper arm
      const upper = new Mesh(new CylinderGeometry(0.049, 0.045, 0.28, 8), suit)
      upper.position.set(sign * 0.245, 0.13, 0)
      upper.rotation.z = sign * 0.20
      g.add(upper)
      // Lower arm
      const lower = new Mesh(new CylinderGeometry(0.042, 0.046, 0.25, 8), suit)
      lower.position.set(sign * 0.32, -0.10, 0)
      lower.rotation.z = sign * 0.32
      g.add(lower)
      // Hand
      add(new BoxGeometry(0.068, 0.054, 0.088), glove, sign * 0.37, -0.24, 0)
    }

    // Legs
    for (const sx of [-1, 1] as const) {
      const sign = sx
      add(new BoxGeometry(0.14, 0.33, 0.18), suit,   sign * 0.095, -0.28, 0)
      add(new BoxGeometry(0.12, 0.28, 0.16), suit,   sign * 0.095, -0.58, 0)
      add(new BoxGeometry(0.13, 0.07, 0.20), helmet, sign * 0.095, -0.77, 0.02)
    }

    return g
  }

  /** Called every frame in WALKING mode. fwd = W/S axis, right = A/D axis */
  move(fwd: number, right: number, dt: number): void {
    const dx =  right * CHAR_SPEED * dt
    const dz = -fwd   * CHAR_SPEED * dt  // W presses toward -Z (helm)

    this.position.x += dx
    this.position.z += dz
    this.resolveCollisions()
    this.mesh.position.copy(this.position)

    if (Math.abs(dx) > 0.0005 || Math.abs(dz) > 0.0005) {
      this.mesh.rotation.y = Math.atan2(dx, dz)
    }
  }

  private resolveCollisions(): void {
    const r = CHAR_RADIUS
    for (const box of COLLISION_BOXES) {
      const cx = Math.max(box.minX, Math.min(this.position.x, box.maxX))
      const cz = Math.max(box.minZ, Math.min(this.position.z, box.maxZ))
      const dx = this.position.x - cx
      const dz = this.position.z - cz
      const dist2 = dx * dx + dz * dz
      if (dist2 < r * r) {
        const dist = Math.sqrt(dist2)
        if (dist < 0.001) { this.position.z += r; continue }
        this.position.x += (dx / dist) * (r - dist)
        this.position.z += (dz / dist) * (r - dist)
      }
    }
    // room wall clamp
    this.position.x = Math.max(ROOM.leftX  + r, Math.min(ROOM.rightX - r, this.position.x))
    this.position.z = Math.max(ROOM.frontZ + r, Math.min(ROOM.backZ   - r, this.position.z))
  }

  /** Snap character to helm seat when entering PILOTING mode. */
  placeAtHelm(): void {
    this.position.set(0, CHAR_CENTER_Y, HELM_SEAT_Z + 0.12)
    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = Math.PI  // face helm (-Z)
  }

  isNearHelm(): boolean {
    return this.position.z < 1.8 && Math.abs(this.position.x) < 1.2
  }
}
