import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
} from 'three'

export const ROOM = {
  floorY: -1.1,
  ceilY:  1.5,
  frontZ: -1.35,
  backZ:  3.0,
  leftX:  -1.2,
  rightX:  1.2,
} as const

export const HELM_SEAT_Z        = 0.28
export const HELM_INTERACT_DIST = 1.1

export class CockpitRoom {
  readonly group: Group

  constructor() {
    this.group = new Group()
    this.buildFloor()
    this.buildCeiling()
    this.buildBackWall()
    this.buildHelmSeat()
    this.buildEquipmentRacks()
    this.addAmbientLights()
  }

  private mat(color: number, metalness = 0.25, roughness = 0.85): MeshStandardMaterial {
    return new MeshStandardMaterial({ color, metalness, roughness })
  }

  private buildFloor(): void {
    const w = ROOM.rightX - ROOM.leftX
    const d = ROOM.backZ - ROOM.frontZ
    const cx = 0
    const cz = (ROOM.frontZ + ROOM.backZ) / 2

    const floor = new Mesh(new PlaneGeometry(w, d), this.mat(0x141420))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cx, ROOM.floorY, cz)
    this.group.add(floor)

    // Floor grid lines
    const lineMat = new MeshStandardMaterial({ color: 0x202030, roughness: 0.95 })
    const cols = 4, rows = 5
    for (let i = 0; i <= cols; i++) {
      const x = ROOM.leftX + (i / cols) * w
      const line = new Mesh(new PlaneGeometry(0.018, d), lineMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(x, ROOM.floorY + 0.001, cz)
      this.group.add(line)
    }
    for (let j = 0; j <= rows; j++) {
      const z = ROOM.frontZ + (j / rows) * d
      const line = new Mesh(new PlaneGeometry(w, 0.018), lineMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(cx, ROOM.floorY + 0.001, z)
      this.group.add(line)
    }
  }

  private buildCeiling(): void {
    const w = ROOM.rightX - ROOM.leftX
    const d = ROOM.backZ - ROOM.frontZ
    const ceil = new Mesh(new PlaneGeometry(w, d), this.mat(0x0c0c14))
    ceil.rotation.x = Math.PI / 2
    ceil.position.set(0, ROOM.ceilY, (ROOM.frontZ + ROOM.backZ) / 2)
    this.group.add(ceil)

    // Ceiling strip lights
    const stripMat = new MeshStandardMaterial({
      color: 0x223344,
      emissive: 0x0a1a2a,
      emissiveIntensity: 0.6,
    })
    for (const x of [-0.5, 0, 0.5]) {
      const strip = new Mesh(new BoxGeometry(0.06, 0.025, 2.8), stripMat)
      strip.position.set(x, ROOM.ceilY - 0.015, 0.8)
      this.group.add(strip)
    }
  }

  private buildBackWall(): void {
    const wallMat = this.mat(0x101018)
    const h = ROOM.ceilY - ROOM.floorY
    const wall = new Mesh(new BoxGeometry(ROOM.rightX - ROOM.leftX, h, 0.07), wallMat)
    wall.position.set(0, (ROOM.floorY + ROOM.ceilY) / 2, ROOM.backZ)
    this.group.add(wall)

    // Panel sections
    const panelMat = this.mat(0x161624, 0.3)
    for (const [px, py, pw, ph] of [
      [-0.6,  0.2, 0.5, 1.1],
      [ 0,    0.2, 0.5, 1.1],
      [ 0.6,  0.2, 0.5, 1.1],
    ] as [number, number, number, number][]) {
      const p = new Mesh(new BoxGeometry(pw, ph, 0.03), panelMat)
      p.position.set(px, py, ROOM.backZ - 0.05)
      this.group.add(p)
    }

    // Emergency red strip at floor level
    const redMat = new MeshStandardMaterial({
      color: 0xff2200, emissive: 0xff1100, emissiveIntensity: 0.4,
    })
    const strip = new Mesh(new BoxGeometry(2.1, 0.045, 0.03), redMat)
    strip.position.set(0, ROOM.floorY + 0.12, ROOM.backZ - 0.04)
    this.group.add(strip)
  }

  private buildHelmSeat(): void {
    const cushionMat = this.mat(0x1a1a28, 0.2, 0.9)
    const frameMat   = this.mat(0x222232, 0.7, 0.3)

    const z = HELM_SEAT_Z
    const fy = ROOM.floorY

    // Seat cushion
    const seat = new Mesh(new BoxGeometry(0.48, 0.07, 0.42), cushionMat)
    seat.position.set(0, fy + 0.52, z)
    this.group.add(seat)

    // Backrest
    const back = new Mesh(new BoxGeometry(0.48, 0.48, 0.065), cushionMat)
    back.position.set(0, fy + 0.83, z + 0.20)
    this.group.add(back)

    // Head rest
    const head = new Mesh(new BoxGeometry(0.28, 0.18, 0.06), cushionMat)
    head.position.set(0, fy + 1.10, z + 0.18)
    this.group.add(head)

    // Armrests
    for (const sx of [-0.27, 0.27]) {
      const arm = new Mesh(new BoxGeometry(0.07, 0.05, 0.38), cushionMat)
      arm.position.set(sx, fy + 0.62, z - 0.04)
      this.group.add(arm)
    }

    // Leg frame
    for (const [lx, lz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.19], [0.2, 0.19]] as [number, number][]) {
      const leg = new Mesh(new BoxGeometry(0.04, 0.52, 0.04), frameMat)
      leg.position.set(lx, fy + 0.26, z + lz)
      this.group.add(leg)
    }

    // F-key prompt label (small box glowing cyan)
    const promptMat = new MeshStandardMaterial({
      color: 0x00aaff, emissive: 0x005588, emissiveIntensity: 0.5,
    })
    const prompt = new Mesh(new BoxGeometry(0.06, 0.03, 0.02), promptMat)
    prompt.position.set(0.3, fy + 0.58, z - 0.12)
    this.group.add(prompt)
  }

