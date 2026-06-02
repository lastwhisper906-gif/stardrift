import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three'

export const PLANET_RADIUS = 350  // m

export interface ResourceNode {
  readonly worldPos: Vector3
  collected: boolean
  readonly mesh: Mesh
}

// Five fixed positions (lat/lon in radians) spread across the near hemisphere
const NODE_ANGLES: Array<[number, number]> = [
  [ 0.40,  0.30],
  [-0.30,  0.80],
  [ 0.70, -0.50],
  [-0.55, -0.20],
  [ 0.10,  1.10],
]

function spherePoint(theta: number, phi: number, r: number): Vector3 {
  return new Vector3(
    r * Math.cos(phi) * Math.sin(theta),
    r * Math.sin(phi),
    r * Math.cos(phi) * Math.cos(theta),
  )
}

export class PlanetMesh {
  readonly group: Group
  readonly nodes: ResourceNode[] = []

  private pulseTime = 0

  constructor() {
    this.group = new Group()
    this.buildPlanet()
    this.buildAtmosphere()
    this.buildNodes()
    this.addLights()
  }

  private buildPlanet(): void {
    const mat = new MeshStandardMaterial({
      color:     0x5a4a3a,
      roughness: 0.88,
      metalness: 0.10,
    })
    const sphere = new Mesh(new SphereGeometry(PLANET_RADIUS, 32, 32), mat)
    this.group.add(sphere)

    // Rocky surface detail rings (decorative bands)
    const bandMat = new MeshStandardMaterial({ color: 0x3d2e22, roughness: 0.95, metalness: 0.05 })
    const crustMat = new MeshStandardMaterial({ color: 0x6e5c48, roughness: 0.80, metalness: 0.15 })
    this.group.add(new Mesh(new SphereGeometry(PLANET_RADIUS * 0.998, 16, 8), bandMat))
    this.group.add(new Mesh(new SphereGeometry(PLANET_RADIUS * 0.999, 24, 12), crustMat))
  }

  private buildAtmosphere(): void {
    const atmoMat = new MeshStandardMaterial({
      color:       0x7799cc,
      transparent: true,
      opacity:     0.08,
      roughness:   0.0,
      metalness:   0.0,
      side:        2,  // DoubleSide
      depthWrite:  false,
    })
    this.group.add(new Mesh(new SphereGeometry(PLANET_RADIUS + 6, 32, 32), atmoMat))
  }

  private buildNodes(): void {
    const crystal = new MeshStandardMaterial({
      color:             0x00ffcc,
      emissive:          0x00bbaa,
      emissiveIntensity: 1.2,
      roughness:         0.10,
      metalness:         0.80,
    })

    for (const [theta, phi] of NODE_ANGLES) {
      const localPos = spherePoint(theta, phi, PLANET_RADIUS + 1.2)
      const mesh = new Mesh(new SphereGeometry(2.5, 8, 6), crystal.clone())
      mesh.position.copy(localPos)
      this.group.add(mesh)

      this.nodes.push({
        worldPos: localPos.clone(),  // updated by updateWorldPositions()
        collected: false,
        mesh,
      })
    }
  }

  private addLights(): void {
    // Ambient scatter light that makes the planet feel lit
    const pl = new PointLight(0xffddaa, 0.6, 800)
    pl.position.set(0, 400, 0)
    this.group.add(pl)
  }

  /** Call each frame — pulses uncollected node glow */
  update(dt: number): void {
    this.pulseTime += dt
    const pulse = 0.7 + 0.3 * Math.sin(this.pulseTime * 2.5)
    for (const node of this.nodes) {
      if (!node.collected) {
        ;(node.mesh.material as MeshStandardMaterial).emissiveIntensity = pulse * 1.2
      }
    }
  }

  /** Mark a node as collected — hides it */
  collectNode(node: ResourceNode): void {
    node.mesh.visible = false
    ;(node as { collected: boolean }).collected = true
  }

  /** Sync node worldPos after group has been positioned in world space */
  updateWorldPositions(): void {
    for (let i = 0; i < this.nodes.length; i++) {
      const pair = NODE_ANGLES[i]!
      const [theta, phi] = pair
      const local = spherePoint(theta, phi, PLANET_RADIUS + 1.2)
      // Convert from group-local to world
      const world = local.clone()
      this.group.localToWorld(world)
      ;(this.nodes[i] as unknown as { worldPos: Vector3 }).worldPos.copy(world)
    }
  }
}
