import { Station } from './Station.js'
import type { StationHandler } from './StationHandler.js'
import type { StationInput } from '../input/InputTypes.js'
import type { GameState } from '../state/GameState.js'

const THROTTLE_RATE  = 12.0   // units/s for W key
const THROTTLE_DECAY = 10.0   // units/s drop when no input (0→5 clears in 0.5s)
const MAX_THROTTLE   = 5
const MIN_THROTTLE   = -2

export const throttleHandler: StationHandler = {
  station: Station.Throttle,
  handle(input: StationInput, state: GameState): Partial<GameState> {
    const { boost, throttleDelta } = input.payload

    let next: number
    if (boost) {
      // Space held: instant max thrust
      next = MAX_THROTTLE
    } else if (Math.abs(throttleDelta) > 0.01) {
      // W/S: gradual manual control
      next = Math.max(MIN_THROTTLE, Math.min(MAX_THROTTLE,
        state.ship.throttle + throttleDelta * THROTTLE_RATE * input.dt))
    } else {
      // No input: throttle decays toward 0
      const sign = state.ship.throttle > 0 ? -1 : 1
      next = state.ship.throttle + sign * THROTTLE_DECAY * input.dt
      if (Math.abs(next) < 0.05) next = 0
    }

    return { ship: { ...state.ship, throttle: next } }
  },
}
