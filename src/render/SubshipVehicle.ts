import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three'
import type { RawInput } from '../input/InputTypes.js'

function mat(
  color: number, metalness = 0.55, roughness = 0.45, emissive = 0, ei = 0,
): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: ei })
}

export const SUBSHIP_PILOT_EYE_Z = 34
export const SUBSHIP_OFFSET_Z    = 40

export const SUBSHIP_ROOM = {
  floorY: -0.6,
  ceilY:   1.2,
  frontZ: -4.0,
  backZ:   4.0,
  leftX:  -1.2,
  rightX:  1.2,
  helmZ:  -2.5,
} as const

/**
 * Camera eye: SUBSHIP_LOCAL = (0, 0.55, -3.35) in subship local.
 * FOV: 110° (set in CameraController.setMode).
 * Camera orientation: lookAt toward subship nose (z=-20 in subship local).
 *
 * Layout — everything in SUBSHIP LOCAL z (camera at z=-3.35, nose at z=-4.0):
 *
 *   z = -1.4  seat (BEHIND camera — toward tail)
 *   z = -3.60 HOTAS armrests          (0.25 m ahead, y=0.34 puts them at bottom of FOV)
 *   z = -3.92 windshield bulkhead     (0.57 m ahead)
 */
export class SubshipVehicle {
  readonly group:          Group
  readonly exteriorGroup:  Group
  readonly cockpitInterior: { setArmsVisible(v: boolean): void }
  readonly helmLocalZ: number

  private hotasL!: Group
  private hotasR!: Group
  private hotasYaw    = 0
  private hotasPitchL = 0
  private hotasPitchR = 0
  private readonly legGroups: Group[] = []
  private hatchGroup!: Group

  constructor() {
    this.group = new Group()
    this.group.position.z = SUBSHIP_OFFSET_Z

    this.exteriorGroup = new Group()
    this.group.add(this.exteriorGroup)

    this.buildExterior()
    this.buildLegs()
    this.buildHatch()
    this.buildRoom()
    this.buildCockpit()

    this.cockpitInterior = { setArmsVisible(_v: boolean) {} }
    this.helmLocalZ = SUBSHIP_ROOM.helmZ
  }

  update(raw: RawInput, dt: number): void {
    const MAX = Math.PI / 7
    const s   = Math.min(1, dt * 12)
    this.hotasYaw    += (raw.yaw           * MAX - this.hotasYaw)    * s
    this.hotasPitchL += (raw.throttleDelta * MAX - this.hotasPitchL) * s
    this.hotasPitchR += (raw.pitch         * MAX - this.hotasPitchR) * s
    this.hotasL.rotation.z = -this.hotasYaw
    this.hotasL.rotation.x =  this.hotasPitchL
    this.hotasR.rotation.z = -this.hotasYaw
    this.hotasR.rotation.x =  this.hotasPitchR
  }

  setExteriorVisible(v: boolean): void {
    this.exteriorGroup.visible = v
  }

  /**
   * Deploy (or retract) landing legs.
   * @param t  0 = tucked flush against hull, 1 = fully extended for touchdown
   */
  /**
   * Animate hatch open/close.
   * t=0 → door flush with hull (closed), t=1 → door swung 90° outward (open).
   */
  openHatch(t: number): void {
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    // Hinge at rear edge (+Z side). Negative Y rotation swings the door outward (+X).
    this.hatchGroup.rotation.y = -Math.PI / 2 * ease
  }

  /**
   * World-space center of the hatch opening (on the +X side, Z≈1.8).
   * Used as the bezier waypoint for disembark / reboard camera paths.
   * Slightly outside the hull so the camera clears the fuselage wall.
   */
  get hatchWorldPos(): Vector3 {
    // Subship-local: X=2.0 (0.7 m outside the 1.3 exterior wall), Y=mid-height, Z=mid-hatch
    const local = new Vector3(2.0, SUBSHIP_ROOM.floorY + 0.9, 1.8)
    // applyQuaternion + add position is equivalent to localToWorld but doesn't depend on
    // matrixWorld being refreshed this frame.
    return local.applyQuaternion(this.group.quaternion).add(this.group.position)
  }

