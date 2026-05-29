import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Scene,
  Vector3,
} from 'three'
import type { IEvent } from './IEvent.js'
import type { IStateRoom } from '../state/IStateRoom.js'

function alienMat(color: number, emissive = 0, ei = 0): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.5, emissive, emissiveIntensity: ei })
}

const SPAWN_DIST   = 200
const APPROACH_SPEED = 14   // m/s
const SHOOT_RANGE  = 90     // m, alien starts shooting
const SHOOT_DMGM   = 10     // damage per shot
const SHOOT_INTERVAL = 5    // seconds between shots
const RAM_DIST     = 14     // m, ram damage threshold
const RAM_DMG      = 25
const MAX_DURATION = 55     // seconds before alien retreats

export class AlienEvent implements IEvent {
  readonly id = 'alien'

  private readonly mesh: Group
  private readonly alienPos = new Vector3()
  private alienHealth   = 4
  private timer         = 0
  private shootTimer    = 0
  private ramCooldown   = 0
  private phase: 'approach' | 'retreat' | 'exploding' = 'approach'
  private explodeTimer  = 0
  private readonly explosionLight: PointLight

  constructor(
    private readonly scene: Scene,
    private readonly room: IStateRoom,
  ) {
    this.mesh           = this.buildMesh()
    this.explosionLight = new PointLight(0xff8800, 0, 80)
  }

  private buildMesh(): Group {
    const g = new Group()
    const hull = alienMat(0x0a1a08, 0x002800, 0.15)
    const glow = alienMat(0x001a00, 0x00ff44, 1.0)
    const dark = alienMat(0x050c04, 0x000000, 0)

    const box = (w: number, h: number, d: number, m: MeshStandardMaterial, x: number, y: number, z: number) => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z)
      g.add(mesh)
    }

    // Saucer main body
    box(14.0, 1.8, 14.0, hull,  0,  0, 0)
    box( 8.0, 2.8,  8.0, hull,  0,  0, 0)
    box( 4.0, 3.8,  4.0, hull,  0,  0.5, 0)

    // Central dome
    box(3.5, 1.5, 3.5, alienMat(0x103010, 0x00cc33, 0.6), 0, 2.0, 0)

    // Underside weapon pod
    box(2.0, 1.2, 2.0, dark, 0, -1.6, 0)
    // Weapon glow
    box(1.0, 0.4, 1.0, glow, 0, -2.2, 0)

    // Rim glow strip
    for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rad = (angle * Math.PI) / 180
      const rx = Math.sin(rad) * 6.5
      const rz = Math.cos(rad) * 6.5
      box(1.0, 0.2, 1.0, glow, rx, -0.5, rz)
    }

    // Swept fins (3 fins)
    for (let i = 0; i < 3; i++) {
      const a = (i * 120 * Math.PI) / 180
      const fin = new Mesh(new BoxGeometry(6.0, 0.18, 1.2), hull)
      fin.position.set(Math.sin(a) * 5, -0.7, Math.cos(a) * 5)
      fin.rotation.y = a
      g.add(fin)
    }

    return g
  }

  onEnter(): void {
    const state = this.room.getState()
    const [rx, ry] = state.ship.rotation
    const fwd = new Vector3(
      -Math.sin(ry) * Math.cos(rx),
      Math.sin(rx),
      -Math.cos(ry) * Math.cos(rx),
    )
    this.alienPos.set(
      state.ship.position[0] + fwd.x * SPAWN_DIST,
      state.ship.position[1],
      state.ship.position[2] + fwd.z * SPAWN_DIST,
    )
    this.mesh.position.copy(this.alienPos)
    this.scene.add(this.mesh)
    this.scene.add(this.explosionLight)
    this.alienHealth  = 4
    this.timer        = 0
    this.shootTimer   = SHOOT_INTERVAL * 0.5
    this.ramCooldown  = 0
    this.phase        = 'approach'
  }

  update(dt: number): void {
    this.timer      += dt
    this.shootTimer -= dt
    this.ramCooldown = Math.max(0, this.ramCooldown - dt)

    const state    = this.room.getState()
    const shipPos  = new Vector3(...state.ship.position as [number, number, number])
    const dist     = this.alienPos.distanceTo(shipPos)
    const toShip   = shipPos.clone().sub(this.alienPos).normalize()

    if (this.phase === 'approach') {
      // Orbit when close enough, ram otherwise
      if (dist > RAM_DIST + 5) {
        this.alienPos.addScaledVector(toShip, APPROACH_SPEED * dt)
      }
    } else {
      // Retreat
      this.alienPos.addScaledVector(toShip, -APPROACH_SPEED * 1.5 * dt)
    }

    this.mesh.position.copy(this.alienPos)
    this.mesh.lookAt(shipPos)
    // Slow spin
    this.mesh.rotation.y += dt * 0.4

    // Shoot at ship when in range
    if (dist < SHOOT_RANGE && this.shootTimer <= 0) {
      this.shootTimer = SHOOT_INTERVAL
      const newHull = Math.max(0, state.ship.hull - SHOOT_DMGM)
      this.room.setState({ ship: { ...state.ship, hull: newHull } })
    }

    // Ram damage
    if (dist < RAM_DIST && this.ramCooldown <= 0) {
      this.ramCooldown = 3
      const newHull = Math.max(0, state.ship.hull - RAM_DMG)
      this.room.setState({ ship: { ...state.ship, hull: newHull } })
    }

    // Explosion animation
    if (this.phase === 'exploding') {
      this.explodeTimer -= dt
      this.explosionLight.intensity = Math.max(0, this.explodeTimer / 0.8) * 20
      this.explosionLight.position.copy(this.alienPos)
      this.mesh.visible = this.explodeTimer > 0.4
      return
    }

    // Retreat if timer exceeded
    if (this.timer > MAX_DURATION) this.phase = 'retreat'
  }

  /** Called when player fires weapons (Space in piloting mode) */
  shoot(shipPos: Vector3, shipForward: Vector3): boolean {
    const dist    = this.alienPos.distanceTo(shipPos)
    const toAlien = this.alienPos.clone().sub(shipPos).normalize()
    const aim     = shipForward.dot(toAlien)
    if (aim > 0.65 && dist < 120) {
      this.alienHealth--
      if (this.alienHealth <= 0) {
        this.phase        = 'exploding'
        this.explodeTimer = 0.8
        this.explosionLight.position.copy(this.alienPos)
      }
      return true
    }
    return false
  }

  getDistanceToShip(): number {
    const state = this.room.getState()
    const shipPos = new Vector3(...state.ship.position as [number, number, number])
    return this.alienPos.distanceTo(shipPos)
  }

  getHealth(): number { return this.alienHealth }

  onExit(): void {
    this.scene.remove(this.mesh)
    this.scene.remove(this.explosionLight)
    this.explosionLight.intensity = 0
  }

  isComplete(): boolean {
    if (this.phase === 'exploding') return this.explodeTimer <= 0
    if (this.alienHealth <= 0)  return true
    if (this.phase === 'retreat' && this.getDistanceToShip() > SPAWN_DIST) return true
    return false
  }
}
