import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from 'three'

function hull(
  color: number, metalness = 0.65, roughness = 0.35,
  emissive = 0, ei = 0,
): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: ei })
}

function box(
  parent: Group, w: number, h: number, d: number,
  mat: MeshStandardMaterial, x: number, y: number, z: number,
): void {
  const m = new Mesh(new BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  parent.add(m)
}

export class ShipExterior {
  readonly group: Group

  constructor() {
    this.group = new Group()
    this.buildFuselage()
    this.buildNose()
    this.buildWings()
    this.buildEngines()
    this.buildDetails()
    this.addLights()
    this.group.visible = false  // hidden in interior modes
  }

  private buildFuselage(): void {
    const dark   = hull(0x181c26, 0.65, 0.40)
    const mid    = hull(0x1e2230, 0.60, 0.35)
    const accent = hull(0x22283c, 0.70, 0.25)
    const panel  = hull(0x0e1018, 0.50, 0.55)

    // ── Main body ─────────────────────────────────────────────────────────
    // Lower hull spine (keel runs full length)
    box(this.group, 6.0, 2.0, 26.0, dark,   0,  -0.5, 9.0)

    // Upper primary hull
    box(this.group, 9.5, 3.5, 20.0, mid,    0,   1.5, 9.0)

    // Bridge / command superstructure (raised centre)
    box(this.group, 6.0, 2.2, 10.0, accent, 0,   3.6, 7.0)

    // Side hull cheeks (give mass to the sides)
    for (const sx of [-1, 1] as const) {
      box(this.group, 1.2, 3.0, 16.0, dark, sx * 5.3,  1.2, 9.5)
      // Intake recess
      box(this.group, 0.8, 1.4,  5.0, panel, sx * 5.1, 0.3, 4.5)
    }

    // Panel seams
    const seam = hull(0x0a0c12, 0.4, 0.8)
    for (const pz of [1, 5, 10, 15, 19]) {
      box(this.group, 9.6, 0.06, 0.10, seam, 0, 1.5, pz)
    }
  }

  private buildNose(): void {
    const noseMat  = hull(0x1a1e28, 0.60, 0.38)
    const dark     = hull(0x0e1018, 0.55, 0.55)
    const accent   = hull(0x22283c, 0.65, 0.30)
    const ridge    = hull(0x141824, 0.72, 0.24)
    const visorMat = hull(0x001828, 0.05, 0.10, 0x002840, 0.25)
    const sensor   = hull(0x001520, 0.08, 0.28, 0x002a40, 0.55)

    // ── Main nose progression (6 sections, smooth taper z: +2 → -11) ─────
    box(this.group, 8.5, 3.8, 4.5, noseMat, 0,  0.8,  0.0)   // base (joins fuselage)
    box(this.group, 7.2, 3.5, 4.5, noseMat, 0,  1.0, -3.0)   // cockpit section
    box(this.group, 5.8, 3.1, 3.5, noseMat, 0,  1.2, -6.0)   // mid-nose
    box(this.group, 4.2, 2.7, 3.0, noseMat, 0,  1.25,-8.5)   // taper 1
    box(this.group, 2.8, 2.1, 2.5, noseMat, 0,  1.15,-10.8)  // taper 2
    box(this.group, 1.5, 1.4, 1.8, noseMat, 0,  0.9, -12.4)  // sharp tip

    // ── Upper brow ridge (adds height and depth to the top) ────────────────
    box(this.group, 5.5, 0.75, 5.8, accent,  0,  3.15, -1.5)  // main brow
    box(this.group, 3.8, 0.55, 4.2, accent,  0,  3.05, -5.0)  // brow extension
    box(this.group, 2.0, 0.38, 2.8, ridge,   0,  2.85, -8.0)  // brow taper

    // ── Side cheek panels (give nose 3D volume and width) ─────────────────
    for (const sx of [-1, 1] as const) {
      box(this.group, 0.52, 2.9, 5.5, accent,  sx * 4.1, 0.9, -2.2)   // main cheek
      box(this.group, 0.42, 2.4, 3.5, noseMat, sx * 3.2, 1.1, -5.8)   // cheek taper
      box(this.group, 0.30, 1.8, 2.5, noseMat, sx * 2.1, 1.05,-9.0)   // cheek tip

      // Intake recess on cheek
      box(this.group, 0.36, 0.85, 2.4, dark,   sx * 3.9, 0.35, -1.8)

      // Structural ridge line
      box(this.group, 0.10, 0.20, 5.0, ridge,  sx * 3.5, 2.25, -3.0)
    }

    // ── Lower chin / sensor pods ───────────────────────────────────────────
    box(this.group, 3.0, 1.15, 5.5, dark,   0, -1.0, -2.5)   // main chin
    box(this.group, 2.2, 0.90, 3.5, dark,   0, -0.90,-5.8)   // chin mid
    box(this.group, 1.4, 0.65, 2.5, dark,   0, -0.75,-8.8)   // chin taper
    box(this.group, 0.6, 0.35, 0.7, sensor, 0, -1.40,-9.5)   // sensor emitter

    // ── Cockpit viewport strip (keep aligned with CockpitRoom interior) ───
    box(this.group, 6.4, 2.5, 0.12, visorMat, 0, 1.4, -1.45)

    // ── Frame pillars (unchanged — match interior room) ───────────────────
    const frameMat = hull(0x151820, 0.7, 0.3)
    box(this.group, 0.18, 2.6, 0.14, frameMat, -3.2, 1.4, -1.44)
    box(this.group, 0.18, 2.6, 0.14, frameMat,  3.2, 1.4, -1.44)
    box(this.group, 6.8, 0.18, 0.14, frameMat,  0, 2.7, -1.44)
    box(this.group, 6.8, 0.18, 0.14, frameMat,  0, 0.1, -1.44)

    // ── Panel seam lines ────────────────────────────────────────────────────
    const seam = hull(0x0a0c12, 0.40, 0.80)
    for (const z of [-1.0, -4.2, -7.5]) {
      box(this.group, 5.8, 0.055, 0.08, seam, 0, 1.8, z)
    }
  }

  private buildWings(): void {
    const wingMat = hull(0x16192a, 0.60, 0.42)
    const edgeMat = hull(0x0e1120, 0.55, 0.50)
    const finMat  = hull(0x1c2030, 0.65, 0.30)

    for (const sx of [-1, 1] as const) {
      // Main delta wing: spans x=4.5 → 10, z=7 → 18
      box(this.group, 5.8, 0.30, 11.0, wingMat, sx * 7.3, 0.1, 12.5)

      // Wing leading edge (angled — approximated with offset boxes)
      box(this.group, 1.5, 0.25, 4.0, wingMat, sx * 5.8, 0.1, 7.5)
      box(this.group, 1.5, 0.25, 3.0, wingMat, sx * 6.8, 0.1, 9.5)

      // Wingtip extension
      box(this.group, 1.0, 0.22, 4.5, edgeMat, sx * 9.8, 0.1, 14.5)

      // Vertical fin at wingtip (dihedral)
      box(this.group, 0.16, 1.8, 2.5, finMat, sx * 10.2, 1.0, 15.5)

      // Weapon hardpoint pylon (under wing)
      box(this.group, 0.7, 0.5, 1.8, edgeMat, sx * 7.0, -0.25, 13.0)
    }

    // Dorsal tail fin
    box(this.group, 0.18, 3.5, 4.5, finMat,  0, 4.2, 18.5)

    // Horizontal tail stabilisers
    for (const sx of [-1, 1] as const) {
      box(this.group, 3.5, 0.18, 2.8, wingMat, sx * 3.5, 3.2, 19.5)
    }
  }

  private buildEngines(): void {
    const engMat  = hull(0x131620, 0.80, 0.20)
    const nozMat  = hull(0x0e1018, 0.85, 0.15)
    const glow    = hull(0x001a1a, 0.05, 0.15, 0x00b8cc, 1.0)
    const glowDim = hull(0x001010, 0.05, 0.15, 0x007a88, 0.8)

    // Centre engine block
    box(this.group, 4.0, 3.0, 5.5, engMat, 0,   1.0, 20.5)
    box(this.group, 3.0, 2.2, 0.25, nozMat, 0,  1.0, 23.4)
    box(this.group, 2.5, 1.8, 0.18, glow,   0,  1.0, 23.6)

    // Port / starboard engine pods
    for (const sx of [-1, 1] as const) {
      box(this.group, 2.0, 1.8, 6.5, engMat, sx * 5.2, 0.4, 19.8)
      box(this.group, 1.6, 1.4, 0.25, nozMat, sx * 5.2, 0.4, 23.2)
      box(this.group, 1.2, 1.0, 0.18, glow,   sx * 5.2, 0.4, 23.4)

      // Pylon connecting pod to fuselage
      box(this.group, 1.1, 0.7, 4.5, engMat, sx * 3.6, 0.4, 19.5)
    }

    // ── Engine glow point lights ──────────────────────────────────────────
    const eLight = new PointLight(0x00b0cc, 2.0, 12)
    eLight.position.set(0, 1.0, 24.0)
    this.group.add(eLight)

    for (const sx of [-1, 1] as const) {
      const sLight = new PointLight(0x0088aa, 1.2, 8)
      sLight.position.set(sx * 5.2, 0.4, 23.8)
      this.group.add(sLight)
    }
  }

  private buildDetails(): void {
    const detail = hull(0x0c0f18, 0.5, 0.6)
    const glow   = hull(0x001122, 0.1, 0.3, 0x0044aa, 0.6)

    // Ventral sensor array (belly, mid-ship)
    box(this.group, 3.5, 0.4, 5.0, detail, 0, -1.5, 8.5)

    // Docking collar (top of hull, mid-ship)
    box(this.group, 2.2, 0.5, 2.2, detail, 0,  3.2, 8.0)
    box(this.group, 1.6, 0.3, 1.6, glow,   0,  3.45, 8.0)

    // Communications array (forward top)
    box(this.group, 0.2, 1.8, 0.2, detail, 0.8, 5.0, 3.5)
    box(this.group, 1.2, 0.1, 0.8, detail, 0.8, 5.8, 3.5)

    // Side hull antennae
    for (const sx of [-1, 1] as const) {
      box(this.group, 0.1, 0.1, 1.8, detail, sx * 6.0, 2.2, 6.0)
      box(this.group, 0.1, 0.1, 1.2, detail, sx * 5.8, 1.5, 12.0)
    }
  }

  private addLights(): void {
    // Port nav light (red)
    const portMesh = new Mesh(
      new BoxGeometry(0.16, 0.16, 0.16),
      hull(0x330000, 0.1, 0.5, 0xff2200, 1.0),
    )
    portMesh.position.set(-10.3, 0.1, 14.5)
    this.group.add(portMesh)
    const portLight = new PointLight(0xff2200, 0.8, 4)
    portLight.position.set(-10.3, 0.1, 14.5)
    this.group.add(portLight)

    // Starboard nav light (green)
    const stbdMesh = new Mesh(
      new BoxGeometry(0.16, 0.16, 0.16),
      hull(0x003300, 0.1, 0.5, 0x00ff55, 1.0),
    )
    stbdMesh.position.set(10.3, 0.1, 14.5)
    this.group.add(stbdMesh)
    const stbdLight = new PointLight(0x00ff55, 0.8, 4)
    stbdLight.position.set(10.3, 0.1, 14.5)
    this.group.add(stbdLight)

    // Nose light (white)
    const noseMesh = new Mesh(
      new BoxGeometry(0.14, 0.14, 0.14),
      hull(0x111111, 0.1, 0.3, 0xffffff, 1.0),
    )
    noseMesh.position.set(0, 2.5, -5.8)
    this.group.add(noseMesh)
  }
}
