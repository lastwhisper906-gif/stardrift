import type { GameState } from './GameState.js'
import type { IStateRoom, StateSubscriber } from './IStateRoom.js'
import { createInitialGameState } from './GameState.js'

export class LocalRoom implements IStateRoom {
  private state: GameState
  private subscribers: Set<StateSubscriber> = new Set()

  constructor(initial?: GameState) {
    this.state = initial ?? createInitialGameState()
  }

  getState(): GameState {
    return this.state
  }

  setState(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch }
    for (const cb of this.subscribers) {
      cb(this.state)
    }
  }

  subscribe(cb: StateSubscriber): () => void {
    this.subscribers.add(cb)
    return () => { this.subscribers.delete(cb) }
  }
}
