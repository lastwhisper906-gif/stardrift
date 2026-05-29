import {
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import type { IEvent } from './IEvent.js'
import type { IStateRoom } from '../state/IStateRoom.js'

const SPAWN_DIST    = 250
const ESCAPE_DIST   = 380
const DESTROY_DIST  = 12
const GRAVITY_COEFF = 350    // m³/s²
const MAX_DURATION  = 60

export class BlackHoleEvent implements IEvent {
  readonly id = 'blackhole'

  private readonly mesh: Group
  private readonly holePos = new Vector3()
  private timer = 0

  constructor(
    private readonly scene: Scene,
    private readonly room: IStateRoom,
  ) {
    this.mesh = this.buildMesh()
  }

  private buildMesh(): Group {
    const g = new Group()

    // Event horizon (dark sphere)
    const core = new Mesh(
      new SphereGeometry(14, 24, 18),
      new MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0 }),
    )
    g.add(core)

    // Accretion disk (flat ring, orange-white hot)
    const disk = new Mesh(
      new TorusGeometry(28, 5, 8, 48),
      new MeshStandardMaterial({
        color: 0x442200, emissive: 0xff6600, emissiveIntensity: 1.0,
        roughness: 0.3, metalness: 0,
      }),
    )
    disk.rotation.x = Math.PI / 2.4
    g.add(disk)

    // Inner ring (brighter)
    const inner = new Mesh(
      new TorusGeometry(18, 2, 6, 36),
      new MeshStandardMaterial({
        color: 0x441100, emissive: 0xffaa44, emissiveIntensity: 1.0,
        roughness: 0.2, metalness: 0,
      }),
    )
    inner.rotation.x = Math.PI / 2.4
    g.add(inner)

    // Glow point lights
    const warm = new PointLight(0xff8844, 3.5, 120)
    g.add(warm)
    const blueShift = new PointLight(0x4488ff, 1.2, 60)
    blueShift.position.set(0, 15, 0)
    g.add(blueShift)

    return g
  }

  onEnter(): void {
    const state = this.room.getState()
    // Spawn perpendicular to ship heading so it's dramatically visible
    const [rx, ry] = state.ship.rotation
    const right = new Vector3(
      Math.cos(ry), 0, -Math.sin(ry),
    )
    const fwd = new Vector3(
      -Math.sin(ry) * Math.cos(rx), Math.sin(rx), -Math.cos(ry) * Math.cos(rx),
    )
    this.holePos.set(
      state.ship.position[0] + fwd.x * SPAWN_DIST * 0.6 + right.x * SPAWN_DIST * 0.8,
      state.ship.position[1],
      state.ship.position[2] + fwd.z * SPAWN_DIST * 0.6 + right.z * SPAWN_DIST * 0.8,
    )
    this.mesh.position.copy(this.holePos)
    this.scene.add(this.mesh)
    this.timer = 0
  }

  update(dt: number): void {
    this.timer += dt
    this.mesh.rotation.y += dt * 0.3

    const state  = this.room.getState()
    const shipPos = new Vector3(...state.ship.position as [number, number, number])
    const toHole  = this.holePos.clone().sub(shipPos)
    const dist    = toHole.length()

    // Gravitational pull (inverse square, capped at close range)
    const grav = Math.min(GRAVITY_COEFF / Math.max(dist * dist, 100), 8)
    const pull = toHole.normalize().multiplyScalar(grav * dt)
    const [vx, vy, vz] = state.ship.velocity

    // Destroy ship if too close
    if (dist < DESTROY_DIST) {
      this.room.setState({
        ship: { ...state.ship, hull: 0 },
      })
      return
    }

    this.room.setState({
      ship: {
        ...state.ship,
        velocity: [vx + pull.x, vy + pull.y, vz + pull.z],
      },
    })
  }

  onExit(): void {
    this.scene.remove(this.mesh)
  }

  getDistanceToShip(): number {
    const state = this.room.getState()
    const shipPos = new Vector3(...state.ship.position as [number, number, number])
    return this.holePos.distanceTo(shipPos)
  }

  isComplete(): boolean {
    return this.getDistanceToShip() > ESCAPE_DIST || this.timer > MAX_DURATION
  }
}
