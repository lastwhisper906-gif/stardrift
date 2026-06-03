import { Scene, Vector3 } from 'three'
import type { IEvent } from './IEvent.js'
import type { IStateRoom } from '../state/IStateRoom.js'
import { PlanetMesh, PLANET_RADIUS } from '../render/PlanetMesh.js'
import type { ResourceNode } from '../render/PlanetMesh.js'

export { PLANET_RADIUS }

const LAND_THRESHOLD = PLANET_RADIUS + 5   // distance for "near surface" prompt (after collision stops at +2)

export class PlanetEvent implements IEvent {
  readonly id = 'planet'

  readonly mesh: PlanetMesh
  private _center = new Vector3()
  private _complete = false

  constructor(
    private readonly scene: Scene,
    private readonly room: IStateRoom,
  ) {
    this.mesh = new PlanetMesh()
  }

  onEnter(): void {
    this._complete = false
    // Reset node collection state
    for (const node of this.mesh.nodes) {
      ;(node as { collected: boolean }).collected = false
      node.mesh.visible = true
    }

    // TEST: spawn planet 500m directly in front of ship (negative Z = ship forward)
    const state = this.room.getState()
    const [sx, sy, sz] = state.ship.position
    this._center.set(sx, sy, sz - 500)
    this.mesh.group.position.copy(this._center)
    this.mesh.updateWorldPositions()
    this.scene.add(this.mesh.group)
  }

  update(dt: number): void {
    this.mesh.update(dt)
  }

  onExit(): void {
    this.scene.remove(this.mesh.group)
  }

  isComplete(): boolean {
    return this._complete
  }

  // ── Public helpers used by main.ts ─────────────────────────────────────────

  getPlanetCenter(): Vector3 {
    return this._center
  }

  /** True when subship (or any world-space point) is within landing threshold */
  isNearSurface(worldPos: Vector3): boolean {
    return worldPos.distanceTo(this._center) < LAND_THRESHOLD
  }

  /** Nearest uncollected resource node within radius, or null */
  getNearestNode(charWorldPos: Vector3, radius: number): ResourceNode | null {
    let best: ResourceNode | null = null
    let bestDist = radius
    for (const node of this.mesh.nodes) {
      if (node.collected) continue
      const d = charWorldPos.distanceTo(node.worldPos)
      if (d < bestDist) { bestDist = d; best = node }
    }
    return best
  }

  /** Collect a node and hide it */
  collectNode(node: ResourceNode): void {
    this.mesh.collectNode(node)
  }

  /**
   * Scatter ore nodes around a landing spot so the player always has nearby
   * resources to mine. Call once when the disembark sequence finishes.
   */
  scatterNodesNear(landWorldPos: Vector3, count = 4): void {
    const up = landWorldPos.clone().sub(this._center).normalize()

    // Two tangent axes spanning the surface at the landing spot
    const arb = Math.abs(up.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
    const t1   = new Vector3().crossVectors(up, arb).normalize()
    const t2   = new Vector3().crossVectors(up, t1)

    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
      const radius = 8 + Math.random() * 18   // 8 – 26 m from landing spot
      const pos    = landWorldPos.clone()
        .addScaledVector(t1, Math.cos(angle) * radius)
        .addScaledVector(t2, Math.sin(angle) * radius)
      // Snap onto sphere surface
      const dir = pos.clone().sub(this._center).normalize()
      pos.copy(this._center).addScaledVector(dir, PLANET_RADIUS + 1.2)
      this.mesh.addNodeAt(pos)
    }
  }

  /** Called by main.ts after player lifts off */
  markComplete(): void {
    this._complete = true
  }
}
