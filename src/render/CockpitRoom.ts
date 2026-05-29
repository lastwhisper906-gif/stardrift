import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
} from 'three'

// ── Room bounds (shipGroup local space) ──────────────────────────────────────
export const ROOM = {
  floorY: -1.1,
  ceilY:   3.4,
  frontZ: -1.5,
  backZ:  16.0,
  leftX:  -4.5,
  rightX:  4.5,
} as const

export const HELM_SEAT_Z        = 0.28
export const HELM_INTERACT_DIST = 1.8

// ── Collision boxes (XZ plane, character radius = 0.38) ─────────────────────
export interface CollisionBox { minX: number; maxX: number; minZ: number; maxZ: number }

export const COLLISION_BOXES: CollisionBox[] = [
  // Helm console / dashboard
  { minX: -1.6, maxX: 1.6,  minZ: -1.4, maxZ: -0.12 },
  // Left secondary station
  { minX: -4.5, maxX: -2.8, minZ:  1.5, maxZ:  5.0  },
  // Right secondary station
  { minX:  2.8, maxX:  4.5, minZ:  1.5, maxZ:  5.0  },
  // Left back rack
  { minX: -4.5, maxX: -3.0, minZ: 10.0, maxZ: 15.8  },
  // Right back rack
  { minX:  3.0, maxX:  4.5, minZ: 10.0, maxZ: 15.8  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function mat(color: number, metalness = 0.3, roughness = 0.8, emissive = 0, ei = 0): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: ei })
}

export class CockpitRoom {
  readonly group: Group

  constructor() {
    this.group = new Group()
    this.buildFloor()
    this.buildCeiling()
    this.buildFrontWindow()
    this.buildSideWalls()
    this.buildBackWall()
    this.buildHelmSeat()
    this.buildSecondaryStations()
    this.buildBackEquipment()
    this.addLighting()
  }

  private buildFloor(): void {
    const W = ROOM.rightX - ROOM.leftX
    const D = ROOM.backZ  - ROOM.frontZ
    const cz = (ROOM.frontZ + ROOM.backZ) / 2

    const floor = new Mesh(new PlaneGeometry(W, D), mat(0x121220, 0.35, 0.9))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, ROOM.floorY, cz)
    this.group.add(floor)

