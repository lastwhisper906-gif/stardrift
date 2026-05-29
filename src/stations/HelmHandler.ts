import { Station } from './Station.js'
import type { StationHandler } from './StationHandler.js'
import type { StationInput } from '../input/InputTypes.js'
import type { GameState } from '../state/GameState.js'

const YAW_SPEED = 1.5    // rad/s
const PITCH_SPEED = 1.0  // rad/s
const ROLL_SPEED = 0.8   // rad/s

export const helmHandler: StationHandler = {
  station: Station.Helm,
  handle(input: StationInput, state: GameState): Partial<GameState> {
    const [rx, ry, rz] = state.ship.rotation
    const dt = input.dt
    return {
      ship: {
        ...state.ship,
        rotation: [
          Math.max(-1.2, Math.min(1.2, rx + input.payload.pitch * PITCH_SPEED * dt)),
          ry + input.payload.yaw * YAW_SPEED * dt,
          rz + input.payload.roll * ROLL_SPEED * dt,
        ],
      },
    }
  },
}
