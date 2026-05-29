import { Station } from './Station.js'
import type { StationHandler } from './StationHandler.js'
import type { StationInput } from '../input/InputTypes.js'
import type { GameState } from '../state/GameState.js'

const YAW_SPEED   = 1.5   // rad/s
const PITCH_SPEED = 1.0   // rad/s
const ROLL_SPEED  = 0.8   // rad/s

// Auto-level: when no input, pitch and roll gently return to 0.
// 0.25 means 75% decay per second — settles to near-zero in ~3 seconds.
const PITCH_LEVEL_DECAY = 0.25
const ROLL_LEVEL_DECAY  = 0.15

export const helmHandler: StationHandler = {
  station: Station.Helm,
  handle(input: StationInput, state: GameState): Partial<GameState> {
    const [rx, ry, rz] = state.ship.rotation
    const dt   = input.dt
    const p    = input.payload

    // Pitch: input drives it; when idle, decay toward 0 (no more endless spiral)
    const newRx = Math.abs(p.pitch) > 0.01
      ? rx + p.pitch * PITCH_SPEED * dt
      : rx * Math.pow(PITCH_LEVEL_DECAY, dt)

    // Yaw: continuous (no auto-level — turning left/right should stay)
    const newRy = ry + p.yaw * YAW_SPEED * dt

    // Roll: input drives it; when idle, slowly return to level
    const newRz = Math.abs(p.roll) > 0.01
      ? rz + p.roll * ROLL_SPEED * dt
      : rz * Math.pow(ROLL_LEVEL_DECAY, dt)

    return {
      ship: {
        ...state.ship,
        rotation: [
          Math.max(-1.2, Math.min(1.2, newRx)),
          newRy,
          Math.max(-1.2, Math.min(1.2, newRz)),
        ],
      },
    }
  },
}