  deployLegs(t: number): void {
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const signs = [-1, 1, -1, 1]   // left, right, left, right
    for (let i = 0; i < this.legGroups.length; i++) {
      const sign    = signs[i]!
      const tucked  = sign * 1.30   // folded against hull
      const extended = sign * 0.28  // angled ~80° out from hull
      this.legGroups[i]!.rotation.z = tucked + (extended - tucked) * ease
    }
  }

  // ── Landing legs ───────────────────────────────────────────────────────────
  private buildLegs(): void {
    const strut = mat(0x1a1e2c, 0.82, 0.22)
    const foot  = mat(0x0e1018, 0.40, 0.65)

    // Positions: [x-side, z-position] for four legs
    const positions: Array<[number, number]> = [[-1, -2.0], [1, -2.0], [-1, 1.8], [1, 1.8]]
    const signs = [-1, 1, -1, 1]

    for (let i = 0; i < positions.length; i++) {
      const [sx, sz] = positions[i]!
      const sign = signs[i]!

      const legGroup = new Group()
      legGroup.position.set(sx * 0.85, -0.28, sz)

      // Main strut
      const strutMesh = new Mesh(new CylinderGeometry(0.018, 0.024, 0.52, 6), strut)
      strutMesh.position.set(sx * 0.18, -0.26, 0)
      legGroup.add(strutMesh)

      // Foot pad
      const footMesh = new Mesh(new BoxGeometry(0.18, 0.030, 0.14), foot)
      footMesh.position.set(sx * 0.36, -0.54, 0)
      legGroup.add(footMesh)

      // Start tucked against hull
      legGroup.rotation.z = sign * 1.30
      this.exteriorGroup.add(legGroup)
      this.legGroups.push(legGroup)
    }
  }

  // ── Side hatch (boarding door on +X wall, Z 0.8–2.8) ─────────────────────
  private buildHatch(): void {
    const hullMat = mat(0x1c2438, 0.70, 0.30)   // same colour as fuselage
    const frameMat = mat(0x0e1018, 0.60, 0.45)  // dark frame
    const stepMat  = mat(0x1a1e2c, 0.82, 0.22)  // metal step

    const hatchL = 2.0  // Z-length of opening (0.8 → 2.8)
    const hatchH = SUBSHIP_ROOM.ceilY - SUBSHIP_ROOM.floorY  // 1.8 m

    // ── Door panel ──────────────────────────────────────────────────────────
    // hatchGroup pivot = hinge at rear edge of opening, flush with the right exterior wall.
    // Local Z of hinge: +2.8 (rear edge), Local Y: floor level, Local X: +1.3 (right wall)
    this.hatchGroup = new Group()
    this.hatchGroup.position.set(1.3, SUBSHIP_ROOM.floorY, 2.8)
    this.exteriorGroup.add(this.hatchGroup)

    // Door panel sits in hatch-group local space.
    // It is centred at (0, hatchH/2, −hatchL/2) so it covers the opening exactly.
    const door = new Mesh(new BoxGeometry(0.07, hatchH, hatchL), hullMat)
    door.position.set(0, hatchH / 2, -hatchL / 2)
    this.hatchGroup.add(door)

    // Thin frame around the door opening (fixed, part of exteriorGroup, not hatchGroup)
    const frameThk = 0.06
    // Top rail
    const topRail = new Mesh(new BoxGeometry(frameThk, frameThk, hatchL + frameThk * 2), frameMat)
    topRail.position.set(1.3, SUBSHIP_ROOM.ceilY + frameThk / 2, 1.8)
    this.exteriorGroup.add(topRail)
    // Bottom sill
    const botSill = new Mesh(new BoxGeometry(frameThk, frameThk, hatchL + frameThk * 2), frameMat)
    botSill.position.set(1.3, SUBSHIP_ROOM.floorY - frameThk / 2, 1.8)
    this.exteriorGroup.add(botSill)
    // Front upright (Z = 0.8 edge)
    const frontPost = new Mesh(new BoxGeometry(frameThk, hatchH, frameThk), frameMat)
    frontPost.position.set(1.3, SUBSHIP_ROOM.floorY + hatchH / 2, 0.8)
    this.exteriorGroup.add(frontPost)
    // Rear upright (Z = 2.8 edge / hinge side)
    const rearPost = new Mesh(new BoxGeometry(frameThk, hatchH, frameThk), frameMat)
    rearPost.position.set(1.3, SUBSHIP_ROOM.floorY + hatchH / 2, 2.8)
    this.exteriorGroup.add(rearPost)

    // ── Boarding step ────────────────────────────────────────────────────────
    // A small platform just below the hatch opening so the boarding animation looks natural.
    const step = new Mesh(new BoxGeometry(0.55, 0.07, 0.60), stepMat)
    step.position.set(1.65, SUBSHIP_ROOM.floorY - 0.22, 1.8)
    this.exteriorGroup.add(step)
  }

