import {
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
} from 'three'
import type { IEvent } from './IEvent.js'
import type { IStateRoom } from '../state/IStateRoom.js'
import { ASTEROID } from '../tuning.js'

const RADIUS = 4

export class AsteroidEvent implements IEvent {
  readonly id = 'asteroid'

  private mesh:  Mesh | null = null
  private mesh2: Mesh | null = null   // second asteroid (25% chance)
  private readonly pos  = new Vector3()
  private readonly vel  = new Vector3()
  private readonly pos2 = new Vector3()
  private readonly vel2 = new Vector3()
  private done         = false
  private hitCooldown  = 0
  private hit2Cooldown = 0
  private elapsed      = 0
  private distToShip   = Infinity

  constructor(
    private readonly scene: Scene,
    private readonly room: IStateRoom,
  ) {}

  onEnter(): void {
    this.done = false
    this.elapsed = 0
    this.hitCooldown = 0
    this.hit2Cooldown = 0
    this.spawn()
    // 30% chance of a second asteroid wing
    if (Math.random() < 0.30) this.spawnSecond()
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
      px + fwd.x * ASTEROID.spawnDist + (Math.random() - 0.5) * 35,
      py + fwd.y * ASTEROID.spawnDist + (Math.random() - 0.5) * 18,
      pz + fwd.z * ASTEROID.spawnDist + (Math.random() - 0.5) * 35,
    )

    // Aim at ship's current position
    const toShip = new Vector3(px - this.pos.x, py - this.pos.y, pz - this.pos.z).normalize()
    this.vel.copy(toShip).multiplyScalar(ASTEROID.speed)

    if (this.mesh == null) {
      const geo = new IcosahedronGeometry(RADIUS, 2)
      const mat = new MeshStandardMaterial({ color: 0x887766, roughness: 0.95, metalness: 0.05 })
      this.mesh = new Mesh(geo, mat)
      this.scene.add(this.mesh)
    }
    this.mesh.position.copy(this.pos)
    this.mesh.visible = true
  }

  private spawnSecond(): void {
    const ship = this.room.getState().ship
    const [px, py, pz] = ship.position
    const [rx, ry] = ship.rotation
    const fwd = new Vector3(
      -Math.sin(ry) * Math.cos(rx), Math.sin(rx), -Math.cos(ry) * Math.cos(rx),
    )
    this.pos2.set(
      px + fwd.x * ASTEROID.spawnDist * 0.9 + (Math.random() - 0.5) * 50,
      py + (Math.random() - 0.5) * 22,
      pz + fwd.z * ASTEROID.spawnDist * 0.9 + (Math.random() - 0.5) * 50,
    )
    const toShip = new Vector3(px - this.pos2.x, py - this.pos2.y, pz - this.pos2.z).normalize()
    this.vel2.copy(toShip).multiplyScalar(ASTEROID.speed * 0.8)
    const geo  = new IcosahedronGeometry(RADIUS * 0.65, 1)
    const mat2 = new MeshStandardMaterial({ color: 0x665544, roughness: 0.9, metalness: 0.08 })
    this.mesh2 = new Mesh(geo, mat2)
    this.scene.add(this.mesh2)
    this.mesh2.position.copy(this.pos2)
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
    if (this.distToShip < ASTEROID.hitDist && this.hitCooldown <= 0) {
      const state = this.room.getState()
      this.room.setState({
        ship: { ...state.ship, hull: Math.max(0, state.ship.hull - ASTEROID.hitDamage) },
      })
      this.hitCooldown = ASTEROID.hitCooldown
      // Deflect asteroid away from ship
      const away = this.pos.clone().sub(shipPos).normalize()
      this.vel.copy(away).multiplyScalar(ASTEROID.speed * 0.7)
    }

    // Second asteroid update
    if (this.mesh2 != null) {
      this.hit2Cooldown = Math.max(0, this.hit2Cooldown - dt)
      this.mesh2.rotation.x -= 0.22 * dt
      this.mesh2.rotation.z += 0.30 * dt
      this.pos2.addScaledVector(this.vel2, dt)
      this.mesh2.position.copy(this.pos2)
      const dist2 = this.pos2.distanceTo(shipPos)
      if (dist2 < ASTEROID.hitDist * 0.75 && this.hit2Cooldown <= 0) {
        const state2 = this.room.getState()
        this.room.setState({ ship: { ...state2.ship, hull: Math.max(0, state2.ship.hull - ASTEROID.hitDamage * 0.7) } })
        this.hit2Cooldown = ASTEROID.hitCooldown
        const away2 = this.pos2.clone().sub(shipPos).normalize()
        this.vel2.copy(away2).multiplyScalar(ASTEROID.speed * 0.6)
      }
      if (dist2 > ASTEROID.escapeDist) {
        this.scene.remove(this.mesh2)
        this.mesh2.geometry.dispose()
        this.mesh2 = null
      }
    }

    if (this.distToShip > ASTEROID.escapeDist || this.elapsed > ASTEROID.maxDuration) {
      this.done = true
    }
  }

  onExit(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh)
      this.mesh.geometry.dispose()
      this.mesh = null
    }
    if (this.mesh2) {
      this.scene.remove(this.mesh2)
      this.mesh2.geometry.dispose()
      this.mesh2 = null
    }
  }

  isComplete(): boolean {
    return this.done
  }

  getDistanceToShip(): number {
    return this.distToShip
  }
}
