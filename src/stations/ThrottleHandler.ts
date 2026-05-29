import { Station } from './Station.js'
import type { StationHandler } from './StationHandler.js'
import type { StationInput } from '../input/InputTypes.js'
import type { GameState } from '../state/GameState.js'

const THROTTLE_RATE = 0.8
const MAX_THROTTLE = 5
const MIN_THROTTLE = -2

export const throttleHandler: StationHandler = {
  station: Station.Throttle,
  handle(input: StationInput, state: GameState): Partial<GameState> {
    const next = Math.max(
      MIN_THROTTLE,
      Math.min(MAX_THROTTLE, state.ship.throttle + input.payload.throttleDelta * THROTTLE_RATE),
    )
    return {
      ship: { ...state.ship, throttle: next },
    }
  },
}
