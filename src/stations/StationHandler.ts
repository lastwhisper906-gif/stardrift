import type { Station } from './Station.js'
import type { StationInput } from '../input/InputTypes.js'
import type { GameState } from '../state/GameState.js'

export interface StationHandler {
  readonly station: Station
  handle(input: StationInput, state: GameState): Partial<GameState>
}
