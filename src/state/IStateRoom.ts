import type { GameState } from './GameState.js'

export type StateSubscriber = (state: GameState) => void

export interface IStateRoom {
  getState(): GameState
  setState(patch: Partial<GameState>): void
  subscribe(cb: StateSubscriber): () => void
}
