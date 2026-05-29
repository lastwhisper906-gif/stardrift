import type { ShipState } from '../state/GameState.js'

const DRAG = 0.92
const ANGULAR_DRAG = 0.85
const FORWARD_ACCEL = 4
const O2_IDLE_DRAIN  = 0.04   // %/s always
const O2_FLIGHT_DRAIN = 0.18  // %/s extra when engines running

export function updatePhysics(ship: ShipState, dt: number): ShipState {
  const [rx, ry, rz] = ship.rotation

  const fwd: [number, number, number] = [
    -Math.sin(ry) * Math.cos(rx),
    Math.sin(rx),
    -Math.cos(ry) * Math.cos(rx),
  ]

  const [vx, vy, vz] = ship.velocity
  const accel = ship.throttle * FORWARD_ACCEL
  const nextVel: [number, number, number] = [
    (vx + fwd[0] * accel * dt) * DRAG,
    (vy + fwd[1] * accel * dt) * DRAG,
    (vz + fwd[2] * accel * dt) * DRAG,
  ]

  const [px, py, pz] = ship.position
  const nextPos: [number, number, number] = [
    px + nextVel[0] * dt,
    py + nextVel[1] * dt,
    pz + nextVel[2] * dt,
  ]

  const [avx, avy, avz] = ship.angularVelocity
  const nextAV: [number, number, number] = [
    avx * ANGULAR_DRAG,
    avy * ANGULAR_DRAG,
    avz * ANGULAR_DRAG,
  ]

  const o2Drain = (O2_IDLE_DRAIN + (ship.throttle > 0.05 ? O2_FLIGHT_DRAIN : 0)) * dt
  const nextO2 = Math.max(0, ship.oxygen - o2Drain)

  return {
    ...ship,
    velocity:        nextVel,
    position:        nextPos,
    angularVelocity: nextAV,
    oxygen:          nextO2,
  }
}
