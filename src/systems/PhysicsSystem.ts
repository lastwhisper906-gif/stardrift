import type { ShipState } from '../state/GameState.js'

const DRAG_PER_SEC         = 0.08   // 92% velocity decay per second (was per-frame 0.92)
const ANGULAR_DRAG_PER_SEC = 0.15   // angular decay per second
const FORWARD_ACCEL        = 12     // was 4 — tripled for noticeable movement
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
  const drag = Math.pow(DRAG_PER_SEC, dt)
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
  const angDrag = Math.pow(ANGULAR_DRAG_PER_SEC, dt)
  const nextAV: [number, number, number] = [
    avx * angDrag,
    avy * angDrag,
    avz * angDrag,
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
