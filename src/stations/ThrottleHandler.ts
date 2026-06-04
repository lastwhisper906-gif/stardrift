import { Station } from './Station.js'
import type { StationHandler } from './StationHandler.js'
import type { StationInput } from '../input/InputTypes.js'
import type { GameState } from '../state/GameState.js'
import { THROTTLE } from '../tuning.js'

export const throttleHandler: StationHandler = {
  station: Station.Throttle,
  handle(input: StationInput, state: GameState): Partial<GameState> {
    const { boost, throttleDelta } = input.payload

    let next: number
    if (boost) {
      // Space held: instant max thrust
      next = THROTTLE.max
    } else if (Math.abs(throttleDelta) > 0.01) {
      // W/S: gradual manual control
      next = Math.max(THROTTLE.min, Math.min(THROTTLE.max,
        state.ship.throttle + throttleDelta * THROTTLE.rate * input.dt))
    } else {
      // No input: throttle decays toward 0
      const sign = state.ship.throttle > 0 ? -1 : 1
      next = state.ship.throttle + sign * THROTTLE.decay * input.dt
      if (Math.abs(next) < 0.05) next = 0
    }

    return { ship: { ...state.ship, throttle: next } }
  },
}