    // Grid lines (4 columns, every 2 m in depth)
    const lineMat = mat(0x1e1e2e, 0.1, 0.95)
    const cols = 4
    for (let i = 0; i <= cols; i++) {
      const x = ROOM.leftX + (i / cols) * W
      const m = new Mesh(new PlaneGeometry(0.025, D), lineMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(x, ROOM.floorY + 0.002, cz)
      this.group.add(m)
    }
    for (let j = 0; j <= 8; j++) {
      const z = ROOM.frontZ + (j / 8) * D
      const m = new Mesh(new PlaneGeometry(W, 0.025), lineMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(0, ROOM.floorY + 0.002, z)
      this.group.add(m)
    }
  }

  private buildCeiling(): void {
    const W = ROOM.rightX - ROOM.leftX
    const D = ROOM.backZ  - ROOM.frontZ
    const cz = (ROOM.frontZ + ROOM.backZ) / 2

    const ceil = new Mesh(new PlaneGeometry(W, D), mat(0x0b0b14))
    ceil.rotation.x = Math.PI / 2
    ceil.position.set(0, ROOM.ceilY, cz)
    this.group.add(ceil)

    // Central strip lights (3 rows)
    const stripMat = mat(0x223355, 0.1, 0.3, 0x0a1a2a, 0.6)
    for (const sx of [-1, 0, 1]) {
      const strip = new Mesh(new BoxGeometry(0.07, 0.02, 14.0), stripMat)
      strip.position.set(sx * 1.2, ROOM.ceilY - 0.012, 5.5)
      this.group.add(strip)
    }

    // Cross-beams every 3 m
    for (let z = 0; z <= 15; z += 3) {
      const beam = new Mesh(new BoxGeometry(W, 0.14, 0.12), mat(0x0e0e18, 0.4))
      beam.position.set(0, ROOM.ceilY - 0.07, ROOM.frontZ + z)
      this.group.add(beam)
    }

    // Cable conduit along left side of ceiling
    const conduit = new Mesh(new BoxGeometry(0.08, 0.08, 12), mat(0x1a1a24, 0.5, 0.4))
    conduit.position.set(ROOM.leftX + 0.6, ROOM.ceilY - 0.14, 5.5)
    this.group.add(conduit)
  }

  // Movie-style panoramic front window ────────────────────────────────────────
  private buildFrontWindow(): void {
    const z = ROOM.frontZ
    const fh = ROOM.ceilY - ROOM.floorY  // 4.5
    const cmy = (ROOM.floorY + ROOM.ceilY) / 2

    const struct = mat(0x0c0c16, 0.45, 0.7)

    // Left structural column (x: -4.5 → -3.2)
    const leftCol = new Mesh(new BoxGeometry(1.3, fh, 0.35), struct)
    leftCol.position.set(-3.85, cmy, z + 0.175)
    this.group.add(leftCol)

    // Right structural column (x: 3.2 → 4.5)
    const rightCol = new Mesh(new BoxGeometry(1.3, fh, 0.35), struct)
    rightCol.position.set(3.85, cmy, z + 0.175)
    this.group.add(rightCol)

    // Top beam (y: window top → ceiling)
    const winTopY = 2.1
    const topBeamH = ROOM.ceilY - winTopY
    const topBeam = new Mesh(new BoxGeometry(ROOM.rightX - ROOM.leftX, topBeamH, 0.35), struct)
    topBeam.position.set(0, winTopY + topBeamH / 2, z + 0.175)
    this.group.add(topBeam)

    // Bottom sill (below dash, y: floor → -0.15)
    const sillH = -0.15 - ROOM.floorY
    const sill = new Mesh(new BoxGeometry(ROOM.rightX - ROOM.leftX, sillH, 0.35), struct)
    sill.position.set(0, ROOM.floorY + sillH / 2, z + 0.175)
    this.group.add(sill)

    // Window frame detail strips (inner bevel)
    const bevel = mat(0x151522, 0.5, 0.6)
    const winH = winTopY - (-0.15)  // window opening height
    const winW = 3.2 * 2             // window opening width
    for (const [bx, bw, bh] of [
      [0, winW, 0.08],              // top edge
      [0, winW, 0.08],              // bottom edge (positioned separately)
      [-winW / 2, 0.08, winH],      // left edge
      [ winW / 2, 0.08, winH],      // right edge
    ] as [number, number, number][]) {
      const b = new Mesh(new BoxGeometry(bw, bh, 0.06), bevel)
      b.position.set(bx, -0.15 + (bh < 0.1 ? (bh === 0.08 && bx === 0 ? winH : 0) : winH / 2), z + 0.35)
      // This is getting complex; use explicit placement below
      b.visible = false
      this.group.add(b)
    }
    // Explicit inner bevel frames
    const bevelStrip = (w: number, h: number, px: number, py: number): void => {
      const b = new Mesh(new BoxGeometry(w, h, 0.05), bevel)
      b.position.set(px, py, z + 0.36)
      this.group.add(b)
    }
    bevelStrip(winW, 0.07, 0, winTopY - 0.035)     // top
    bevelStrip(winW, 0.07, 0, -0.15 + 0.035)        // bottom
    bevelStrip(0.07, winH, -winW / 2 + 0.035, (-0.15 + winTopY) / 2)  // left
    bevelStrip(0.07, winH,  winW / 2 - 0.035, (-0.15 + winTopY) / 2)  // right
    // Center divider (thin, optional)
    bevelStrip(0.055, winH, 0, (-0.15 + winTopY) / 2)
  }

  private buildSideWalls(): void {
    const D = ROOM.backZ - ROOM.frontZ
    const H = ROOM.ceilY - ROOM.floorY
    const cz = (ROOM.frontZ + ROOM.backZ) / 2
    const cy = (ROOM.floorY + ROOM.ceilY) / 2
    const wallMat = mat(0x0e0e18, 0.3, 0.85)

    for (const sx of [-1, 1] as const) {
      const wx = sx * ROOM.rightX
      // Main wall slab
      const wall = new Mesh(new BoxGeometry(0.12, H, D), wallMat)
      wall.position.set(wx - sx * 0.06, cy, cz)
      this.group.add(wall)

      // Wall panels with slight depth
      const panelMat = mat(0x121220, 0.25, 0.9)
      for (let pi = 0; pi < 5; pi++) {
        const pz = 1.0 + pi * 2.8
        const panel = new Mesh(new BoxGeometry(0.06, 1.6, 2.0), panelMat)
        panel.position.set(wx - sx * 0.12, cy - 0.2, ROOM.frontZ + pz + 1.0)
        this.group.add(panel)
      }

      // Porthole windows (decorative frames — sealed)
      const portMat = mat(0x1a2030, 0.4, 0.5, 0x0a1020, 0.3)
      const portFrameMat = mat(0x202432, 0.6, 0.4)
      for (const pz of [2.0, 5.5, 9.0]) {
        const frame = new Mesh(new BoxGeometry(0.07, 0.85, 1.1), portFrameMat)
        frame.position.set(wx - sx * 0.13, cy + 0.2, ROOM.frontZ + pz)
        this.group.add(frame)

        const port = new Mesh(new BoxGeometry(0.05, 0.6, 0.75), portMat)
        port.position.set(wx - sx * 0.13, cy + 0.2, ROOM.frontZ + pz)
        this.group.add(port)
      }

      // Floor-level emergency strip
      const stripMat = mat(0xcc2200, 0.1, 0.5, 0xaa1100, 0.35)
      const strip = new Mesh(new BoxGeometry(0.06, 0.04, D * 0.7), stripMat)
      strip.position.set(wx - sx * 0.1, ROOM.floorY + 0.035, cz)
      this.group.add(strip)
    }
  }

  private buildBackWall(): void {
    const W = ROOM.rightX - ROOM.leftX
    const H = ROOM.ceilY  - ROOM.floorY
    const cy = (ROOM.floorY + ROOM.ceilY) / 2

    const main = new Mesh(new BoxGeometry(W, H, 0.14), mat(0x0d0d16, 0.3))
    main.position.set(0, cy, ROOM.backZ + 0.07)
    this.group.add(main)

    // Large panel sections
    const pMat = mat(0x131320, 0.25, 0.85)
    for (const [px, pw, ph] of [
      [-2.2,  3.0, 2.0],
      [ 0,    2.2, 1.5],
      [ 2.2,  3.0, 2.0],
    ] as [number, number, number][]) {
      const p = new Mesh(new BoxGeometry(pw, ph, 0.06), pMat)
      p.position.set(px, 0.3, ROOM.backZ + 0.01)
      this.group.add(p)
    }

    // Emergency-red bottom strip
    const redMat = mat(0xff2200, 0.1, 0.5, 0xff1100, 0.4)
    const strip = new Mesh(new BoxGeometry(W * 0.9, 0.055, 0.06), redMat)
    strip.position.set(0, ROOM.floorY + 0.14, ROOM.backZ + 0.01)
    this.group.add(strip)

    // Door outline (center back)
    const doorMat = mat(0x1a1a2a, 0.5, 0.6)
    const door = new Mesh(new BoxGeometry(1.1, 2.2, 0.08), doorMat)
    door.position.set(0, ROOM.floorY + 1.1, ROOM.backZ + 0.02)
    this.group.add(door)
    const doorFrame = mat(0x223344, 0.6, 0.4, 0x0a1520, 0.3)
    for (const [dx, dy, dw, dh] of [
      [0, ROOM.floorY + 2.2 + 0.05, 1.2, 0.10],  // top
      [-0.55, ROOM.floorY + 1.1, 0.08, 2.2],       // left
      [ 0.55, ROOM.floorY + 1.1, 0.08, 2.2],       // right
    ] as [number, number, number, number][]) {
      const f = new Mesh(new BoxGeometry(dw, dh, 0.06), doorFrame)
      f.position.set(dx, dy, ROOM.backZ + 0.05)
      this.group.add(f)
    }
  }

  private buildHelmSeat(): void {
    const fy = ROOM.floorY
    const z  = HELM_SEAT_Z
    const cushion = mat(0x1a1a2a, 0.2, 0.9)
    const frame   = mat(0x252535, 0.7, 0.3)

    // Seat cushion
    const seat = new Mesh(new BoxGeometry(0.52, 0.08, 0.46), cushion)
    seat.position.set(0, fy + 0.52, z)
    this.group.add(seat)

    // Back + headrest
    const back = new Mesh(new BoxGeometry(0.52, 0.52, 0.07), cushion)
    back.position.set(0, fy + 0.86, z + 0.22)
    this.group.add(back)

    const head = new Mesh(new BoxGeometry(0.30, 0.20, 0.07), cushion)
    head.position.set(0, fy + 1.14, z + 0.20)
    this.group.add(head)

    // Armrests
    for (const sx of [-0.30, 0.30]) {
      const ar = new Mesh(new BoxGeometry(0.08, 0.05, 0.40), cushion)
      ar.position.set(sx, fy + 0.62, z - 0.04)
      this.group.add(ar)
    }

    // Leg frame
    for (const [lx, lz] of [[-0.22, -0.20], [0.22, -0.20], [-0.22, 0.20], [0.22, 0.20]] as [number, number][]) {
      const leg = new Mesh(new BoxGeometry(0.05, 0.54, 0.05), frame)
      leg.position.set(lx, fy + 0.27, z + lz)
      this.group.add(leg)
    }

    // [F] interact indicator (small glowing box)
    const promptMat = mat(0x0088cc, 0.2, 0.4, 0x005588, 0.55)
    const prompt = new Mesh(new BoxGeometry(0.07, 0.035, 0.025), promptMat)
    prompt.position.set(0.32, fy + 0.60, z - 0.14)
    this.group.add(prompt)
  }

  private buildSecondaryStations(): void {
    const fy  = ROOM.floorY
    const sMat = mat(0x141422, 0.3, 0.85)
    const sMfd = mat(0x001428, 0.1, 0.3, 0x000c1e, 0.5)

    for (const sx of [-1, 1] as const) {
      const cx = sx * 3.7
      // Console body
      const con = new Mesh(new BoxGeometry(1.2, 1.0, 2.8), sMat)
      con.position.set(cx, fy + 0.5, 3.2)
      this.group.add(con)

      // Angled display surface
      const disp = new Mesh(new BoxGeometry(0.95, 0.45, 0.04), sMfd)
      disp.rotation.x = -0.28
      disp.position.set(cx + sx * -0.15, fy + 1.08, 2.35)
      this.group.add(disp)

      // Mini displays
      for (let di = 0; di < 2; di++) {
        const md = new Mesh(new BoxGeometry(0.32, 0.22, 0.03), sMfd)
        md.position.set(cx + sx * (-0.4 + di * sx * 0.5), fy + 0.95, 1.8 + di * 0.55)
        this.group.add(md)
      }

      // Indicator lights
      const colors = [0x00ff44, 0xffaa00, 0xff3300, 0x0055ff]
      colors.forEach((c, i) => {
        const led = new Mesh(
          new BoxGeometry(0.04, 0.04, 0.025),
          mat(c, 0.1, 0.3, c, 0.7),
        )
        led.position.set(cx + sx * (0.45 - i * 0.07), fy + 1.15, 2.4)
        this.group.add(led)
      })
    }
  }

  private buildBackEquipment(): void {
    const fy  = ROOM.floorY
    const rMat = mat(0x101018, 0.35, 0.85)

    for (const sx of [-1, 1] as const) {
      const rx = sx * 3.8
      // Rack body
      const rack = new Mesh(new BoxGeometry(1.4, 3.2, 5.5), rMat)
      rack.position.set(rx, fy + 1.6, 12.5)
      this.group.add(rack)

      // Shelf lines
      for (let s = 0; s < 5; s++) {
        const shelf = new Mesh(new BoxGeometry(1.4, 0.02, 5.5), mat(0x1a1a28, 0.4))
        shelf.position.set(rx, fy + 0.5 + s * 0.55, 12.5)
        this.group.add(shelf)
      }

      // Indicator lights column
      const colors = [0x00ff44, 0xffaa00, 0x0044ff, 0xff4400, 0x00ffcc]
      colors.forEach((c, i) => {
        const led = new Mesh(new BoxGeometry(0.05, 0.05, 0.02), mat(c, 0.1, 0.2, c, 0.75))
        led.position.set(rx + sx * (-0.65), fy + 0.5 + i * 0.45, 10.4)
        this.group.add(led)
      })

      // Oxygen tanks
      for (let t = 0; t < 3; t++) {
        const tank = new Mesh(new BoxGeometry(0.14, 0.65, 0.14), mat(0x2a3545, 0.6, 0.4))
        tank.position.set(rx + sx * 0.45, fy + 0.36, 10.5 + t * 0.22)
        this.group.add(tank)
      }
    }
  }

  private addLighting(): void {
    // Warm fill from back
    const backFill = new PointLight(0x002244, 0.5, 18)
    backFill.position.set(0, 1.0, 10)
    this.group.add(backFill)

    // Cool accent near secondary stations
    for (const sx of [-1, 1]) {
      const l = new PointLight(0x001133, 0.4, 6)
      l.position.set(sx * 3.5, 0.5, 3.5)
      this.group.add(l)
    }
  }
}
