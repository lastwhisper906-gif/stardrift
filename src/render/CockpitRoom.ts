import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  TorusGeometry,
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

  // Entrance door state
  private readonly leftDoorPanel:  Group
  private readonly rightDoorPanel: Group
  private readonly sensorGreen:    Mesh
  private readonly sensorRed:      Mesh
  private doorTarget = 0
  private doorOffset = 0

  // Station beacons
  private readonly repairBeaconMat: MeshStandardMaterial
  private readonly o2BeaconMat:     MeshStandardMaterial

  constructor() {
    this.group = new Group()
    this.buildFloor()
    this.buildCeiling()
    this.buildFrontWindow()
    this.buildSideWalls()
    // buildBackWall wires up door panel fields
    const door = this.buildBackWall()
    this.leftDoorPanel  = door.leftPanel
    this.rightDoorPanel = door.rightPanel
    this.sensorGreen    = door.sensorGreen
    this.sensorRed      = door.sensorRed
    this.buildHelmSeat()
    const beacons = this.buildSecondaryStations()
    this.repairBeaconMat = beacons.repairMat
    this.o2BeaconMat     = beacons.o2Mat
    this.buildBackEquipment()
    this.addLighting()
  }

  /**
   * Animate entrance door + station beacons.
   * @param alienInvading  true = door opens (alien emergency access)
   * @param corridorOpen   true = door opens for sub-ship corridor access
   */
  update(alienInvading: boolean, corridorOpen: boolean, dt: number, time = 0): void {
    // Door opens only during alien events or manual corridor access
    this.doorTarget = (alienInvading || corridorOpen) ? 0.65 : 0
    this.doorOffset += (this.doorTarget - this.doorOffset) * Math.min(1, dt * 6)
    this.leftDoorPanel.position.x  = -0.325 - this.doorOffset
    this.rightDoorPanel.position.x =  0.325 + this.doorOffset
    const isOpen = this.doorOffset > 0.05
    this.sensorGreen.visible = isOpen
    this.sensorRed.visible   = !isOpen

    // Beacon pulse (0.4–1.0 intensity, 1.2 Hz)
    const pulse = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 1.2)
    this.repairBeaconMat.emissiveIntensity = 0.4 + pulse * 0.6
    this.o2BeaconMat.emissiveIntensity     = 0.4 + pulse * 0.6
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
    const W  = ROOM.rightX - ROOM.leftX
    const D  = ROOM.backZ  - ROOM.frontZ
    const cz = (ROOM.frontZ + ROOM.backZ) / 2
    const cy = ROOM.ceilY

    // Flat center ceiling
    const ceil = new Mesh(new PlaneGeometry(W, D), mat(0x080812))
    ceil.rotation.x = Math.PI / 2
    ceil.position.set(0, cy, cz)
    this.group.add(ceil)

    // ── Capsule-style angled ceiling panels (curve down at sides) ────────
    // These angled slab panels create the impression of a rounded hull cross-section.
    // Each panel is angled ~ 30° downward from center toward the wall.
    for (const sx of [-1, 1] as const) {
      for (let si = 0; si < 3; si++) {
        const angle = (0.38 + si * 0.14) * sx   // tilt outward and down
        const xOff  = sx * (1.4 + si * 1.1)
        const panel = new Mesh(new BoxGeometry(1.2, 0.04, D * 0.88), mat(0x0b0b16, 0.35))
        panel.position.set(xOff, cy - 0.04 - si * 0.18, cz)
        panel.rotation.z = angle
        this.group.add(panel)
        // LED strip on inner edge
        const led = new Mesh(new BoxGeometry(0.018, 0.014, D * 0.70),
          mat(0x223355, 0.1, 0.3, 0x0a1a2a, 0.55))
        led.position.set(xOff - sx * 0.55, cy - 0.04 - si * 0.18, cz)
        this.group.add(led)
      }
    }

    // Center spine strip lights (3 rows)
    const stripMat = mat(0x223355, 0.1, 0.3, 0x0a1a2a, 0.65)
    for (const sx of [-1, 0, 1]) {
      const strip = new Mesh(new BoxGeometry(0.07, 0.020, 14.0), stripMat)
      strip.position.set(sx * 1.1, cy - 0.012, 5.5)
      this.group.add(strip)
    }

    // Heavy structural ribs (submarine frame-ring style)
    for (let z = 0; z <= 15; z += 2.5) {
      const beam = new Mesh(new BoxGeometry(W + 0.4, 0.18, 0.14), mat(0x0e0e1c, 0.55))
      beam.position.set(0, cy - 0.09, ROOM.frontZ + z)
      this.group.add(beam)
      // Glow on underside of each rib
      const ribGlow = new Mesh(new BoxGeometry(W * 0.7, 0.010, 0.10),
        mat(0x001a33, 0.1, 0.3, 0x002a55, 0.55))
      ribGlow.position.set(0, cy - 0.18, ROOM.frontZ + z)
      this.group.add(ribGlow)
    }

    // Cable conduit
    const conduit = new Mesh(new BoxGeometry(0.10, 0.10, 12), mat(0x1a1a28, 0.6, 0.4))
    conduit.position.set(ROOM.leftX + 0.7, cy - 0.16, 5.5)
    this.group.add(conduit)
  }

  // Clean aircraft-nose windshield — transparent glass + minimal frame ────────
  private buildFrontWindow(): void {
    const z = ROOM.frontZ   // -1.5
    const W = ROOM.rightX - ROOM.leftX   // 9.0
    const frameMat = mat(0x0a0a16, 0.55, 0.60)
    const glow     = mat(0x001020, 0.1, 0.2, 0x0055cc, 0.85)
    const glassMat = new MeshStandardMaterial({
      color: 0x4477aa,
      transparent: true,
      opacity: 0.09,
      metalness: 0.0,
      roughness: 0.02,
      side: 2,       // DoubleSide = 2
      depthWrite: false,
    })

    // ── Floor sill (solid — floor transitions to glass here) ─────────────
    const sillH = ROOM.floorY + 0.9   // 0.9 m above floor → glass starts at y=-0.2
    const sill  = new Mesh(new BoxGeometry(W, sillH, 0.55), frameMat)
    sill.position.set(0, ROOM.floorY + sillH / 2, z + 0.28)
    this.group.add(sill)

    // ── Thin side pillars ─────────────────────────────────────────────────
    const glassBot = ROOM.floorY + sillH   // -0.2
    const glassTop = ROOM.ceilY - 0.20     //  3.2
    const glassH   = glassTop - glassBot   //  3.4
    const glassCY  = (glassBot + glassTop) / 2   // 1.5

    for (const sx of [-1, 1] as const) {
      const pillar = new Mesh(new BoxGeometry(0.14, glassH, 0.08), frameMat)
      pillar.position.set(sx * (ROOM.rightX - 0.07), glassCY, z + 0.04)
      this.group.add(pillar)
      const led = new Mesh(new BoxGeometry(0.016, glassH * 0.88, 0.04), glow)
      led.position.set(sx * (ROOM.rightX - 0.17), glassCY, z + 0.06)
      this.group.add(led)
    }

    // ── Top header strip ──────────────────────────────────────────────────
    const topH = 0.24
    const topBar = new Mesh(new BoxGeometry(W, topH, 0.08), frameMat)
    topBar.position.set(0, ROOM.ceilY - topH / 2, z + 0.04)
    this.group.add(topBar)

    // Center A-pillar removed — open unobstructed forward view

    // ── Aircraft-nose glass: top leans ~25° forward (nose protrusion look) ─
    // Glass center at z=frontZ-1.0, rotation.x=-0.44 rad →
    //   bottom edge at z≈frontZ, top edge at z≈frontZ-2.0
    const paneW = ROOM.rightX - 0.075 - 0.04   // half-width of each pane
    for (const sx of [-1, 1] as const) {
      const pane = new Mesh(new PlaneGeometry(paneW, glassH), glassMat)
      pane.position.set(sx * (paneW / 2 + 0.04), glassCY, z - 1.0)
      pane.rotation.x = -0.44
      this.group.add(pane)
    }

    // ── Subtle glow at sill top edge ──────────────────────────────────────
    const botGlow = new Mesh(new BoxGeometry(W - 0.3, 0.016, 0.04), glow)
    botGlow.position.set(0, glassBot, z + 0.18)
    this.group.add(botGlow)
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

  private buildBackWall(): {
    leftPanel: Group; rightPanel: Group; sensorGreen: Mesh; sensorRed: Mesh
  } {
    const W   = ROOM.rightX - ROOM.leftX
    const H   = ROOM.ceilY  - ROOM.floorY
    const cy  = (ROOM.floorY + ROOM.ceilY) / 2
    const fy  = ROOM.floorY
    const z   = ROOM.backZ
    const wz  = z + 0.07   // back-face of wall (outside room)
    const fz  = z - 0.04   // front-face of panels (inside room)

    const doorW  = 1.3
    const halfDW = doorW / 2   // 0.65
    const doorH  = 2.2

    // ── Wall segments around door opening ────────────────────────────────
    const wallMat = mat(0x0d0d16, 0.3, 0.85)

    // Left wall (x: -4.5 → -0.65), width = 3.85
    const lwSeg = new Mesh(new BoxGeometry(3.85, H, 0.14), wallMat)
    lwSeg.position.set(ROOM.leftX + 1.925, cy, wz)
    this.group.add(lwSeg)

    // Right wall (x: 0.65 → 4.5), width = 3.85
    const rwSeg = new Mesh(new BoxGeometry(3.85, H, 0.14), wallMat)
    rwSeg.position.set(ROOM.rightX - 1.925, cy, wz)
    this.group.add(rwSeg)

    // Header above door (full width, y: floorY+doorH → ceilY)
    const headerH = H - doorH
    const header = new Mesh(new BoxGeometry(W, headerH, 0.14), wallMat)
    header.position.set(0, fy + doorH + headerH / 2, wz)
    this.group.add(header)

    // Tech panels on left and right of door
    const pMat = mat(0x131320, 0.25, 0.85)
    for (const px of [-2.5, 2.5]) {
      const p = new Mesh(new BoxGeometry(1.8, 1.9, 0.06), pMat)
      p.position.set(px, cy - 0.2, wz + 0.02)
      this.group.add(p)
    }

    // Emergency-red bottom strip
    const strip = new Mesh(new BoxGeometry(W * 0.9, 0.055, 0.06),
      mat(0xff2200, 0.1, 0.5, 0xff1100, 0.4))
    strip.position.set(0, fy + 0.14, wz + 0.02)
    this.group.add(strip)

    // ── Sci-fi door frame ──────────────────────────────────────────────────
    const frameMat = mat(0x1a2030, 0.75, 0.25)
    const glowMat  = mat(0x002233, 0.1, 0.2, 0x00ccff, 1.0)
    const frmZ     = z - 0.02

    // Top beam (wider than opening for mounting flanges)
    const topBeam = new Mesh(new BoxGeometry(doorW + 0.32, 0.20, 0.15), frameMat)
    topBeam.position.set(0, fy + doorH + 0.10, frmZ)
    this.group.add(topBeam)

    // Top beam inner glow strip
    const tGlow = new Mesh(new BoxGeometry(doorW + 0.20, 0.028, 0.05), glowMat)
    tGlow.position.set(0, fy + doorH - 0.015, frmZ)
    this.group.add(tGlow)

    // Left pillar
    const lPillar = new Mesh(new BoxGeometry(0.17, doorH + 0.20, 0.15), frameMat)
    lPillar.position.set(-halfDW - 0.085, fy + doorH / 2, frmZ)
    this.group.add(lPillar)

    // Left pillar inner glow strip
    const lGlow = new Mesh(new BoxGeometry(0.028, doorH * 0.92, 0.05), glowMat)
    lGlow.position.set(-halfDW + 0.015, fy + doorH / 2, frmZ)
    this.group.add(lGlow)

    // Right pillar
    const rPillar = new Mesh(new BoxGeometry(0.17, doorH + 0.20, 0.15), frameMat)
    rPillar.position.set(halfDW + 0.085, fy + doorH / 2, frmZ)
    this.group.add(rPillar)

    // Right pillar inner glow strip
    const rGlow = new Mesh(new BoxGeometry(0.028, doorH * 0.92, 0.05), glowMat)
    rGlow.position.set(halfDW - 0.015, fy + doorH / 2, frmZ)
    this.group.add(rGlow)

    // Hydraulic arm details (decorative pipe on outer side of each pillar)
    for (const sx of [-1, 1] as const) {
      const pipe = new Mesh(new BoxGeometry(0.04, doorH * 0.7, 0.04), frameMat)
      pipe.position.set(sx * (halfDW + 0.22), fy + doorH * 0.5, frmZ - 0.02)
      this.group.add(pipe)
    }

    // ── Sliding door panels ───────────────────────────────────────────────
    const panelW = halfDW          // 0.65 each
    const panelH = doorH - 0.05   // 2.15
    const panelY = fy + panelH / 2 + 0.025

    const buildDoorPanel = (sign: number): Group => {
      const pg = new Group()

      // Base panel
      const pBase = new Mesh(new BoxGeometry(panelW, panelH, 0.09),
        mat(0x191926, 0.85, 0.25))
      pg.add(pBase)

      // 3 horizontal ridges
      const ridgeMat = mat(0x252538, 0.7, 0.4)
      for (let i = 0; i < 3; i++) {
        const ridge = new Mesh(new BoxGeometry(panelW * 0.88, 0.045, 0.11), ridgeMat)
        ridge.position.set(0, -panelH / 2 + 0.35 + i * 0.56, 0)
        pg.add(ridge)
      }

      // Inner edge cyan glow (where panels meet when closed)
      const edgeGlow = new Mesh(new BoxGeometry(0.028, panelH * 0.88, 0.11), glowMat)
      edgeGlow.position.set(-sign * panelW / 2, 0, 0)
      pg.add(edgeGlow)

      // Hazard stripe at bottom
      const hazard = new Mesh(new BoxGeometry(panelW * 0.82, 0.24, 0.095),
        mat(0x221100, 0.2, 0.8, 0xcc5500, 0.35))
      hazard.position.set(0, -panelH / 2 + 0.12, 0)
      pg.add(hazard)

      // Access panel / tech detail
      const tech = new Mesh(new BoxGeometry(panelW * 0.5, 0.28, 0.09),
        mat(0x0d1520, 0.3, 0.6, 0x001830, 0.2))
      tech.position.set(sign * panelW * 0.12, panelH * 0.25, 0)
      pg.add(tech)

      // Initial position (closed): center at ±panelW/2
      pg.position.set(sign * panelW / 2, panelY, fz)
      this.group.add(pg)
      return pg
    }

    const leftPanel  = buildDoorPanel(-1)
    const rightPanel = buildDoorPanel(1)

    // ── Floor threshold glow ──────────────────────────────────────────────
    const thresh = new Mesh(new BoxGeometry(doorW * 0.88, 0.03, 0.16),
      mat(0x002233, 0.1, 0.2, 0x00bbcc, 0.7))
    thresh.position.set(0, fy + 0.015, z - 0.12)
    this.group.add(thresh)

    // ── Sensor pad (right side of door) ──────────────────────────────────
    const sensorBase = new Mesh(new BoxGeometry(0.16, 0.28, 0.06),
      mat(0x1a2030, 0.5, 0.4))
    sensorBase.position.set(halfDW + 0.26, fy + 1.18, z - 0.08)
    this.group.add(sensorBase)

    // LED lights: red (closed) and green (open)
    const sensorRed = new Mesh(new BoxGeometry(0.05, 0.05, 0.04),
      mat(0x330000, 0.1, 0.5, 0xff2200, 1.0))
    sensorRed.position.set(halfDW + 0.26, fy + 1.26, z - 0.11)
    this.group.add(sensorRed)

    const sensorGreen = new Mesh(new BoxGeometry(0.05, 0.05, 0.04),
      mat(0x003300, 0.1, 0.5, 0x00ff55, 1.0))
    sensorGreen.position.set(halfDW + 0.26, fy + 1.18, z - 0.11)
    sensorGreen.visible = false
    this.group.add(sensorGreen)

    // Sensor label panel (decorative small buttons)
    for (let i = 0; i < 2; i++) {
      const btn = new Mesh(new BoxGeometry(0.04, 0.04, 0.04),
        mat(0x112233, 0.3, 0.5, 0x003355, 0.5))
      btn.position.set(halfDW + 0.26, fy + 1.08 - i * 0.07, z - 0.11)
      this.group.add(btn)
    }

    // Overhead warning light
    const warn = new Mesh(new BoxGeometry(0.14, 0.10, 0.14),
      mat(0x221100, 0.2, 0.5, 0xffaa00, 0.45))
    warn.position.set(0, fy + doorH + 0.26, frmZ)
    this.group.add(warn)

    // Point light inside door frame for glow effect
    const doorLight = new PointLight(0x00aaee, 0.8, 3.5)
    doorLight.position.set(0, fy + doorH / 2, z - 0.2)
    this.group.add(doorLight)

    return { leftPanel, rightPanel, sensorGreen, sensorRed }
  }

  private buildHelmSeat(): void {
    const fy  = ROOM.floorY
    const z   = HELM_SEAT_Z
    // Sci-fi flight seat materials
    const carbon = mat(0x0e0e18, 0.65, 0.45)      // carbon-fibre dark shell
    const pad    = mat(0x141420, 0.18, 0.88)       // seat padding
    const frame  = mat(0x2a2a40, 0.82, 0.20)       // metal frame
    const glow   = mat(0x002244, 0.05, 0.3, 0x0044cc, 0.70)  // accent glow

    const sy = fy + 0.54   // seat top y

    // ── Carbon-shell bucket seat ─────────────────────────────────────────
    // Outer shell (slightly wider than padding)
    const shell = new Mesh(new BoxGeometry(0.68, 0.08, 0.56), carbon)
    shell.position.set(0, sy - 0.02, z)
    this.group.add(shell)
    // Cushion
    const seat = new Mesh(new BoxGeometry(0.58, 0.06, 0.46), pad)
    seat.position.set(0, sy + 0.015, z)
    this.group.add(seat)

    // ── Tall angled seat back ────────────────────────────────────────────
    const backShell = new Mesh(new BoxGeometry(0.66, 0.82, 0.10), carbon)
    backShell.position.set(0, sy + 0.44, z + 0.27)
    backShell.rotation.x = -0.08
    this.group.add(backShell)
    const backPad = new Mesh(new BoxGeometry(0.55, 0.70, 0.06), pad)
    backPad.position.set(0, sy + 0.44, z + 0.24)
    backPad.rotation.x = -0.08
    this.group.add(backPad)

    // ── Wraparound headrest with side cheeks ─────────────────────────────
    const headMain = new Mesh(new BoxGeometry(0.44, 0.26, 0.10), carbon)
    headMain.position.set(0, sy + 0.92, z + 0.24)
    this.group.add(headMain)
    for (const sx of [-1, 1] as const) {
      const cheek = new Mesh(new BoxGeometry(0.07, 0.22, 0.12), carbon)
      cheek.position.set(sx * 0.245, sy + 0.92, z + 0.25)
      this.group.add(cheek)
    }

    // ── 5-point harness straps (decorative geometry) ─────────────────────
    const strapMat = mat(0x1a1a2e, 0.25, 0.90)
    // Shoulder straps
    for (const sx of [-1, 1] as const) {
      const strap = new Mesh(new BoxGeometry(0.06, 0.60, 0.025), strapMat)
      strap.position.set(sx * 0.18, sy + 0.15, z + 0.22)
      strap.rotation.x = -0.15; strap.rotation.z = sx * 0.12
      this.group.add(strap)
    }
    // Lap belt (horizontal)
    const lap = new Mesh(new BoxGeometry(0.50, 0.055, 0.025), strapMat)
    lap.position.set(0, sy + 0.025, z + 0.06); this.group.add(lap)
    // Central buckle
    const buckle = new Mesh(new BoxGeometry(0.085, 0.085, 0.032),
      mat(0x3a3a50, 0.85, 0.18))
    buckle.position.set(0, sy + 0.06, z + 0.22); this.group.add(buckle)

    // ── Side bolsters (carbon wings) ─────────────────────────────────────
    for (const sx of [-1, 1] as const) {
      const bolster = new Mesh(new BoxGeometry(0.07, 0.48, 0.54), carbon)
      bolster.position.set(sx * 0.345, sy + 0.26, z - 0.01)
      this.group.add(bolster)
    }

    // ── Metal pedestal frame ──────────────────────────────────────────────
    // Central column
    const col = new Mesh(new CylinderGeometry(0.055, 0.070, 0.58, 8), frame)
    col.position.set(0, fy + 0.29, z + 0.08); this.group.add(col)
    // Base plate
    const base = new Mesh(new BoxGeometry(0.52, 0.04, 0.52), frame)
    base.position.set(0, fy + 0.022, z); this.group.add(base)
    // Cross bracing
    for (const sx of [-1, 1] as const) {
      const brace = new Mesh(new BoxGeometry(0.035, 0.035, 0.46), frame)
      brace.position.set(sx * 0.24, fy + 0.10, z); this.group.add(brace)
    }

    // ── Armrest consoles ──────────────────────────────────────────────────
    for (const sx of [-0.34, 0.34]) {
      const ar = new Mesh(new BoxGeometry(0.09, 0.055, 0.42), carbon)
      ar.position.set(sx, sy + 0.03, z - 0.04); this.group.add(ar)
      // Glow edge on armrest
      const arGlow = new Mesh(new BoxGeometry(0.075, 0.010, 0.38), glow)
      arGlow.position.set(sx, sy + 0.058, z - 0.04); this.group.add(arGlow)
    }

    // ── Seat glow strip (under seat, ambient) ─────────────────────────────
    const underGlow = new Mesh(new BoxGeometry(0.58, 0.010, 0.46), glow)
    underGlow.position.set(0, sy - 0.042, z); this.group.add(underGlow)

    // [F] interact indicator
    const promptMat = mat(0x0088cc, 0.2, 0.4, 0x005588, 0.55)
    const prompt = new Mesh(new BoxGeometry(0.07, 0.035, 0.025), promptMat)
    prompt.position.set(0.40, fy + 0.62, z - 0.18); this.group.add(prompt)
  }

  private buildSecondaryStations(): { repairMat: MeshStandardMaterial; o2Mat: MeshStandardMaterial } {
    const fy   = ROOM.floorY
    const sMat = mat(0x141422, 0.3, 0.85)
    const sMfd = mat(0x001428, 0.1, 0.3, 0x000c1e, 0.5)

    for (const sx of [-1, 1] as const) {
      const cx = sx * 3.7
      // Slim wall-mounted console (replaces old desk box — just a panel on the wall)
      const con = new Mesh(new BoxGeometry(0.18, 2.60, 2.8), sMat)
      con.position.set(cx + sx * 0.45, fy + 1.30, 3.2)
      this.group.add(con)

      const disp = new Mesh(new BoxGeometry(0.95, 0.45, 0.04), sMfd)
      disp.rotation.x = -0.28
      disp.position.set(cx + sx * -0.15, fy + 1.08, 2.35)
      this.group.add(disp)

      for (let di = 0; di < 2; di++) {
        const md = new Mesh(new BoxGeometry(0.32, 0.22, 0.03), sMfd)
        md.position.set(cx + sx * (-0.4 + di * sx * 0.5), fy + 0.95, 1.8 + di * 0.55)
        this.group.add(md)
      }

      const colors = [0x00ff44, 0xffaa00, 0xff3300, 0x0055ff]
      colors.forEach((c, i) => {
        const led = new Mesh(new BoxGeometry(0.04, 0.04, 0.025), mat(c, 0.1, 0.3, c, 0.7))
        led.position.set(cx + sx * (0.45 - i * 0.07), fy + 1.15, 2.4)
        this.group.add(led)
      })
    }

    // ── Station-type beacons ────────────────────────────────────────────────
    // Left = REPAIR (green), Right = O2 (blue)
    const repairMat = mat(0x003300, 0.1, 0.4, 0x00ff55, 0.8)
    const o2Mat     = mat(0x001133, 0.1, 0.4, 0x0088ff, 0.8)

    const buildBeacon = (bx: number, bm: MeshStandardMaterial, label: string): void => {
      const beacon = new Mesh(new BoxGeometry(0.12, 0.12, 0.12), bm)
      beacon.position.set(bx, fy + 1.42, 3.2)
      this.group.add(beacon)
      // Label plate
      const plate = new Mesh(new BoxGeometry(0.60, 0.10, 0.03), bm)
      plate.position.set(bx, fy + 1.62, 2.0)
      this.group.add(plate)
      void label  // string used as documentation only
    }
    buildBeacon(-3.7, repairMat, 'REPAIR')
    buildBeacon( 3.7, o2Mat,     'OXYGEN')

    return { repairMat, o2Mat }
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
