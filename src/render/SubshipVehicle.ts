import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
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
 * Camera eye: SUBSHIP_LOCAL = (0, 0.30, -2.0) in subship local.
 * FOV: 92° (set in CameraController.setMode).
 * Camera orientation: lookAt toward subship nose (z=-20 in subship local).
 *
 * Layout — everything in SUBSHIP LOCAL z (camera at z=-2.0, nose at z=-4.0):
 *
 *   z = -1.4  seat (BEHIND camera — toward tail)
 *   z = -2.55 HOTAS armrests          (0.55 m ahead)
 *   z = -2.72 dashboard front face    (0.72 m ahead)
 *   z = -3.76 windshield bulkhead     (1.76 m ahead)
 */
export class SubshipVehicle {
  readonly group:          Group
  readonly exteriorGroup:  Group
  readonly cockpitInterior: { setArmsVisible(v: boolean): void }
  readonly helmLocalZ: number

  private hotasL!: Group
  private hotasR!: Group
  private hotasYaw   = 0
  private hotasPitchL = 0
  private hotasPitchR = 0

  constructor() {
    this.group = new Group()
    this.group.position.z = SUBSHIP_OFFSET_Z

    this.exteriorGroup = new Group()
    this.group.add(this.exteriorGroup)

    this.buildExterior()
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
    const ceil = new Mesh(new PlaneGeometry(w, d), wall)
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, cy, cz); this.group.add(ceil)
    for (const sx of [-1, 1] as const) {
      const sw = new Mesh(new BoxGeometry(0.06, h, d), wall)
      sw.position.set(sx * SUBSHIP_ROOM.rightX, (fy + cy) / 2, cz); this.group.add(sw)
    }
    const bwall = new Mesh(new BoxGeometry(w, h, 0.06), wall)
    bwall.position.set(0, (fy + cy) / 2, SUBSHIP_ROOM.backZ + 0.03); this.group.add(bwall)
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

    // ── Windshield bulkhead at z = -3.76 — wide opening for 100° FOV ─────
    // Opening x=(-1.00..1.00) = 2.0 m wide, y=(-0.30..0.95) = 1.25 m tall
    const wz = fz + 0.24  // -3.76
    b(2.20, cy - 0.95, 0.20, frame, 0,  (0.95 + cy) / 2,  wz)  // top — 0.25 m high
    b(2.20, 0.22,      0.20, frame, 0,  fy + 0.19,         wz)  // sill — top at y=-0.30
    b(0.12, 1.25,      0.20, frame, -1.06, 0.325,           wz)  // left pillar — thin
    b(0.12, 1.25,      0.20, frame,  1.06, 0.325,           wz)  // right pillar
    for (const sx of [-1, 1] as const) {
      b(0.016, 1.20, 0.04, gBlue, sx * 1.00, 0.325, wz + 0.10)  // inner glow
    }
    b(1.96, 0.016, 0.04, gBlue, 0,  0.95, wz + 0.10)
    b(1.96, 0.016, 0.04, gBlue, 0, -0.30, wz + 0.10)

    // ── Side cockpit walls — thin LED strips only ─────────────────────────
    for (const sx of [-1, 1] as const) {
      b(0.012, 0.80, 0.020, gBlue, sx * 1.10, 0.10, -3.60)
    }

    // ── Dashboard body — front face at z = -2.72 (0.72 m ahead) ─────────
    const dashBody = new Mesh(new BoxGeometry(2.10, 0.60, 0.60), panel)
    dashBody.position.set(0, -0.08, -3.02)
    dashBody.rotation.x = -0.16
    g.add(dashBody)

    // Dashboard upper angled lip — lowered so back edge stays below camera eye (y=0.30)
    const lip = new Mesh(new BoxGeometry(2.06, 0.05, 0.30), panel)
    lip.position.set(0, 0.10, -2.94)
    lip.rotation.x = -0.50
    g.add(lip)

    // ── Main MFD — large, bright, central ────────────────────────────────
    const mfdMesh = new Mesh(new BoxGeometry(1.10, 0.38, 0.016), mfd)
    mfdMesh.position.set(0, 0.15, -2.88)
    mfdMesh.rotation.x = -0.16
    g.add(mfdMesh)
    ;([
      [1.10, 0.014,  0,     0.19],
      [1.10, 0.014,  0,    -0.19],
      [0.014, 0.38,  0.55,  0  ],
      [0.014, 0.38, -0.55,  0  ],
    ] as [number,number,number,number][]).forEach(([bw, bh, bx, by]) => {
      const bd = new Mesh(new BoxGeometry(bw, bh, 0.018), border)
      bd.position.set(bx, by + 0.15, -2.868); bd.rotation.x = -0.16; g.add(bd)
    })

    // Side sub-displays
    for (const sx of [-1, 1] as const) {
      const sub = new Mesh(new BoxGeometry(0.42, 0.26, 0.014),
        mat(0x001430, 0.05, 0.2, 0x002888, 0.80))
      sub.position.set(sx * 0.78, 0.15, -2.87)
      sub.rotation.x = -0.16; g.add(sub)
    }

    // LED row
    ;([0x00ff55, 0x00ff55, 0xffaa00, 0x0088ff, 0xff4400] as number[]).forEach((c, i) => {
      const led = new Mesh(new BoxGeometry(0.026, 0.026, 0.014), mat(c, 0.1, 0.3, c, 0.90))
      led.position.set(-0.10 + i * 0.05, -0.08, -2.78); g.add(led)
    })

    // ── HOTAS armrests at z = -2.55 — animated via hotasL / hotasR groups ──
    for (const sx of [-1, 1] as const) {
      const gx = sx * 0.46
      const gy = fy + 0.46   // = -0.14
      const gz = -2.58
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

    // ── Center console tunnel — top at y = fy+0.50 = -0.10 (below camera) ─
    b(0.26, 0.50, 1.10, mat(0x0d1020, 0.50, 0.60), 0, fy + 0.25, -3.10)
    b(0.24, 0.034, 0.90, panel, 0, fy + 0.51, -3.10)
    b(0.18, 0.010, 0.80, gBlue, 0, fy + 0.55, -3.10)

    // ── Overhead indicator strip (visible looking slightly up) ────────────
    const ovhd = new Mesh(new BoxGeometry(1.80, 0.08, 0.80),
      mat(0x0a0f1a, 0.50, 0.60))
    ovhd.position.set(0, cy - 0.12, -3.00); g.add(ovhd)
    // Overhead MFD strip
    const ovMfd = new Mesh(new BoxGeometry(1.50, 0.055, 0.55),
      mat(0x001022, 0.05, 0.2, 0x001a33, 0.80))
    ovMfd.position.set(0, cy - 0.15, -3.10); g.add(ovMfd)

    // ── Lighting ──────────────────────────────────────────────────────────
    const fill = new PointLight(0x6688cc, 1.50, 7.0)
    fill.position.set(0, cy - 0.10, -2.50); g.add(fill)
    const mfdGlow = new PointLight(0x002266, 1.00, 4.0)
    mfdGlow.position.set(0, 0.15, -2.90); g.add(mfdGlow)
    const winLight = new PointLight(0x7788aa, 0.60, 5.5)
    winLight.position.set(0, 0.30, fz + 0.80); g.add(winLight)
    const floorLight = new PointLight(0x001a44, 0.60, 3.5)
    floorLight.position.set(0, fy + 0.05, -2.80); g.add(floorLight)
  }
}
