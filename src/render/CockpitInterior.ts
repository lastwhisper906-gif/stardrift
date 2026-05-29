import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three'
import type { RawInput } from '../input/InputTypes.js'
import type { ShipState } from '../state/GameState.js'

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(t, 1)
}

function box(w: number, h: number, d: number, color: number, emissive?: number): Mesh {
  return new Mesh(
    new BoxGeometry(w, h, d),
    new MeshStandardMaterial({
      color,
      emissive: emissive ?? 0,
      emissiveIntensity: emissive ? 0.45 : 0,
      metalness: 0.3,
      roughness: 0.7,
    }),
  )
}

function cylinder(rt: number, rb: number, h: number, color: number, metalness = 0.6): Mesh {
  return new Mesh(
    new CylinderGeometry(rt, rb, h, 10),
    new MeshStandardMaterial({ color, metalness, roughness: 0.3 }),
  )
}

function armSegment(start: Vector3, end: Vector3, rt: number, rb: number, color: number): Mesh {
  const dir = end.clone().sub(start)
  const len = dir.length()
  const mesh = new Mesh(
    new CylinderGeometry(rt, rb, len, 10),
    new MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.85 }),
  )
  mesh.position.copy(start).lerp(end, 0.5)
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize())
  return mesh
}

export class CockpitInterior {
  readonly group: Group
  private readonly yokeGroup: Group
  private readonly leverGroup: Group
  private yokeYaw = 0
  private yokePitch = 0
  private leftArm!: Object3D
  private rightArm!: Object3D

  constructor() {
    this.group = new Group()
    this.yokeGroup = new Group()
    this.leverGroup = new Group()

    this.buildStructure()
    this.buildDashboard()
    this.buildYokeAndArms()
    this.buildThrottleLever()
  }

  private buildStructure(): void {
    const frame = new MeshStandardMaterial({ color: 0x0e0e16, metalness: 0.4, roughness: 0.8 })

    const addBar = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new Mesh(new BoxGeometry(w, h, d), frame)
      m.position.set(x, y, z)
      this.group.add(m)
    }

    // ── Windshield frame at z = -1.0 ──────────────────────────────────────
    addBar(2.4,  0.12, 0.09,  0,    0.60, -1.0)   // top beam
    addBar(2.4,  0.10, 0.09,  0,   -0.26, -1.0)   // lower sill
    addBar(0.10, 0.88, 0.09, -1.05, 0.17, -1.0)   // left pillar
    addBar(0.10, 0.88, 0.09,  1.05, 0.17, -1.0)   // right pillar
    addBar(0.06, 0.88, 0.09,  0,    0.17, -1.0)   // center divider

    // ── Ceiling ──────────────────────────────────────────────────────────
    const ceil = new Mesh(new BoxGeometry(2.4, 0.16, 1.5), frame)
    ceil.position.set(0, 0.64, -0.3)
    this.group.add(ceil)

    // ── Side walls ───────────────────────────────────────────────────────
    const leftWall = new Mesh(new BoxGeometry(0.09, 1.4, 1.6), frame)
    leftWall.position.set(-1.1, 0, -0.2)
    this.group.add(leftWall)

