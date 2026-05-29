import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  TorusGeometry,
} from 'three'

function metal(color: number, metalness = 0.7, roughness = 0.25, emissive = 0, ei = 0): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: ei })
}

export class SpaceStation {
  readonly group: Group
  /** World-space position the station is placed at */
  static readonly POSITION: [number, number, number] = [0, 30, -1600]

  constructor() {
    this.group = new Group()
    this.buildHubCore()
    this.buildArms()
    this.buildHabRing()
    this.buildSolarPanels()
    this.buildDockingPort()
    this.addLights()
    this.group.position.set(...SpaceStation.POSITION)
  }

  private buildHubCore(): void {
    const hub = metal(0x1a2030, 0.70, 0.30)
    const detail = metal(0x0e1520, 0.60, 0.45)

    // Central sphere (approximated with cylinder + end caps)
    const core = new Mesh(new CylinderGeometry(14, 14, 22, 16), hub)
    core.rotation.x = Math.PI / 2
    this.group.add(core)

    // End caps
    for (const sz of [-1, 1]) {
      const cap = new Mesh(new CylinderGeometry(8, 14, 8, 16), hub)
      cap.rotation.x = Math.PI / 2
      cap.position.z = sz * 14
      this.group.add(cap)
    }

    // Hull panel details
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const p = new Mesh(new BoxGeometry(6, 10, 0.4), detail)
      p.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0)
      p.rotation.z = a
      this.group.add(p)
    }
  }

  private buildArms(): void {
    const armMat = metal(0x16202e, 0.65, 0.40)
    const accentMat = metal(0x0e1828, 0.55, 0.50)

    // 4 arms at 90° intervals in the XY plane
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      const ax = Math.cos(a)
      const ay = Math.sin(a)

      // Main arm strut
      const arm = new Mesh(new CylinderGeometry(2.5, 2.5, 80, 8), armMat)
      arm.position.set(ax * 50, ay * 50, 0)
      arm.rotation.z = a + Math.PI / 2
      this.group.add(arm)

      // End module at arm tip
      const endMod = new Mesh(new CylinderGeometry(8, 8, 16, 12), armMat)
      endMod.rotation.x = Math.PI / 2
      endMod.position.set(ax * 92, ay * 92, 0)
      this.group.add(endMod)

      // Secondary truss along arm
      const truss = new Mesh(new BoxGeometry(1, 1, 70), accentMat)
      truss.position.set(ax * 50 + ay * 3, ay * 50 - ax * 3, 0)
      truss.rotation.z = a + Math.PI / 2
      this.group.add(truss)
    }
  }

  private buildHabRing(): void {
    // Rotating habitat ring (visual — not actually animated for simplicity)
    const ringMat = metal(0x1c2438, 0.6, 0.35)
    const windowMat = metal(0x001830, 0.1, 0.2, 0x003366, 0.5)

    const ring = new Mesh(new TorusGeometry(68, 6, 8, 32), ringMat)
    ring.rotation.x = Math.PI / 2
    this.group.add(ring)

    // Windows on ring
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const win = new Mesh(new BoxGeometry(3, 2, 0.5), windowMat)
      win.position.set(Math.cos(a) * 68, Math.sin(a) * 68, 0)
      win.rotation.z = a
      this.group.add(win)
    }
  }

  private buildSolarPanels(): void {
    const panelMat = metal(0x0a1a3a, 0.2, 0.4, 0x001844, 0.3)
    const frameMat = metal(0x1a2030, 0.7, 0.3)

    // Two pairs of solar wings extending in Z direction
    for (const sz of [-1, 1]) {
      for (const sx of [-1, 1]) {
        const panel = new Mesh(new BoxGeometry(55, 14, 0.5), panelMat)
        panel.position.set(sx * 48, 0, sz * 38)
        this.group.add(panel)

        const frame = new Mesh(new BoxGeometry(55, 0.5, 0.5), frameMat)
        frame.position.set(sx * 48, 7.5, sz * 38)
        this.group.add(frame)

        const strut = new Mesh(new BoxGeometry(0.5, 14, 10), frameMat)
        strut.position.set(sx * 24, 0, sz * 34)
        this.group.add(strut)
      }
    }
  }

  private buildDockingPort(): void {
    const portMat = metal(0x182030, 0.65, 0.35)
    const glowMat = metal(0x002233, 0.1, 0.2, 0x00ccff, 1.0)

    // Docking collar (top of station, +Y direction)
    const collar = new Mesh(new CylinderGeometry(10, 10, 12, 12), portMat)
    collar.position.y = 23
    this.group.add(collar)

    // Docking ring (glowing)
    const dockRing = new Mesh(new TorusGeometry(9, 0.8, 8, 24), glowMat)
    dockRing.position.y = 29
    this.group.add(dockRing)

    // Guide lights
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const gl = new Mesh(new BoxGeometry(0.6, 0.6, 0.6),
        metal(0x003300, 0.1, 0.3, 0x00ff55, 0.9))
      gl.position.set(Math.cos(a) * 9, 29, Math.sin(a) * 9)
      this.group.add(gl)
    }
  }

  private addLights(): void {
    // Hub light
    const hub = new PointLight(0x4488cc, 1.5, 200)
    hub.position.set(0, 0, 0)
    this.group.add(hub)

    // Docking port light (green)
    const dock = new PointLight(0x00ff88, 1.0, 80)
    dock.position.set(0, 30, 0)
    this.group.add(dock)

    // Navigation strobe (red + green)
    for (const [sx, c] of [[1, 0xff2200], [-1, 0x00ff44]] as [number, number][]) {
      const light = new PointLight(c, 0.8, 100)
      light.position.set(sx * 90, 0, 0)
      this.group.add(light)
      const mesh = new Mesh(new BoxGeometry(2, 2, 2), metal(0, 0.1, 0.5, c, 1))
      mesh.position.set(sx * 90, 0, 0)
      this.group.add(mesh)
    }
  }
}
