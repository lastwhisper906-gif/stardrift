import { Station } from './Station.js'
import type { StationHandler } from './StationHandler.js'
import type { StationInput } from '../input/InputTypes.js'
import type { GameState } from '../state/GameState.js'
import { VERTICAL } from '../tuning.js'

export const verticalHandler: StationHandler = {
  station: Station.Vertical,
  handle(input: StationInput, state: GameState): Partial<GameState> {
    const [vx, vy, vz] = state.ship.velocity
    return {
      ship: {
        ...state.ship,
        velocity: [vx, vy + input.payload.verticalDelta * VERTICAL.accel * input.dt, vz],
      },
    }
  },
}
