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
    const FLOOR_Y = -1.1   // matches ROOM.floorY in CockpitRoom

    const consoleMat = new MeshStandardMaterial({ color: 0x0d1018, metalness: 0.62, roughness: 0.52 })
    const trimMat    = new MeshStandardMaterial({ color: 0x1c2234, metalness: 0.74, roughness: 0.26 })
    const panelMat   = new MeshStandardMaterial({ color: 0x090e14, metalness: 0.28, roughness: 0.78 })
    const dispMat    = new MeshStandardMaterial({ color: 0x001030, metalness: 0.05, roughness: 0.20, emissive: 0x002266, emissiveIntensity: 0.80 })
    const glowEdge   = new MeshStandardMaterial({ color: 0x001540, metalness: 0.05, roughness: 0.20, emissive: 0x0033aa, emissiveIntensity: 0.90 })

    // yokeGroup is at (0, -0.26, -0.46); base disc at y = -0.335
    const consoleTopY = -0.28
    const consoleH    = consoleTopY - FLOOR_Y    // 0.82
    const consoleCY   = FLOOR_Y + consoleH / 2   // -0.69

    // ── Center console pedestal ────────────────────────────────────────────
    const body = new Mesh(new BoxGeometry(0.68, consoleH, 0.56), consoleMat)
    body.position.set(0, consoleCY, -0.62)
    this.group.add(body)

    // Top trim cap
    const topCap = new Mesh(new BoxGeometry(0.72, 0.032, 0.60), trimMat)
    topCap.position.set(0, consoleTopY + 0.016, -0.62)
    this.group.add(topCap)

    // Foot plate on floor
    const foot = new Mesh(new BoxGeometry(0.74, 0.024, 0.60), trimMat)
    foot.position.set(0, FLOOR_Y + 0.012, -0.62)
    this.group.add(foot)

    // Yoke mounting collar
    const collar = new Mesh(new CylinderGeometry(0.118, 0.112, 0.042, 14), trimMat)
    collar.position.set(0, consoleTopY + 0.021, -0.46)
    this.group.add(collar)
    const collarInner = new Mesh(new CylinderGeometry(0.092, 0.092, 0.046, 14),
      new MeshStandardMaterial({ color: 0x001540, metalness: 0.05, roughness: 0.20, emissive: 0x003388, emissiveIntensity: 0.75 }))
    collarInner.position.set(0, consoleTopY + 0.023, -0.46)
    this.group.add(collarInner)

    // Front face inset panel
    const frontPanel = new Mesh(new BoxGeometry(0.56, consoleH * 0.72, 0.022), panelMat)
    frontPanel.position.set(0, consoleCY + 0.05, -0.335)
    this.group.add(frontPanel)

    // Three mini display screens on front face
    for (let i = -1; i <= 1; i++) {
      const disp = new Mesh(new BoxGeometry(0.13, 0.085, 0.018), dispMat)
      disp.position.set(i * 0.17, FLOOR_Y + 0.52, -0.326)
      this.group.add(disp)
    }

    // Status LEDs column
    const ledColors = [0x00ff44, 0x0088ff, 0xffaa00]
    ledColors.forEach((c, i) => {
      const led = new Mesh(new BoxGeometry(0.020, 0.020, 0.013),
        new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.95 }))
      led.position.set(0.27, FLOOR_Y + 0.36 + i * 0.08, -0.327)
      this.group.add(led)
    })

    // Glow strip on top surface
    const topGlow = new Mesh(new BoxGeometry(0.58, 0.009, 0.44), glowEdge)
    topGlow.position.set(0, consoleTopY + 0.004, -0.68)
    this.group.add(topGlow)

    // ── Left side console (throttle pedestal) ─────────────────────────────
    // leverGroup is at (-1.02, -0.22, -0.58)
    const sideTopY  = -0.20
    const sideH     = sideTopY - FLOOR_Y   // 0.90
    const sideCY    = FLOOR_Y + sideH / 2  // -0.65

    const sideCon = new Mesh(new BoxGeometry(0.32, sideH, 0.50), consoleMat)
    sideCon.position.set(-1.02, sideCY, -0.62)
    this.group.add(sideCon)

    const sideTop = new Mesh(new BoxGeometry(0.34, 0.028, 0.52), trimMat)
    sideTop.position.set(-1.02, sideTopY + 0.014, -0.62)
    this.group.add(sideTop)

    const sideFoot = new Mesh(new BoxGeometry(0.34, 0.022, 0.52), trimMat)
    sideFoot.position.set(-1.02, FLOOR_Y + 0.011, -0.62)
    this.group.add(sideFoot)

    // Armrest bridge connecting center to side console
    const bridge = new Mesh(new BoxGeometry(0.60, 0.048, 0.22), consoleMat)
    bridge.position.set(-0.62, sideTopY + 0.024, -0.52)
    this.group.add(bridge)
    const bridgeGlow = new Mesh(new BoxGeometry(0.58, 0.008, 0.20), glowEdge)
    bridgeGlow.position.set(-0.62, sideTopY + 0.050, -0.52)
    this.group.add(bridgeGlow)
  }

  private buildDashboard(): void {
    // Retained for structure; main dashboard is now part of buildStructure console
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
