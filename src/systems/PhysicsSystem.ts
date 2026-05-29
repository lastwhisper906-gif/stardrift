import type { ShipState } from '../state/GameState.js'

const DRAG = 0.92
const ANGULAR_DRAG = 0.85
const FORWARD_ACCEL = 4

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

  return {
    ...ship,
    velocity: nextVel,
    position: nextPos,
    angularVelocity: nextAV,
  }
}
