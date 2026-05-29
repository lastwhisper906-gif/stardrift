import { Station } from './Station.js'
import type { StationHandler } from './StationHandler.js'
import type { StationInput } from '../input/InputTypes.js'
import type { GameState } from '../state/GameState.js'

const YAW_SPEED = 1.2
const PITCH_SPEED = 1.0

export const helmHandler: StationHandler = {
  station: Station.Helm,
  handle(input: StationInput, state: GameState): Partial<GameState> {
    const [rx, ry, rz] = state.ship.rotation
    return {
      ship: {
        ...state.ship,
        rotation: [
          rx + input.payload.pitch * PITCH_SPEED,
          ry + input.payload.yaw * YAW_SPEED,
          rz + input.payload.roll * 0.8,
        ],
      },
    }
  },
}
