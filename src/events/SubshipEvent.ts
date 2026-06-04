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
import { PROBE } from '../tuning.js'

export class SubshipEvent implements IEvent {
  readonly id = 'subship'

  private readonly mesh: Group
  private readonly probePos = new Vector3()
  private timer    = 0
  private phase: 'deploy' | 'patrol' | 'return' = 'deploy'
  private patrolAngle = 0

  constructor(
    private readonly scene: Scene,
    private readonly room: IStateRoom,
  ) {
    this.mesh = this.buildMesh()
  }

  private buildMesh(): Group {
    const g   = new Group()
    const hull = new MeshStandardMaterial({ color: 0x1a2240, metalness: 0.8, roughness: 0.2 })
    const glow = new MeshStandardMaterial({ color: 0x001133, emissive: 0x004488, emissiveIntensity: 1.0 })
    const eng  = new MeshStandardMaterial({ color: 0x001a1a, emissive: 0x00aacc, emissiveIntensity: 0.9 })

    const b = (w: number, h: number, d: number, m: MeshStandardMaterial, x: number, y: number, z: number) => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), m)
      mesh.position.set(x, y, z)
      g.add(mesh)
    }

    // Fuselage (small scout)
    b(2.0, 0.8, 5.5, hull, 0, 0, 0)
    b(1.2, 0.5, 3.0, hull, 0, 0.3, -1.0)  // cockpit bump

    // Cockpit window
    b(0.9, 0.3, 0.6, glow, 0, 0.6, -2.0)

    // Wings
    for (const sx of [-1, 1] as const) {
      b(2.8, 0.15, 2.0, hull, sx * 2.2, 0, 0.5)
    }

    // Engines
    for (const sx of [-1, 1] as const) {
      b(0.5, 0.5, 1.0, hull, sx * 1.0, -0.2, 2.5)
      b(0.35, 0.35, 0.2, eng, sx * 1.0, -0.2, 3.1)
    }

    // Engine glow
    const light = new PointLight(0x00aacc, 1.0, 12)
    light.position.set(0, -0.2, 3.2)
    g.add(light)

    return g
  }

  onEnter(): void {
    const state = this.room.getState()
    this.probePos.set(...state.ship.position as [number, number, number])
    this.mesh.position.copy(this.probePos)
    this.scene.add(this.mesh)
    this.timer      = 0
    this.phase      = 'deploy'
    this.patrolAngle = 0
  }

  update(dt: number): void {
    this.timer += dt

    const state   = this.room.getState()
    const shipPos = new Vector3(...state.ship.position as [number, number, number])

    if (this.phase === 'deploy') {
      // Fly out to patrol radius
      const targetPos = shipPos.clone().add(new Vector3(PROBE.patrolRadius, 8, 0))
      const dir = targetPos.clone().sub(this.probePos).normalize()
      this.probePos.addScaledVector(dir, PROBE.patrolSpeed * dt)
      if (this.probePos.distanceTo(targetPos) < 5) this.phase = 'patrol'
    } else if (this.phase === 'patrol') {
      // Circle around the ship
      this.patrolAngle += dt * 0.6
      this.probePos.set(
        shipPos.x + Math.cos(this.patrolAngle) * PROBE.patrolRadius,
        shipPos.y + 8,
        shipPos.z + Math.sin(this.patrolAngle) * PROBE.patrolRadius,
      )
      if (this.timer > PROBE.deployDuration) this.phase = 'return'
    } else {
      // Return to ship
      const dir = shipPos.clone().sub(this.probePos).normalize()
      this.probePos.addScaledVector(dir, PROBE.patrolSpeed * 1.5 * dt)
    }

    this.mesh.position.copy(this.probePos)
    this.mesh.lookAt(shipPos)

    // Slowly rotate around own Y axis for dramatic effect
    this.mesh.rotation.y += dt * 0.4
  }

  onExit(): void {
    this.scene.remove(this.mesh)
  }

  isComplete(): boolean {
    if (this.phase !== 'return') return false
    const state   = this.room.getState()
    const shipPos = new Vector3(...state.ship.position as [number, number, number])
    return this.probePos.distanceTo(shipPos) < 8
  }
}
