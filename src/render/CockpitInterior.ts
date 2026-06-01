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
  private yokeYaw      = 0
  private yokePitch    = 0
  private throttleGrab = 0   // 0=hand on yoke, 1=hand on throttle lever
  private leftArm!:  Object3D
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
    const frame    = new MeshStandardMaterial({ color: 0x0c0c18, metalness: 0.6, roughness: 0.65 })
    const accent   = new MeshStandardMaterial({ color: 0x141424, metalness: 0.5, roughness: 0.7 })
    const glowMat  = new MeshStandardMaterial({ color: 0x001122, emissive: 0x002244, emissiveIntensity: 0.8 })

    const bar = (w: number, h: number, d: number, x: number, y: number, z: number, m = frame) => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z)
      this.group.add(mesh)
    }

    // ── Oval/arched windshield (matches wide cockpit room window) ────────────
    bar(3.2, 0.07, 0.07,  0,   -0.32, -1.0)   // lower sill
    bar(0.07, 0.70, 0.07, -1.45, -0.01, -1.0) // left pillar
    bar(0.07, 0.70, 0.07,  1.45, -0.01, -1.0) // right pillar
    // No flat top beam — arch replaces it

    // Arch: 6 segments forming an ellipse from x=-1.45 to x=1.45, peaking at y=0.72
    const aN = 8, aW = 1.45, aH = 0.72, aBaseY = 0.32
    for (let i = 0; i < aN; i++) {
      const t0 = (i / aN) * Math.PI, t1 = ((i + 1) / aN) * Math.PI
      const x0 = -aW * Math.cos(t0), y0 = aBaseY + aH * Math.sin(t0)
      const x1 = -aW * Math.cos(t1), y1 = aBaseY + aH * Math.sin(t1)
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2
      const segLen = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)
      const mesh = new Mesh(new BoxGeometry(segLen + 0.01, 0.072, 0.065), frame)
      mesh.position.set(mx, my, -1.0)
      mesh.rotation.z = Math.atan2(y1 - y0, x1 - x0)
      this.group.add(mesh)

      // Arch glow
      const ag = new Mesh(new BoxGeometry(segLen, 0.020, 0.04), glowMat)
      ag.position.set(mx, my, -0.965)
      ag.rotation.z = Math.atan2(y1 - y0, x1 - x0)
      this.group.add(ag)
    }

    // Glow strips on sill and sides
    bar(3.0, 0.022, 0.04, 0,  -0.295, -0.965, glowMat)   // bottom glow
    for (const sx of [-1, 1] as const) {
      const sg = new Mesh(new BoxGeometry(0.020, 0.65, 0.04), glowMat)
      sg.position.set(sx * 1.44, -0.01, -0.965)
      this.group.add(sg)
    }

    // ── Overhead console (adds fighter-jet cockpit feel) ──────────────────
    bar(3.2, 0.13, 1.55, 0,  0.72, -0.28, accent)   // overhead structure
    bar(2.8, 0.06, 1.20, 0,  0.66, -0.30, frame)     // overhead trim
    // Overhead instrument strip (glowing)
    bar(2.4, 0.055, 0.90, 0, 0.64, -0.34, glowMat)

    // Overhead buttons (5 toggles, visible from pilot seat)
    const btnMats = [0x00ff55, 0xffaa00, 0x0088ff, 0xff4400, 0x00ccff].map(c =>
      new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.7, roughness: 0.4 }),
    )
    btnMats.forEach((bm, i) => {
      const btn = new Mesh(new BoxGeometry(0.040, 0.030, 0.025), bm)
      btn.position.set(-0.20 + i * 0.10, 0.618, -0.52)
      this.group.add(btn)
    })

    // ── Side walls (cockpit surround) ─────────────────────────────────────
    for (const sx of [-1, 1] as const) {
      // Vertical glow strip on inner wall edge
      const vGlow = new Mesh(new BoxGeometry(0.018, 1.1, 0.04), glowMat)
      vGlow.position.set(sx * 1.41, 0.08, -0.22)
      this.group.add(vGlow)
    }
  }

  private buildDashboard(): void {
    const consMat   = new MeshStandardMaterial({ color: 0x0b0b18, metalness: 0.60, roughness: 0.62 })
    const panelMat  = new MeshStandardMaterial({ color: 0x0f0f1e, metalness: 0.40, roughness: 0.74 })
    const mfdGlow   = new MeshStandardMaterial({ color: 0x001530, emissive: 0x001530, emissiveIntensity: 1.05 })
    const borderGlow = new MeshStandardMaterial({ color: 0x002244, emissive: 0x0055bb, emissiveIntensity: 1.25 })
    const subGlow   = new MeshStandardMaterial({ color: 0x001222, emissive: 0x001222, emissiveIntensity: 0.75 })
    const statusMat = new MeshStandardMaterial({ color: 0x001a33, emissive: 0x003366, emissiveIntensity: 0.85 })

    // ── Main console base — WIDE (5 m) + DEEP (1.4 m) ─────────────────────
    const base = new Mesh(new BoxGeometry(5.0, 0.44, 1.40), consMat)
    base.position.set(0, -0.62, -0.80)
    this.group.add(base)

    // Angled top surface (multi-tier, sweeping back like submarine control room)
    const tier1 = new Mesh(new BoxGeometry(4.8, 0.04, 0.60), panelMat)
    tier1.position.set(0, -0.38, -0.52)
    tier1.rotation.x = -0.30
    this.group.add(tier1)

    const tier2 = new Mesh(new BoxGeometry(4.6, 0.04, 0.58), panelMat)
    tier2.position.set(0, -0.16, -0.72)
    tier2.rotation.x = -0.55
    this.group.add(tier2)

    // Upper vertical panel — lowered so top edge stays below camera eye (y=0.22)
    const tier3 = new Mesh(new BoxGeometry(4.0, 0.04, 0.45), panelMat)
    tier3.position.set(0, -0.02, -0.86)
    tier3.rotation.x = -0.82
    this.group.add(tier3)

    // Upper console lip edge
    const lip = new Mesh(new BoxGeometry(4.9, 0.058, 0.22),
      new MeshStandardMaterial({ color: 0x161628, metalness: 0.55, roughness: 0.62 }))
    lip.position.set(0, -0.40, -0.42)
    lip.rotation.x = -0.28
    this.group.add(lip)

    // ── PRIMARY holographic MFD — wide cinematic display ──────────────────
    const mainMFD = new Mesh(new BoxGeometry(2.20, 0.46, 0.022), mfdGlow)
    mainMFD.position.set(0, -0.22, -0.60)
    mainMFD.rotation.x = -0.38
    this.group.add(mainMFD)

    for (const [bw, bh, bx, by] of [
      [2.20, 0.018,  0,      0.24],
      [2.20, 0.018,  0,     -0.24],
      [0.018, 0.46,  1.11,   0  ],
      [0.018, 0.46, -1.11,   0  ],
    ] as [number,number,number,number][]) {
      const b = new Mesh(new BoxGeometry(bw, bh, 0.026), borderGlow)
      b.position.set(bx, by + (-0.22), -0.596)
      b.rotation.x = -0.38
      this.group.add(b)
    }

    // ── Side sub-displays (larger) ─────────────────────────────────────────
    for (const sx of [-1, 1] as const) {
      const sub = new Mesh(new BoxGeometry(0.64, 0.36, 0.022), subGlow)
      sub.position.set(sx * 1.45, -0.22, -0.58)
      sub.rotation.x = -0.38
      this.group.add(sub)

      const sbMat = new MeshStandardMaterial({ color: 0x002233, emissive: 0x003366, emissiveIntensity: 0.95 })
      for (const [bw, bh, bx, by] of [
        [0.64, 0.015,  0,     0.18],
        [0.64, 0.015,  0,    -0.18],
        [0.015, 0.36,  0.32,  0  ],
        [0.015, 0.36, -0.32,  0  ],
      ] as [number,number,number,number][]) {
        const b = new Mesh(new BoxGeometry(bw, bh, 0.024), sbMat)
        b.position.set(sx * 1.45 + bx, by + (-0.22), -0.568)
        b.rotation.x = -0.38
        this.group.add(b)
      }
    }

    // ── Upper panel screens (tall vertical displays, 3D depth) ────────────
    for (const sx of [-1, 1] as const) {
      const vDisp = new Mesh(new BoxGeometry(0.46, 0.58, 0.020),
        new MeshStandardMaterial({ color: 0x000e1e, emissive: 0x001433, emissiveIntensity: 0.75 }))
      vDisp.position.set(sx * 1.52, 0.08, -0.82)
      vDisp.rotation.x = -0.82
      this.group.add(vDisp)
    }

    // ── LED status row ─────────────────────────────────────────────────────
    ;([0x00ff55, 0x00ff55, 0xffaa00, 0x00ccff, 0x00ccff, 0xff4400, 0xffaa00, 0x00ff88] as number[])
      .forEach((c, i) => {
        const led = new Mesh(new BoxGeometry(0.028, 0.028, 0.018),
          new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.88 }))
        led.position.set(-0.245 + i * 0.07, -0.05, -0.42)
        this.group.add(led)
      })

    // ── Side arm consoles (larger, more cinematic) ─────────────────────────
    for (const sx of [-1, 1] as const) {
      const arm = new Mesh(new BoxGeometry(0.48, 0.62, 0.56), consMat)
      arm.position.set(sx * 1.38, -0.40, -0.52)
      this.group.add(arm)

      const armTop = new Mesh(new BoxGeometry(0.44, 0.04, 0.50), panelMat)
      armTop.position.set(sx * 1.38, -0.16, -0.52)
      armTop.rotation.x = -0.18
      this.group.add(armTop)

      // 6 buttons (2 × 3 grid)
      const btnCols = [0x00ccff, 0x00ff88, 0xff8800, 0xcc0044, 0x8800ff, 0xffcc00]
      btnCols.forEach((c, i) => {
        const btn = new Mesh(new BoxGeometry(0.042, 0.024, 0.042),
          new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.65 }))
        btn.position.set(
          sx * (1.38 + (i % 2 - 0.5) * 0.12),
          -0.16 - Math.floor(i / 2) * 0.058,
          -0.45,
        )
        this.group.add(btn)
      })
    }

    // ── Wide status glow strip ─────────────────────────────────────────────
    const strip = new Mesh(new BoxGeometry(4.8, 0.018, 0.06), statusMat)
    strip.position.set(0, -0.445, -0.40)
    this.group.add(strip)
  }

  private buildYokeAndArms(): void {
    this.yokeGroup.position.set(0, -0.26, -0.46)

    const metalDark = new MeshStandardMaterial({ color: 0x1a1a26, metalness: 0.90, roughness: 0.18 })
    const gripMat   = new MeshStandardMaterial({ color: 0x0a0a12, metalness: 0.12, roughness: 0.88 })
    const accentMat = new MeshStandardMaterial({ color: 0x1c2a3e, metalness: 0.75, roughness: 0.30 })

    // ── Base platform ─────────────────────────────────────────────────────
    const base = new Mesh(new CylinderGeometry(0.085, 0.10, 0.028, 14), metalDark)
    base.position.y = -0.075
    this.yokeGroup.add(base)

    // ── Tapered column ────────────────────────────────────────────────────
    const col = new Mesh(new CylinderGeometry(0.018, 0.028, 0.38, 12), metalDark)
    col.position.y = 0.07
    this.yokeGroup.add(col)

    // Column guard ring
    const ring = new Mesh(new CylinderGeometry(0.042, 0.042, 0.022, 14), accentMat)
    ring.position.y = 0.00
    this.yokeGroup.add(ring)

    // ── Swept yoke crossbar (angled, not a straight T-bar) ────────────────
    const hubY = 0.215
    const hub = new Mesh(new CylinderGeometry(0.036, 0.036, 0.025, 12), metalDark)
    hub.position.y = hubY
    this.yokeGroup.add(hub)

    // Cross arms (swept back slightly — spaceship HOTAS style)
    const armBar = new Mesh(new CylinderGeometry(0.013, 0.015, 0.46, 10), metalDark)
    armBar.rotation.z = Math.PI / 2
    armBar.position.set(0, hubY + 0.005, 0.015)
    this.yokeGroup.add(armBar)

    // ── Grip assemblies (ergonomic, fighter-jet style) ────────────────────
    const buildGrip = (sign: number): void => {
      const gx = sign * 0.225

      // Main grip body
      const grip = new Mesh(new BoxGeometry(0.052, 0.155, 0.058), gripMat)
      grip.position.set(gx, hubY + 0.005, 0.003)
      this.yokeGroup.add(grip)

      // Upper thumb rest (slightly forward-tilted)
      const thumb = new Mesh(new BoxGeometry(0.046, 0.048, 0.052), gripMat)
      thumb.position.set(gx, hubY + 0.090, -0.006)
      this.yokeGroup.add(thumb)

      // Trigger (forward-facing)
      const trig = new Mesh(new BoxGeometry(0.025, 0.038, 0.020), gripMat)
      trig.position.set(gx, hubY - 0.010, -0.036)
      this.yokeGroup.add(trig)

      // Top action button (fire / boost)
      const fireBtn = new Mesh(
        new SphereGeometry(0.013, 8, 5),
        new MeshStandardMaterial({ color: 0x1a3355, emissive: 0x0a2244, emissiveIntensity: 0.65 }),
      )
      fireBtn.position.set(gx, hubY + 0.120, -0.026)
      this.yokeGroup.add(fireBtn)

      // Side mode button
      const modeBtn = new Mesh(
        new BoxGeometry(0.022, 0.016, 0.022),
        new MeshStandardMaterial({ color: 0x002244, emissive: 0x0044aa, emissiveIntensity: 0.70 }),
      )
      modeBtn.position.set(gx + sign * (-0.028), hubY + 0.040, -0.028)
      this.yokeGroup.add(modeBtn)
    }
    buildGrip(-1)
    buildGrip(1)

    // Status indicator LEDs on hub
    const ledCols = [0x00ff88, 0xffaa00, 0xff4400]
    ledCols.forEach((c, i) => {
      const led = new Mesh(
        new BoxGeometry(0.010, 0.010, 0.009),
        new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9 }),
      )
      led.position.set(-0.020 + i * 0.020, hubY + 0.002, -0.038)
      this.yokeGroup.add(led)
    })

    // Arms (position updated to match new grip positions)
    this.leftArm  = this.buildArm(-0.225, hubY + 0.005, true)
    this.rightArm = this.buildArm( 0.225, hubY + 0.005, false)
    this.yokeGroup.add(this.leftArm)
    this.yokeGroup.add(this.rightArm)

    this.group.add(this.yokeGroup)
  }

  private buildArm(handleX: number, handleY: number, isLeft: boolean): Object3D {
    const suitColor  = 0x252d3a
    const gloveColor = 0x141c28
    const cuffColor  = 0x1a2030

    const g    = new Group()
    const sign = isLeft ? -1 : 1

    // Forearm: starts off-screen bottom, ends at grip
    const armStart = new Vector3(sign * 0.52, -0.54, 0.44)
    const wrist    = new Vector3(handleX, handleY - 0.040, 0.020)

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
    this.leverGroup.position.set(-1.02, -0.22, -0.58)

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

  /**
   * @param throttling  true when Space/W is held — triggers throttle-grab arm motion
   */
  update(raw: RawInput, ship: ShipState, dt: number, throttling = false): void {
    // ── Yoke animation ─────────────────────────────────────────────────────
    const MAX_YAW   = Math.PI / 9
    const MAX_PITCH = Math.PI / 10
    this.yokeYaw   = lerp(this.yokeYaw,   raw.yaw   * MAX_YAW,   dt * 10)
    this.yokePitch = lerp(this.yokePitch, raw.pitch  * MAX_PITCH, dt * 10)
    this.yokeGroup.rotation.z = this.yokeYaw
    this.yokeGroup.rotation.x = this.yokePitch

    // ── Throttle lever tilt ────────────────────────────────────────────────
    const leverTarget = (ship.throttle / 5) * 0.38
    const leverArm    = this.leverGroup.getObjectByName('leverArm')
    const leverHandle = this.leverGroup.getObjectByName('leverHandle')
    if (leverArm && leverHandle) {
      const cur = lerp(leverArm.rotation.x, leverTarget, dt * 6)
      leverArm.rotation.x = cur
      leverHandle.rotation.x = cur
    }

    // ── Left arm: throttle grab motion ────────────────────────────────────
    // throttleGrab=0 → arm stays on yoke (default)
    // throttleGrab=1 → arm extends toward the throttle lever (x=-0.95, z=-0.56)
    // The leverGroup is at (-0.95, -0.20, -0.56) in cockpit space.
    // yokeGroup is at (0, -0.26, -0.46). Lever in yoke-local coords ≈ (-0.95, 0.06, -0.10)
    this.throttleGrab = lerp(this.throttleGrab, throttling ? 1 : 0, dt * 8)

    if (this.leftArm) {
      const g = this.throttleGrab
      this.leftArm.position.set(-0.795 * g, 0, -0.12 * g)
      this.leftArm.rotation.x = -0.4 * g
    }
  }

  /** Show pilot arms only in 1st-person PILOTING mode */
  setArmsVisible(visible: boolean): void {
    this.leftArm.visible  = visible
    this.rightArm.visible = visible
  }
}