  private buildEquipmentRacks(): void {
    const rackMat = this.mat(0x0e0e18, 0.35)
    const indicatorColors = [0x00ff44, 0xffaa00, 0x0055ff, 0xff4400]

    for (const side of [-1, 1] as const) {
      const rx = side * (ROOM.rightX - 0.14)
      // Rack body
      const rack = new Mesh(new BoxGeometry(0.26, 1.6, 0.32), rackMat)
      rack.position.set(rx, ROOM.floorY + 0.8, 2.2)
      this.group.add(rack)

      // Shelf dividers
      for (let s = 0; s < 3; s++) {
        const shelf = new Mesh(new BoxGeometry(0.26, 0.015, 0.32), this.mat(0x181828, 0.5))
        shelf.position.set(rx, ROOM.floorY + 0.3 + s * 0.45, 2.2)
        this.group.add(shelf)
      }

      // Indicator lights
      indicatorColors.forEach((c, i) => {
        const light = new Mesh(
          new BoxGeometry(0.03, 0.03, 0.015),
          new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.7 }),
        )
        light.position.set(rx + side * 0.095, ROOM.floorY + 0.4 + i * 0.12, 2.08)
        this.group.add(light)
      })
    }

    // Oxygen/supply cylinders on back-left
    const tankMat = this.mat(0x2a3040, 0.6, 0.4)
    for (let i = 0; i < 2; i++) {
      const tank = new Mesh(new BoxGeometry(0.12, 0.55, 0.12), tankMat)
      tank.position.set(ROOM.leftX + 0.18, ROOM.floorY + 0.34, 2.55 + i * 0.18)
      this.group.add(tank)
    }
  }

  private addAmbientLights(): void {
    // Subtle blue fill from back area
    const fill = new PointLight(0x0033aa, 0.35, 5)
    fill.position.set(0, 0.5, 2.0)
    this.group.add(fill)
  }
}