  // ── Exterior hull ──────────────────────────────────────────────────────────
  private buildExterior(): void {
    const body   = mat(0x1c2438, 0.70, 0.30)
    const dark   = mat(0x0e1018, 0.60, 0.45)
    const accent = mat(0x22293c, 0.65, 0.25)
    const eng    = mat(0x001a1a, 0.05, 0.20, 0x00aacc, 1.0)
    const eg     = this.exteriorGroup
    const b      = (w: number, h: number, d: number, m: MeshStandardMaterial, x: number, y: number, z: number) => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z); eg.add(mesh)
    }
    b(2.6, 1.2, 8.0, body,   0,  0,     0)
    b(1.8, 0.9, 4.5, accent, 0,  0.5,  -1.5)
    b(1.0, 0.7, 2.5, body,   0,  0.2,  -4.5)
    b(1.6, 0.6, 1.5, dark,   0, -0.4,   0)
    b(1.0, 0.5, 0.1, mat(0x001828, 0.05, 0.1, 0x002840, 0.22), 0, 0.6, -3.8)
    for (const sx of [-1, 1] as const) {
      b(2.2, 0.18, 3.5, body,  sx * 2.0, -0.1,  0.5)
      b(0.8, 0.70, 2.2, dark,  sx * 1.0, -0.3,  3.2)
      b(0.6, 0.55, 0.2, eng,   sx * 1.0, -0.3,  4.4)
      b(1.8, 0.12, 1.2, body,  sx * 1.2,  0.6,  3.2)
      const el = new PointLight(0x00aacc, 0.8, 5)
      el.position.set(sx * 1.0, -0.3, 4.6); eg.add(el)
      const nav = new Mesh(new BoxGeometry(0.1, 0.1, 0.1),
        mat(sx < 0 ? 0x330000 : 0x003300, 0.1, 0.5, sx < 0 ? 0xff2200 : 0x00ff44, 1.0))
      nav.position.set(sx * 2.2, -0.1, 0.5); eg.add(nav)
    }
    b(0.12, 1.8, 2.2, body, 0, 0.8, 3.0)
  }

  // ── Room shell ─────────────────────────────────────────────────────────────
  private buildRoom(): void {
    const fy = SUBSHIP_ROOM.floorY, cy = SUBSHIP_ROOM.ceilY
    const w  = SUBSHIP_ROOM.rightX - SUBSHIP_ROOM.leftX
    const d  = SUBSHIP_ROOM.backZ  - SUBSHIP_ROOM.frontZ
    const cz = (SUBSHIP_ROOM.frontZ + SUBSHIP_ROOM.backZ) / 2
    const h  = cy - fy
    const wall = mat(0x0b0f18, 0.40, 0.82)
    const flr  = mat(0x060a10, 0.30, 0.90)

    const floor = new Mesh(new PlaneGeometry(w, d), flr)
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, fy, cz); this.group.add(floor)

    // Ceiling: only rear half (front is open canopy glass)
    const rearCeil = new Mesh(new PlaneGeometry(w, d * 0.5), wall)
    rearCeil.rotation.x = Math.PI / 2
    rearCeil.position.set(0, cy, (0 + SUBSHIP_ROOM.backZ) / 2)
    this.group.add(rearCeil)

    // Side walls: only rear structural section — front is open for side glass
    const sideWallD = d * 0.45   // only rear 45% is solid wall
    const sideWallZ = (0 + SUBSHIP_ROOM.backZ) / 2
    for (const sx of [-1, 1] as const) {
      const sw = new Mesh(new BoxGeometry(0.06, h, sideWallD), wall)
      sw.position.set(sx * SUBSHIP_ROOM.rightX, (fy + cy) / 2, sideWallZ)
      this.group.add(sw)
    }

    // Back wall
    const bwall = new Mesh(new BoxGeometry(w, h, 0.06), wall)
    bwall.position.set(0, (fy + cy) / 2, SUBSHIP_ROOM.backZ + 0.03); this.group.add(bwall)

    // Side canopy glass panels (fighter-jet style — wrap around sides)
    const sideMat = new MeshStandardMaterial({
      color: 0x3366aa, transparent: true, opacity: 0.06,
      roughness: 0.02, metalness: 0.0, side: 2, depthWrite: false,
    })
    // Each side pane covers front half of cockpit at shallow angle
    const sidePaneD = d * 0.60   // front 60% of depth
    const sidePaneZ = (SUBSHIP_ROOM.frontZ + 0) / 2   // front half center
    for (const sx of [-1, 1] as const) {
      const sp = new Mesh(new PlaneGeometry(sidePaneD, h * 0.82), sideMat)
      sp.position.set(sx * SUBSHIP_ROOM.rightX, (fy + cy) / 2, sidePaneZ)
      sp.rotation.y = sx * Math.PI / 2
      this.group.add(sp)
    }
  }

  // ── Cockpit interior ───────────────────────────────────────────────────────
  private buildCockpit(): void {
    const fy = SUBSHIP_ROOM.floorY   // -0.6
    const cy = SUBSHIP_ROOM.ceilY    //  1.2
    const fz = SUBSHIP_ROOM.frontZ   // -4.0
    const g  = this.group

    // Materials
    const frame  = mat(0x090c14, 0.72, 0.40)
    const panel  = mat(0x0c1020, 0.38, 0.74)
    const gBlue  = mat(0x001540, 0.05, 0.20, 0x003dcc, 1.10)
    const mfd    = mat(0x001840, 0.05, 0.20, 0x0055cc, 0.95)
    const border = mat(0x001c44, 0.05, 0.20, 0x0066cc, 1.30)
    const seat   = mat(0x0e1018, 0.30, 0.85)
    const metal  = mat(0x1a1e2c, 0.82, 0.22)
    const grip   = mat(0x080c12, 0.18, 0.90)

    const b = (w: number, h: number, d: number, m: MeshStandardMaterial, x: number, y: number, z: number) => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z); g.add(mesh)
    }

    // ── Seat  (BEHIND camera — z = -1.4, i.e. 0.6 m toward tail) ────────
    b(0.62, 0.06, 0.52, seat,  0,  fy + 0.38,  -1.40)
    b(0.60, 0.80, 0.08, seat,  0,  fy + 0.80,  -1.14)
    b(0.36, 0.22, 0.08, seat,  0,  fy + 1.22,  -1.12)
    for (const sx of [-1, 1] as const) {
      b(0.08, 0.38, 0.50, seat, sx * 0.32, fy + 0.60, -1.40)
    }
    // Seat base column
    const col = new Mesh(new CylinderGeometry(0.055, 0.070, 0.42, 8), metal)
    col.position.set(0, fy + 0.21, -1.50); g.add(col)

    // ── Windshield: wide fighter-jet style canopy ─────────────────────────
    const wz = fz + 0.08  // -3.92  (pushed further forward for open feel)
    const glassMat = new MeshStandardMaterial({
      color: 0x3366aa,
      transparent: true,
      opacity: 0.07,
      metalness: 0.0,
      roughness: 0.02,
      side: 2,
      depthWrite: false,
    })

    // Sill (low, thin — let the glass breathe)
    b(2.50, 0.14, 0.10, frame, 0, fy + 0.14, wz)

    // Thin A-pillars only (no wide top/bottom bar — fighter-jet style)
    b(0.06, 1.65, 0.10, frame, -1.22, 0.28, wz)   // left A-pillar
    b(0.06, 1.65, 0.10, frame,  1.22, 0.28, wz)   // right A-pillar

    // Minimal top rail
    b(2.52, 0.10, 0.10, frame, 0, cy - 0.06, wz)

    // Main glass — wide (2.40) and tall (1.65), centered high for good sightlines
    const glassW = 2.40
    const glassH = 1.65
    const glassCY = fy + 0.14 + glassH / 2   // start just above sill
    const glassPane = new Mesh(new PlaneGeometry(glassW, glassH), glassMat)
    glassPane.position.set(0, glassCY, wz)
    g.add(glassPane)

    // Upper canopy dome (continues glass upward over head — angled back)
    const domeMat = new MeshStandardMaterial({
      color: 0x2255aa, transparent: true, opacity: 0.055,
      roughness: 0.02, metalness: 0.0, side: 2, depthWrite: false,
    })
    const dome = new Mesh(new PlaneGeometry(glassW, 0.70), domeMat)
    dome.position.set(0, cy - 0.12, wz + 0.30)
    dome.rotation.x = -0.55   // angled back over head like a canopy
    g.add(dome)

    // ── HOTAS armrests at z = -3.60 — animated via hotasL / hotasR groups ──
    for (const sx of [-1, 1] as const) {
      const gx = sx * 0.46
      const gy = fy + 0.94   // = 0.34 — elbow height; visible at bottom of 110° FOV
      const gz = -3.60       // 0.25 m ahead of camera eye at z = -3.35
      // Static armrest platform
      b(0.26, 0.055, 0.38, panel, gx, gy - 0.028, gz)

      // Animated stick group — pivot at stick base
      const stickGroup = new Group()
      stickGroup.position.set(gx, gy + 0.040, gz - 0.04)
      g.add(stickGroup)

      const sb = (w: number, h: number, d: number, m: MeshStandardMaterial, x: number, y: number, z: number) => {
        const mesh = new Mesh(new BoxGeometry(w, h, d), m)
        mesh.position.set(x, y, z); stickGroup.add(mesh)
      }
      // Stick base
      sb(0.10, 0.075, 0.10, metal, 0, 0, 0)
      // Shaft
      const shaft = new Mesh(new CylinderGeometry(0.016, 0.022, 0.18, 8), metal)
      shaft.position.set(0, 0.09, 0.01); shaft.rotation.x = 0.15; stickGroup.add(shaft)
      // Grip
      sb(0.046, 0.13, 0.050, grip,  0, 0.20, 0.015)
      // Trigger
      sb(0.016, 0.036, 0.052, grip, 0, 0.16, -0.01)
      // Top action button
      const fire = new Mesh(new SphereGeometry(0.014, 7, 5), mat(0x1a3355, 0.1, 0.4, 0x0a2244, 0.80))
      fire.position.set(0, 0.27, 0); stickGroup.add(fire)

      if (sx < 0) this.hotasL = stickGroup
      else        this.hotasR = stickGroup
    }

    // ── Instrument shelf just ahead of camera (z = -3.68 to -3.80) ──────
    b(2.10, 0.05, 0.18, panel,  0, fy + 0.66, -3.74)   // shelf surface
    b(2.08, 0.16, 0.04, mfd,    0, fy + 0.62, -3.68)   // glowing MFD screen strip
    b(2.10, 0.12, 0.04, border, 0, fy + 0.74, -3.68)   // top trim above screen

    // ── Lighting — 2 lights cover the subship cockpit ─────────────────────
    const fill = new PointLight(0x6688cc, 1.60, 8.0)
    fill.position.set(0, cy - 0.10, -2.50); g.add(fill)
    const mfdGlow = new PointLight(0x002266, 1.00, 4.0)
    mfdGlow.position.set(0, 0.15, -2.90); g.add(mfdGlow)
  }
}