    const rightWall = new Mesh(new BoxGeometry(0.09, 1.4, 1.6), frame)
    rightWall.position.set(1.1, 0, -0.2)
    this.group.add(rightWall)
  }

  private buildDashboard(): void {
    // Main slab
    const main = box(2.4, 0.5, 0.8, 0x181824)
    main.position.set(0, -0.51, -0.74)
    this.group.add(main)

    // Angled face
    const face = box(2.2, 0.4, 0.05, 0x20222e)
    face.position.set(0, -0.32, -0.56)
    face.rotation.x = -0.22
    this.group.add(face)

    // Primary MFD (center glow)
    const mfd = box(0.78, 0.24, 0.02, 0x001833, 0x001833)
    mfd.position.set(0, -0.28, -0.54)
    mfd.rotation.x = -0.22
    this.group.add(mfd)

    // Left instrument panel
    const leftMfd = box(0.3, 0.2, 0.02, 0x001122, 0x001122)
    leftMfd.position.set(-0.55, -0.30, -0.53)
    leftMfd.rotation.x = -0.22
    this.group.add(leftMfd)

    // Right instrument panel
    const rightMfd = box(0.3, 0.2, 0.02, 0x001122, 0x001122)
    rightMfd.position.set(0.55, -0.30, -0.53)
    rightMfd.rotation.x = -0.22
    this.group.add(rightMfd)

    // Left console (for throttle)
    const leftConsole = box(0.38, 0.6, 0.42, 0x141420)
    leftConsole.position.set(-0.95, -0.44, -0.51)
    this.group.add(leftConsole)

    // Right console
    const rightConsole = box(0.38, 0.6, 0.42, 0x141420)
    rightConsole.position.set(0.95, -0.44, -0.51)
    this.group.add(rightConsole)

    // Small accent buttons on right console
    for (let i = 0; i < 3; i++) {
      const btn = new Mesh(
        new BoxGeometry(0.06, 0.03, 0.06),
        new MeshStandardMaterial({ color: 0x334466, emissive: 0x223355, emissiveIntensity: 0.4 }),
      )
      btn.position.set(0.95, -0.12 + i * 0.09, -0.44)
      this.group.add(btn)
    }
  }

  private buildYokeAndArms(): void {
    // yokeGroup origin = base of column, in shipGroup local
    this.yokeGroup.position.set(0, -0.26, -0.46)

    const metal = new MeshStandardMaterial({ color: 0x282828, metalness: 0.85, roughness: 0.2 })
    const gripMat = new MeshStandardMaterial({ color: 0x0e0e0e, metalness: 0.1, roughness: 0.9 })

    // Column
    const col = cylinder(0.027, 0.036, 0.44, 0x282828)
    col.position.y = -0.04
    this.yokeGroup.add(col)

    // T-bar
    const tbar = new Mesh(new CylinderGeometry(0.020, 0.020, 0.52, 10), metal)
    tbar.rotation.z = Math.PI / 2
    tbar.position.y = 0.20
    this.yokeGroup.add(tbar)

    // Grips
    const leftGrip = new Mesh(new BoxGeometry(0.052, 0.13, 0.052), gripMat)
    leftGrip.position.set(-0.24, 0.20, 0)
    this.yokeGroup.add(leftGrip)

    const rightGrip = new Mesh(new BoxGeometry(0.052, 0.13, 0.052), gripMat)
    rightGrip.position.set(0.24, 0.20, 0)
    this.yokeGroup.add(rightGrip)

    // Thumb buttons
    const btnMat = new MeshStandardMaterial({ color: 0x1a3355, emissive: 0x0a1a33, emissiveIntensity: 0.5 })
    const lBtn = new Mesh(new SphereGeometry(0.016, 6, 4), btnMat)
    lBtn.position.set(-0.24, 0.26, -0.028)
    this.yokeGroup.add(lBtn)

    const rBtn = new Mesh(new SphereGeometry(0.016, 6, 4), btnMat)
    rBtn.position.set(0.24, 0.26, -0.028)
    this.yokeGroup.add(rBtn)

    // Arms
    this.leftArm  = this.buildArm(-0.24, 0.20, true)
    this.rightArm = this.buildArm( 0.24, 0.20, false)
    this.yokeGroup.add(this.leftArm)
    this.yokeGroup.add(this.rightArm)

    this.group.add(this.yokeGroup)
  }

  private buildArm(handleX: number, handleY: number, isLeft: boolean): Object3D {
    const suitColor = 0x252d3a
    const gloveColor = 0x141c28
    const cuffColor = 0x1a2030

    const g = new Group()
    const sign = isLeft ? -1 : 1

    // Forearm: starts off-screen bottom, ends at grip
    const armStart = new Vector3(sign * 0.50, -0.54, 0.42)
    const wrist = new Vector3(handleX, handleY - 0.045, 0.025)

    const forearm = armSegment(armStart, wrist, 0.040, 0.050, suitColor)
    g.add(forearm)

    // Upper arm hint (just visible at very bottom edge)
    const upperStart = new Vector3(sign * 0.62, -0.82, 0.60)
    const elbow = new Vector3(sign * 0.52, -0.56, 0.44)
    const upper = armSegment(upperStart, elbow, 0.046, 0.056, suitColor)
    g.add(upper)

    // Wrist cuff
    const cuff = cylinder(0.044, 0.044, 0.055, cuffColor, 0.35)
    const cuffDir = wrist.clone().sub(armStart).normalize()
    cuff.position.copy(wrist).add(cuffDir.clone().multiplyScalar(-0.022))
    cuff.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), cuffDir)
    g.add(cuff)

    // Hand (glove)
    const hand = new Mesh(
      new BoxGeometry(0.07, 0.058, 0.10),
      new MeshStandardMaterial({ color: gloveColor, roughness: 0.8 }),
    )
    hand.position.set(handleX, handleY + 0.006, 0.010)
    g.add(hand)

    // Knuckle bumps
    const knuckleMat = new MeshStandardMaterial({ color: 0x0e1520 })
    for (let i = 0; i < 4; i++) {
      const k = new Mesh(new SphereGeometry(0.008, 5, 4), knuckleMat)
      k.position.set(handleX + (i - 1.5) * 0.015, handleY + 0.032, 0.008)
      g.add(k)
    }

    return g
  }

  private buildThrottleLever(): void {
    this.leverGroup.position.set(-0.95, -0.20, -0.56)

    // Guide track
    const track = box(0.055, 0.32, 0.055, 0x0e0e16)
    this.leverGroup.add(track)

    // Lever arm
    const arm = cylinder(0.013, 0.016, 0.26, 0x2a2a38, 0.7)
    arm.position.y = 0.06
    arm.name = 'leverArm'
    this.leverGroup.add(arm)

    // Handle
    const handle = box(0.065, 0.048, 0.065, 0x1a2a44)
    handle.position.y = 0.20
    handle.name = 'leverHandle'
    this.leverGroup.add(handle)

    this.group.add(this.leverGroup)
  }

  update(raw: RawInput, ship: ShipState, dt: number): void {
    // Yoke: smoothly tracks input
    const MAX_YAW   = Math.PI / 9   // ±20°
    const MAX_PITCH = Math.PI / 10  // ±18°
    this.yokeYaw   = lerp(this.yokeYaw,    raw.yaw   * MAX_YAW,   dt * 10)
    this.yokePitch = lerp(this.yokePitch,  raw.pitch  * MAX_PITCH, dt * 10)
    this.yokeGroup.rotation.z = this.yokeYaw
    this.yokeGroup.rotation.x = this.yokePitch

    // Throttle lever: normalized -0.4 to 1.0 → small tilt
    const leverTarget = (ship.throttle / 5) * 0.38
    const leverArm = this.leverGroup.getObjectByName('leverArm')
    const leverHandle = this.leverGroup.getObjectByName('leverHandle')
    if (leverArm && leverHandle) {
      const cur = lerp(leverArm.rotation.x, leverTarget, dt * 6)
      leverArm.rotation.x = cur
      leverHandle.rotation.x = cur
    }
  }

  /** Show pilot arms only in 1st-person PILOTING mode */
  setArmsVisible(visible: boolean): void {
    this.leftArm.visible  = visible
    this.rightArm.visible = visible
  }
}
