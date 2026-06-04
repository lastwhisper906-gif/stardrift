import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'

// Camera-parented tether-attachment animation played when the pilot disembarks
// onto a planet surface. Lasts TETHER_DURATION seconds before auto-hiding.

const TETHER_DURATION = 1.2  // seconds for the full attach animation

function buildArm(): Group {
  const g     = new Group()
  const suit  = new MeshStandardMaterial({ color: 0x3a4a5e, metalness: 0.12, roughness: 0.82, emissive: 0x3a4a5e, emissiveIntensity: 0.18 })
  const glove = new MeshStandardMaterial({ color: 0x243040, metalness: 0.10, roughness: 0.88, emissive: 0x243040, emissiveIntensity: 0.18 })
  const cuffM = new MeshStandardMaterial({ color: 0x2a3448, metalness: 0.38, roughness: 0.55, emissive: 0x2a3448, emissiveIntensity: 0.12 })
  const metal = new MeshStandardMaterial({ color: 0x3a4455, metalness: 0.85, roughness: 0.20 })

  // Forearm
  const forearm = new Mesh(new CylinderGeometry(0.026, 0.034, 0.30, 8), suit)
  forearm.position.set(0, -0.15, 0)
  forearm.rotation.x = 0.3
  g.add(forearm)

  // Wrist cuff
  const cuff = new Mesh(new CylinderGeometry(0.030, 0.030, 0.028, 10), cuffM)
  cuff.position.set(0, 0.02, 0)
  g.add(cuff)

  // Gloved hand
  const hand = new Mesh(new BoxGeometry(0.054, 0.038, 0.078), glove)
  hand.position.set(0, 0.060, 0)
  g.add(hand)

  // Hook shaft (carabiner)
  const hookShaft = new Mesh(new CylinderGeometry(0.007, 0.009, 0.055, 6), metal)
  hookShaft.position.set(0.004, 0.110, 0)
  hookShaft.rotation.z = 0.55
  g.add(hookShaft)

  // Hook curve
  const hookCurve = new Mesh(new CylinderGeometry(0.005, 0.005, 0.038, 6), metal)
  hookCurve.position.set(0.026, 0.118, 0)
  hookCurve.rotation.z = 1.15
  g.add(hookCurve)

  return g
}

export class TetherView {
  readonly group: Group
  private readonly arm:       Group
  private readonly flashMesh: Mesh
  private progress = 0
  private _active  = false

  constructor() {
    this.group = new Group()
    this.group.visible = false

    this.arm = buildArm()
    this.group.add(this.arm)

    // Small glint flash at the hook-click moment
    this.flashMesh = new Mesh(
      new BoxGeometry(0.018, 0.018, 0.018),
      new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0 }),
    )
    this.flashMesh.position.set(0.10, -0.05, -0.58)
    this.group.add(this.flashMesh)
  }

  /** Call once to start the animation. */
  trigger(): void {
    this.progress = 0
    this._active  = true
    this.group.visible = true
  }

  /** Returns true once the animation has finished. */
  get isComplete(): boolean { return !this._active }

  update(dt: number): void {
    if (!this._active) return
    this.progress = Math.min(1, this.progress + dt / TETHER_DURATION)
    const p = this.progress

    // Arm extend progress: ramps up to 1 by p=0.45, holds, then retracts
    let extend: number
    if      (p < 0.45) extend = p / 0.45
    else if (p < 0.55) extend = 1.0
    else               extend = 1.0 - (p - 0.55) / 0.45

    // Hook-click flash peaks at p=0.50
    const flashI = Math.max(0, 1 - Math.abs(p - 0.50) * 22) * 4.0
    ;(this.flashMesh.material as MeshStandardMaterial).emissiveIntensity = flashI

    // Camera-local arm pose: rest = lower-right, extended = forward-left
    const rx = 0.28  + (0.10 - 0.28)  * extend
    const ry = -0.42 + (-0.10 - (-0.42)) * extend
    const rz = -0.28 + (-0.58 - (-0.28)) * extend
    this.arm.position.set(rx, ry, rz)
    this.arm.rotation.x = -0.18 + (-0.55 - (-0.18)) * extend
    this.arm.rotation.y = -0.30 + (0.12 - (-0.30))  * extend

    if (this.progress >= 1) {
      this._active = false
      this.group.visible = false
    }
  }
}
