import {
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
} from 'three'
import type { IEvent } from './IEvent.js'
import type { IStateRoom } from '../state/IStateRoom.js'

const RADIUS = 4
const SPAWN_DIST = 120
const SPEED = 18         // m/s
const HIT_DIST = 6.5
const HIT_DAMAGE = 12
const HIT_COOLDOWN = 2.5 // s — prevents multi-hit per pass
const ESCAPE_DIST = 150  // asteroid flew past, event ends
const MAX_DURATION = 38  // s — safety timeout

export class AsteroidEvent implements IEvent {
  readonly id = 'asteroid'

  private mesh: Mesh | null = null
  private readonly pos = new Vector3()
  private readonly vel = new Vector3()
  private done = false
  private hitCooldown = 0
  private elapsed = 0
  private distToShip = Infinity

  constructor(
    private readonly scene: Scene,
    private readonly room: IStateRoom,
  ) {}

  onEnter(): void {
    this.done = false
    this.elapsed = 0
    this.hitCooldown = 0
    this.spawn()
  }

  private spawn(): void {
    const ship = this.room.getState().ship
    const [px, py, pz] = ship.position
    const [rx, ry] = ship.rotation

    // Forward vector of ship
    const fwd = new Vector3(
      -Math.sin(ry) * Math.cos(rx),
       Math.sin(rx),
      -Math.cos(ry) * Math.cos(rx),
    )

    // Spawn ahead of ship with random lateral scatter
    this.pos.set(
      px + fwd.x * SPAWN_DIST + (Math.random() - 0.5) * 35,
      py + fwd.y * SPAWN_DIST + (Math.random() - 0.5) * 18,
      pz + fwd.z * SPAWN_DIST + (Math.random() - 0.5) * 35,
    )

    // Aim at ship's current position
    const toShip = new Vector3(px - this.pos.x, py - this.pos.y, pz - this.pos.z).normalize()
    this.vel.copy(toShip).multiplyScalar(SPEED)

    if (this.mesh == null) {
      const geo = new IcosahedronGeometry(RADIUS, 2)
      const mat = new MeshStandardMaterial({ color: 0x887766, roughness: 0.95, metalness: 0.05 })
      this.mesh = new Mesh(geo, mat)
      this.scene.add(this.mesh)
    }
    this.mesh.position.copy(this.pos)
    this.mesh.visible = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.mesh == null) return

    this.hitCooldown = Math.max(0, this.hitCooldown - dt)

    // Tumble
    this.mesh.rotation.x += 0.28 * dt
    this.mesh.rotation.y += 0.36 * dt

    // Move
    this.pos.addScaledVector(this.vel, dt)
    this.mesh.position.copy(this.pos)

    const ship = this.room.getState().ship
    const shipPos = new Vector3(ship.position[0], ship.position[1], ship.position[2])
    this.distToShip = this.pos.distanceTo(shipPos)

    // Collision
    if (this.distToShip < HIT_DIST && this.hitCooldown <= 0) {
      const state = this.room.getState()
      this.room.setState({
        ship: { ...state.ship, hull: Math.max(0, state.ship.hull - HIT_DAMAGE) },
      })
      this.hitCooldown = HIT_COOLDOWN
      // Deflect asteroid away from ship
      const away = this.pos.clone().sub(shipPos).normalize()
      this.vel.copy(away).multiplyScalar(SPEED * 0.7)
    }

    if (this.distToShip > ESCAPE_DIST || this.elapsed > MAX_DURATION) {
      this.done = true
    }
  }

  onExit(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh)
      this.mesh.geometry.dispose()
      this.mesh = null
    }
  }

  isComplete(): boolean {
    return this.done
  }

  getDistanceToShip(): number {
    return this.distToShip
  }
}
