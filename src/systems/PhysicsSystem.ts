import type { ShipState } from '../state/GameState.js'
import { PHYSICS } from '../tuning.js'

export function updatePhysics(ship: ShipState, dt: number): ShipState {
  const [rx, ry, rz] = ship.rotation

  const fwd: [number, number, number] = [
    -Math.sin(ry) * Math.cos(rx),
    Math.sin(rx),
    -Math.cos(ry) * Math.cos(rx),
  ]

  const [vx, vy, vz] = ship.velocity
  const accel = ship.throttle * PHYSICS.forwardAccel
  const drag = Math.pow(PHYSICS.dragPerSec, dt)
  const nextVel: [number, number, number] = [
    (vx + fwd[0] * accel * dt) * drag,
    (vy + fwd[1] * accel * dt) * drag,
    (vz + fwd[2] * accel * dt) * drag,
  ]

  const [px, py, pz] = ship.position
  const nextPos: [number, number, number] = [
    px + nextVel[0] * dt,
    py + nextVel[1] * dt,
    pz + nextVel[2] * dt,
  ]

  const [avx, avy, avz] = ship.angularVelocity
  const angDrag = Math.pow(PHYSICS.angularDragPerSec, dt)
  const nextAV: [number, number, number] = [
    avx * angDrag,
    avy * angDrag,
    avz * angDrag,
  ]

  const o2Drain = (PHYSICS.o2IdleDrain + (ship.throttle > 0.05 ? PHYSICS.o2FlightDrain : 0)) * dt
  const nextO2 = Math.max(0, ship.oxygen - o2Drain)

  return {
    ...ship,
    velocity:        nextVel,
    position:        nextPos,
    angularVelocity: nextAV,
    oxygen:          nextO2,
  }
}
