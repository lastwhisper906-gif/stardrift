import type { RawInput } from '../input/InputTypes.js'
import { SUBSHIP } from '../tuning.js'

export interface SubshipState {
  position: [number, number, number]
  velocity: [number, number, number]
  rotation: [number, number, number]   // [rx, ry, rz] euler YXZ
  throttle: number
}

export function createSubshipState(worldPos: [number, number, number]): SubshipState {
  return { position: worldPos, velocity: [0, 0, 0], rotation: [0, 0, 0], throttle: 0 }
}

export function updateSubship(state: SubshipState, input: RawInput, dt: number): SubshipState {
  const [rx, ry, rz] = state.rotation

  const newRx = Math.abs(input.pitch) > 0.01
    ? Math.max(-1.2, Math.min(1.2, rx + input.pitch * SUBSHIP.pitchSpeed * dt))
    : rx * Math.pow(0.25, dt)
  const newRy = ry + input.yaw * SUBSHIP.yawSpeed * dt
  const newRz = Math.abs(input.roll) > 0.01
    ? Math.max(-1.2, Math.min(1.2, rz + input.roll * SUBSHIP.rollSpeed * dt))
    : rz * Math.pow(0.15, dt)

  const throttle = input.boost
    ? 5
    : Math.abs(input.throttleDelta) > 0.01
      ? Math.max(-2, Math.min(5, state.throttle + input.throttleDelta * SUBSHIP.throttleRate * dt))
      : Math.max(0, state.throttle - 10 * dt)

  const fwd: [number, number, number] = [
    -Math.sin(newRy) * Math.cos(newRx),
    Math.sin(newRx),
    -Math.cos(newRy) * Math.cos(newRx),
  ]

  const accel = throttle * SUBSHIP.forwardAccel
  const drag  = Math.pow(SUBSHIP.dragPerSec, dt)
  const [vx, vy, vz] = state.velocity

  const nextVel: [number, number, number] = [
    (vx + fwd[0] * accel * dt) * drag,
    (vy + fwd[1] * accel * dt + input.verticalDelta * SUBSHIP.verticalAccel * dt) * drag,
    (vz + fwd[2] * accel * dt) * drag,
  ]

  const [px, py, pz] = state.position
  return {
    position: [px + nextVel[0] * dt, py + nextVel[1] * dt, pz + nextVel[2] * dt],
    velocity: nextVel,
    rotation: [newRx, newRy, newRz],
    throttle,
  }
}
