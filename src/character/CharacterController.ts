import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import { ROOM, HELM_SEAT_Z, COLLISION_BOXES } from '../render/CockpitRoom.js'

export const CHAR_HEIGHT    = 1.58
export const CHAR_SPEED     = 4.0
export const CHAR_SPEED_RUN = 6.5
export const CHAR_FOOT_Y    = ROOM.floorY
export const CHAR_CENTER_Y  = CHAR_FOOT_Y + CHAR_HEIGHT / 2

const CHAR_RADIUS = 0.38
const GRAVITY     = 14.0
const JUMP_VEL    = 4.8

export class CharacterController {
  readonly mesh: Group
  readonly position: Vector3
  facingYaw = Math.PI

  private walkCycle  = 0
  private velY       = 0
  private isGrounded = true
  isCrouching = false

  private readonly legL: Group
  private readonly legR: Group
  private readonly armL: Group
  private readonly armR: Group

  constructor() {
    this.position = new Vector3(0, CHAR_CENTER_Y, 8.0)
    const { mesh, legL, legR, armL, armR } = this.buildMesh()
    this.mesh = mesh
    this.legL = legL
    this.legR = legR
    this.armL = armL
    this.armR = armR
    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = Math.PI
  }

  private buildMesh(): { mesh: Group; legL: Group; legR: Group; armL: Group; armR: Group } {
    const g      = new Group()
    const suit   = new MeshStandardMaterial({ color: 0x252d3a, roughness: 0.82, metalness: 0.18 })
    const helmet = new MeshStandardMaterial({ color: 0x1a2230, roughness: 0.65, metalness: 0.45 })
    const visor  = new MeshStandardMaterial({ color: 0x334466, roughness: 0.15, metalness: 0.85, emissive: 0x112233, emissiveIntensity: 0.25 })
    const glove  = new MeshStandardMaterial({ color: 0x141c28, roughness: 0.80 })

    const box = (w: number, h: number, d: number, m: MeshStandardMaterial, x: number, y: number, z: number, parent: Group = g): Mesh => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z)
      parent.add(mesh)
      return mesh
    }

    // ── Torso, head, chest pack ───────────────────────────────────────────
    box(0.36, 0.46, 0.20, suit,   0,  0.10, 0)
    box(0.18, 0.14, 0.04, helmet, 0,  0.10, -0.12)
    box(0.24, 0.24, 0.22, helmet, 0,  0.50, 0)
    box(0.16, 0.10, 0.025, visor, 0,  0.51, -0.115)

    // ── Arm groups (pivot at shoulder) ────────────────────────────────────
    const buildArm = (sign: number): Group => {
      const ag = new Group()
      ag.position.set(sign * 0.23, 0.27, 0)  // shoulder pivot

      // Shoulder pad at pivot
      box(0.10, 0.09, 0.14, suit, 0, 0, 0, ag)

      // Upper arm (cylinder, hangs down and outward)
      const ua = new Mesh(new CylinderGeometry(0.049, 0.045, 0.28, 8), suit)
      ua.position.set(sign * 0.015, -0.14, 0)
      ua.rotation.z = sign * 0.20
      ag.add(ua)

      // Lower arm
      const la = new Mesh(new CylinderGeometry(0.042, 0.046, 0.25, 8), suit)
      la.position.set(sign * 0.085, -0.37, 0)
      la.rotation.z = sign * 0.12
      ag.add(la)

      // Hand
      box(0.068, 0.054, 0.088, glove, sign * 0.14, -0.51, 0, ag)

      g.add(ag)
      return ag
    }
    const armL = buildArm(-1)
    const armR = buildArm(1)

    // ── Leg groups (pivot at hip, y = -0.10) ──────────────────────────────
    const buildLeg = (sign: number): Group => {
      const lg = new Group()
      lg.position.set(sign * 0.095, -0.10, 0)  // hip pivot

      // Positions below are relative to hip (y=-0.10 from char center)
      box(0.14, 0.33, 0.18, suit,   0, -0.18, 0,    lg)  // thigh  (abs -0.28)
      box(0.12, 0.28, 0.16, suit,   0, -0.48, 0,    lg)  // shin   (abs -0.58)
      box(0.13, 0.07, 0.20, helmet, 0, -0.67, 0.02, lg)  // foot   (abs -0.77)

      g.add(lg)
      return lg
    }
    const legL = buildLeg(-1)
    const legR = buildLeg(1)

    return { mesh: g, legL, legR, armL, armR }
  }

  /** Camera-relative movement: W/S in camera-forward dir, A/D in camera-right dir */
  move(fwd: number, right: number, dt: number, isRunning = false, camYaw = Math.PI): void {
    const speed  = this.isCrouching ? CHAR_SPEED * 0.4
                 : isRunning        ? CHAR_SPEED_RUN
                 :                    CHAR_SPEED
    const moving = Math.abs(fwd) > 0.01 || Math.abs(right) > 0.01

    // Forward and right vectors from camera yaw
    const fwdX  =  Math.sin(camYaw)
    const fwdZ  =  Math.cos(camYaw)
    const rightX = -Math.cos(camYaw)
    const rightZ =  Math.sin(camYaw)

    this.position.x += (fwd * fwdX + right * rightX) * speed * dt
    this.position.z += (fwd * fwdZ + right * rightZ) * speed * dt
    this.resolveCollisions()

    // Vertical physics
    if (!this.isGrounded) this.velY -= GRAVITY * dt
    this.position.y += this.velY * dt
    if (this.position.y <= CHAR_CENTER_Y) {
      this.position.y = CHAR_CENTER_Y
      this.velY       = 0
      this.isGrounded = true
    }

    const crouchOff = this.isCrouching ? -0.35 : 0
    this.mesh.position.set(this.position.x, this.position.y + crouchOff, this.position.z)

    // Facing direction (toward movement in world space)
    const dx = (fwd * fwdX + right * rightX) * speed * dt
    const dz = (fwd * fwdZ + right * rightZ) * speed * dt
    if (Math.abs(dx) > 0.0005 || Math.abs(dz) > 0.0005) {
      this.facingYaw = Math.atan2(dx, dz)
      this.mesh.rotation.y = this.facingYaw
    }

    // ── Walk animation ────────────────────────────────────────────────────
    if (moving && !this.isCrouching) {
      this.walkCycle += (isRunning ? 8 : 5.5) * dt
    }

    const legAmp = moving && !this.isCrouching ? (isRunning ? 0.52 : 0.38) : 0
    const armAmp = legAmp * 0.40
    const swing  = Math.sin(this.walkCycle)

    // Decay to zero when stopped
    const decay = Math.min(1, dt * 10)
    this.legL.rotation.x += (-swing * legAmp - this.legL.rotation.x) * (moving ? 1 : decay)
    this.legR.rotation.x += ( swing * legAmp - this.legR.rotation.x) * (moving ? 1 : decay)
    this.armL.rotation.x += ( swing * armAmp - this.armL.rotation.x) * (moving ? 1 : decay)
    this.armR.rotation.x += (-swing * armAmp - this.armR.rotation.x) * (moving ? 1 : decay)

    // Subtle body bob (only when walking/running)
    if (moving && !this.isCrouching) {
      this.mesh.position.y += Math.abs(Math.sin(this.walkCycle * 2)) * 0.018
    }
  }

  jump(): void {
    if (this.isGrounded && !this.isCrouching) {
      this.velY       = JUMP_VEL
      this.isGrounded = false
    }
  }

  toggleCrouch(): void {
    if (this.isGrounded) this.isCrouching = !this.isCrouching
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
    this.position.x = Math.max(ROOM.leftX  + r, Math.min(ROOM.rightX - r, this.position.x))
    this.position.z = Math.max(ROOM.frontZ + r, Math.min(ROOM.backZ   - r, this.position.z))
  }

  placeAtHelm(): void {
    this.position.set(0, CHAR_CENTER_Y, HELM_SEAT_Z + 0.12)
    this.isCrouching = false
    this.velY        = 0
    this.isGrounded  = true
    this.facingYaw   = Math.PI
    this.mesh.position.copy(this.position)
    this.mesh.rotation.y = Math.PI
    // Reset limb rotations
    this.legL.rotation.x = 0
    this.legR.rotation.x = 0
    this.armL.rotation.x = 0
    this.armR.rotation.x = 0
  }

  isNearHelm(): boolean {
    return this.position.z < 1.8 && Math.abs(this.position.x) < 1.2
  }
}
