import type { Station } from '../stations/Station.js'
import type { RawInput, StationInput } from './InputTypes.js'
import type { StationHandler } from '../stations/StationHandler.js'
import type { GameState } from '../state/GameState.js'

export class InputRouter {
  private mapping: Map<string, Station[]> = new Map()
  private handlers: Map<Station, StationHandler> = new Map()

  registerHandler(handler: StationHandler): void {
    this.handlers.set(handler.station, handler)
  }

  assignStations(playerId: string, stations: Station[]): void {
    this.mapping.set(playerId, [...stations])
  }

  getStations(playerId: string): Station[] {
    return this.mapping.get(playerId) ?? []
  }

  dispatch(playerId: string, raw: RawInput, state: GameState): GameState {
    const stations = this.mapping.get(playerId) ?? []
    let current = state
    for (const station of stations) {
      const handler = this.handlers.get(station)
      if (handler == null) continue
      const input: StationInput = { station, payload: raw }
      const patch = handler.handle(input, current)
      current = { ...current, ...patch }
    }
    return current
  }
}
