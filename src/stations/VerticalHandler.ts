import { Station } from './Station.js'
import type { StationHandler } from './StationHandler.js'
import type { StationInput } from '../input/InputTypes.js'
import type { GameState } from '../state/GameState.js'

const VERTICAL_SPEED = 3

export const verticalHandler: StationHandler = {
  station: Station.Vertical,
  handle(input: StationInput, state: GameState): Partial<GameState> {
    const [vx, vy, vz] = state.ship.velocity
    return {
      ship: {
        ...state.ship,
        velocity: [vx, vy + input.payload.verticalDelta * VERTICAL_SPEED, vz],
      },
    }
  },
}
