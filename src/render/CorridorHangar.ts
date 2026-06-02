/**
 * CorridorHangar — the passage from the cockpit room to the sub-ship hangar.
 *
 * Layout (all z in shipGroup local space, continuing from cockpit backZ = 16):
 *   Airlock corridor:  z = 16 → 30   (narrow, 3.6 m wide)
 *   Hangar bay:        z = 30 → 50   (wider,  8 m wide, 3.8 m tall)
 *   Sub-ship sits in hangar at z ≈ 36-48
 */
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
} from 'three'

function mat(color: number, metalness = 0.4, roughness = 0.7, emissive = 0, ei = 0): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: ei })
}

export const CORRIDOR = {
  frontZ:  16.0,   // starts right at cockpit backZ
  backZ:   30.0,
  leftX:  -1.8,
  rightX:  1.8,
  floorY: -1.1,
  ceilY:   1.5,
} as const

export const HANGAR = {
  frontZ:  30.0,
  backZ:   50.0,
  leftX:  -4.0,
  rightX:  4.0,
  floorY: -1.1,
  ceilY:   2.8,
} as const

/** Collision boxes for the corridor & hangar (narrow walls). */
export const CORRIDOR_COLLISION = [
  // Corridor left wall  (blocks x < -1.8 when z is in corridor)
  { minX: -99, maxX: -1.8, minZ: 16.5, maxZ: 29.8 },
  // Corridor right wall (blocks x > +1.8 when z is in corridor)
  { minX:  1.8, maxX: 99,  minZ: 16.5, maxZ: 29.8 },
  // Hangar left wall
  { minX: -99, maxX: -4.0, minZ: 30.5, maxZ: 49.8 },
  // Hangar right wall
  { minX:  4.0, maxX: 99,  minZ: 30.5, maxZ: 49.8 },
]

export class CorridorHangar {
  readonly group: Group

  private hatchLeft!:  Mesh
  private hatchRight!: Mesh
  private hatchOffset = 0
  private hatchTarget = 0

  get hatchProgress(): number { return this.hatchOffset }

  constructor() {
    this.group = new Group()
    this.buildCorridor()
    this.buildHangar()
  }

  /** Animate launch hatch (open when sub-ship is launched). */
  update(hatchOpen: boolean, dt: number): void {
    this.hatchTarget  = hatchOpen ? 1 : 0
    this.hatchOffset += (this.hatchTarget - this.hatchOffset) * Math.min(1, dt * 2.5)
    this.hatchLeft.position.x  = -0.7 - this.hatchOffset * 2.2
    this.hatchRight.position.x =  0.7 + this.hatchOffset * 2.2
  }

  private buildCorridor(): void {
    const fy = CORRIDOR.floorY
    const cy = CORRIDOR.ceilY
    const w  = CORRIDOR.rightX - CORRIDOR.leftX  // 3.6
    const h  = cy - fy                             // 2.6
    const d  = CORRIDOR.backZ  - CORRIDOR.frontZ  // 14
    const cz = (CORRIDOR.frontZ + CORRIDOR.backZ) / 2  // 23

    const wallMat  = mat(0x0e1218, 0.5, 0.75)
    const pipeMat  = mat(0x1a2030, 0.7, 0.3)
    const glowMat  = mat(0x001122, 0.1, 0.3, 0x004488, 0.55)
    const warnMat  = mat(0x221100, 0.2, 0.7, 0xaa4400, 0.35)

    // Floor
    const floor = new Mesh(new PlaneGeometry(w, d), mat(0x101520, 0.4, 0.85))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, fy, cz)
    this.group.add(floor)

    // Ceiling
    const ceil = new Mesh(new PlaneGeometry(w, d), mat(0x0a0f14))
    ceil.rotation.x = Math.PI / 2
    ceil.position.set(0, cy, cz)
    this.group.add(ceil)

    // Side walls
    for (const sx of [-1, 1] as const) {
      const wall = new Mesh(new BoxGeometry(0.1, h, d), wallMat)
      wall.position.set(sx * CORRIDOR.rightX, (fy + cy) / 2, cz)
      this.group.add(wall)

      // Pipe conduits along wall
      for (const pz of [18, 22, 26]) {
        const pipe = new Mesh(new BoxGeometry(0.08, 0.08, 3.0), pipeMat)
        pipe.position.set(sx * (CORRIDOR.rightX - 0.1), fy + 0.3, pz)
        this.group.add(pipe)
      }

      // Blue guide strip (floor level)
      const strip = new Mesh(new BoxGeometry(0.06, 0.025, d * 0.85), glowMat)
      strip.position.set(sx * (CORRIDOR.rightX - 0.15), fy + 0.02, cz)
      this.group.add(strip)
    }

    // Hazard stripes on floor near door openings
    const hazardStripe = (z: number) => {
      const m = new Mesh(new BoxGeometry(w, 0.015, 0.18), warnMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(0, fy + 0.005, z)
      this.group.add(m)
    }
    hazardStripe(16.3)
    hazardStripe(29.7)

    // Ceiling strip light
    const stripLight = new Mesh(new BoxGeometry(0.06, 0.02, d * 0.8), glowMat)
    stripLight.position.set(0, cy - 0.02, cz)
    this.group.add(stripLight)

    // Point light mid-corridor
    const cLight = new PointLight(0x6688cc, 0.6, 12)
    cLight.position.set(0, cy - 0.1, cz)
    this.group.add(cLight)

    // Warning sign near cockpit door
    const warning = new Mesh(new BoxGeometry(0.3, 0.12, 0.04),
      mat(0x221100, 0.2, 0.6, 0xff6600, 0.6))
    warning.position.set(1.2, fy + 1.8, 17.0)
    this.group.add(warning)
  }

  private buildHangar(): void {
    const fy = HANGAR.floorY
    const cy = HANGAR.ceilY
    const w  = HANGAR.rightX - HANGAR.leftX  // 8
    const h  = cy - fy                         // 3.9
    const d  = HANGAR.backZ  - HANGAR.frontZ  // 20
    const cz = (HANGAR.frontZ + HANGAR.backZ) / 2  // 40

    const wallMat  = mat(0x0d1318, 0.45, 0.8)
    const darkMat  = mat(0x090e12, 0.4, 0.9)
    const pipeMat  = mat(0x1e2838, 0.7, 0.3)
    const glowAmb  = mat(0x001a22, 0.1, 0.3, 0x003355, 0.5)
    const glowGrn  = mat(0x002200, 0.1, 0.3, 0x00aa44, 0.6)

    // Floor — split into 4 sections to leave a void gap for the launch hatch
    // Hatch opening: x = -1.4 to 1.4, z = 36 to 44
    const floorSections: [number, number, number, number][] = [
      [w, 6.0,  0.0, 33.0],          // front  z=30-36
      [2.6, 8.0, -2.7, 40.0],        // left   z=36-44, x=-4 to -1.4
      [2.6, 8.0,  2.7, 40.0],        // right  z=36-44, x=1.4 to 4
      [w, 6.0,  0.0, 47.0],          // rear   z=44-50
    ]
    for (const [fw, fd, fx, fz] of floorSections) {
      const mesh = new Mesh(new PlaneGeometry(fw, fd), darkMat)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(fx, fy, fz)
      this.group.add(mesh)
    }

    // Landing pad — also split to avoid hatch area
    const padMat = mat(0x111820, 0.3, 0.9)
    const padSections: [number, number, number, number][] = [
      [5.5, 2.0,  0.0, 35.0],        // front stub  z=34-36
      [1.35, 8.0, -2.025, 40.0],     // left side   z=36-44, x=-2.75 to -1.4
      [1.35, 8.0,  2.025, 40.0],     // right side
      [5.5, 2.0,  0.0, 45.0],        // rear stub   z=44-46
    ]
    for (const [fw, fd, fx, fz] of padSections) {
      const pad = new Mesh(new PlaneGeometry(fw, fd), padMat)
      pad.rotation.x = -Math.PI / 2
      pad.position.set(fx, fy + 0.005, fz)
      this.group.add(pad)
    }

    // Slideable hatch panels (cover the launch void when docked)
    const hatchMat = mat(0x0d1620, 0.60, 0.65)
    const hatchLeft  = new Mesh(new BoxGeometry(1.4, 0.06, 8.0), hatchMat)
    hatchLeft.position.set(-0.7, fy + 0.04, 40)
    this.group.add(hatchLeft)
    this.hatchLeft = hatchLeft

    const hatchRight = new Mesh(new BoxGeometry(1.4, 0.06, 8.0), hatchMat)
    hatchRight.position.set(0.7, fy + 0.04, 40)
    this.group.add(hatchRight)
    this.hatchRight = hatchRight

    // Hatch edge glows
    const hatchGlow = mat(0x002233, 0.1, 0.2, 0x0066aa, 0.9)
    for (const sx of [-1, 1] as const) {
      const edge = new Mesh(new BoxGeometry(0.035, 0.04, 8.0), hatchGlow)
      edge.position.set(sx * 1.4, fy + 0.065, 40)
      this.group.add(edge)
    }

    // Pad corner lights (green)
    for (const [px, pz] of [[-2.5,-6],[ 2.5,-6],[-2.5, 6],[2.5, 6]] as [number,number][]) {
      const dot = new Mesh(new BoxGeometry(0.15, 0.04, 0.15),
        mat(0, 0.1, 0.3, 0x00ff55, 1.0))
      dot.position.set(px, fy + 0.025, 40 + pz)
      this.group.add(dot)
    }

    // Ceiling
    const ceil = new Mesh(new PlaneGeometry(w, d), mat(0x0a0e12))
    ceil.rotation.x = Math.PI / 2
    ceil.position.set(0, cy, cz)
    this.group.add(ceil)

    // Side walls
    for (const sx of [-1, 1] as const) {
      const wall = new Mesh(new BoxGeometry(0.14, h, d), wallMat)
      wall.position.set(sx * HANGAR.rightX, (fy + cy) / 2, cz)
      this.group.add(wall)

      // Equipment racks on walls
      for (const rz of [32, 37, 42, 47]) {
        const rack = new Mesh(new BoxGeometry(0.9, 2.0, 1.4), pipeMat)
        rack.position.set(sx * (HANGAR.rightX - 0.55), fy + 1.0, rz)
        this.group.add(rack)
      }

      // Blue floor strip
      const strip = new Mesh(new BoxGeometry(0.06, 0.025, d * 0.9), glowAmb)
      strip.position.set(sx * (HANGAR.rightX - 0.2), fy + 0.02, cz)
      this.group.add(strip)
    }

    // Back wall
    const backWall = new Mesh(new BoxGeometry(w, h, 0.14), wallMat)
    backWall.position.set(0, (fy + cy) / 2, HANGAR.backZ + 0.07)
    this.group.add(backWall)

    // Hangar lighting (ceiling strip lights)
    const lightMat = mat(0x223355, 0.1, 0.3, 0x0a1a2a, 0.6)
    for (const lz of [32, 37, 42, 47]) {
      const strip = new Mesh(new BoxGeometry(w * 0.7, 0.03, 0.1), lightMat)
      strip.position.set(0, cy - 0.02, lz)
      this.group.add(strip)
      const pl = new PointLight(0x6699cc, 0.5, 10)
      pl.position.set(0, cy - 0.1, lz)
      this.group.add(pl)
    }

    // "HANGAR" indicator panel on front wall (between corridor and hangar)
    const frontWall = new Mesh(new BoxGeometry(w, h, 0.12), wallMat)
    frontWall.position.set(0, (fy + cy) / 2, HANGAR.frontZ - 0.06)
    this.group.add(frontWall)

    // Hangar door opening cut-out (visual — large box hole isn't possible in three.js,
    // so we use the wall with a gap by splitting into pieces)
    // Top piece above doorway (door is 2.0m wide × 2.3m tall)
    const doorW = 2.2, doorH = 2.3
    const headerH = h - doorH
    const header = new Mesh(new BoxGeometry(w, headerH, 0.12), wallMat)
    header.position.set(0, fy + doorH + headerH / 2, HANGAR.frontZ - 0.06)
    this.group.add(header)
    frontWall.visible = false  // replaced by header + side pieces
    for (const sx of [-1, 1] as const) {
      const sideW = (w - doorW) / 2
      const side = new Mesh(new BoxGeometry(sideW, doorH, 0.12), wallMat)
      side.position.set(sx * (doorW / 2 + sideW / 2), fy + doorH / 2, HANGAR.frontZ - 0.06)
      this.group.add(side)
    }

    // Hangar door frame glow
    const fz = HANGAR.frontZ - 0.04
    const frameMat = mat(0x1a2030, 0.75, 0.25)
    const hGlowMat = mat(0x002233, 0.1, 0.2, 0x00ccff, 0.9)
    const topBeam = new Mesh(new BoxGeometry(doorW + 0.3, 0.18, 0.14), frameMat)
    topBeam.position.set(0, fy + doorH + 0.09, fz)
    this.group.add(topBeam)
    const topGlow = new Mesh(new BoxGeometry(doorW + 0.2, 0.025, 0.04), hGlowMat)
    topGlow.position.set(0, fy + doorH - 0.012, fz)
    this.group.add(topGlow)
    for (const sx of [-1, 1] as const) {
      const pillar = new Mesh(new BoxGeometry(0.16, doorH + 0.18, 0.14), frameMat)
      pillar.position.set(sx * (doorW / 2 + 0.08), fy + doorH / 2, fz)
      this.group.add(pillar)
      const glow = new Mesh(new BoxGeometry(0.025, doorH * 0.9, 0.04), hGlowMat)
      glow.position.set(sx * (doorW / 2 - 0.012), fy + doorH / 2, fz)
      this.group.add(glow)
    }

    // Hangar point light for sub-ship area
    const padLight = new PointLight(0x99bbcc, 0.8, 18)
    padLight.position.set(0, cy - 0.3, 40)
    this.group.add(padLight)
  }
}
