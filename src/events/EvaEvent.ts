import type { IEvent } from './IEvent.js'
import type { IStateRoom } from '../state/IStateRoom.js'
import { EVA } from '../tuning.js'

export class EvaEvent implements IEvent {
  readonly id = 'eva'

  private timer        = 0
  private completed    = false

  constructor(private readonly room: IStateRoom) {}

  onEnter(): void {
    this.timer     = 0
    this.completed = false
  }

  update(dt: number): void {
    this.timer += dt
    // Drain extra O2 during EVA
    const state  = this.room.getState()
    const newO2  = Math.max(0, state.ship.oxygen - EVA.o2Drain * dt)
    this.room.setState({ ship: { ...state.ship, oxygen: newO2 } })

    // Auto-complete after duration (simplified: the crew member fixed the hull)
    if (this.timer >= EVA.duration && !this.completed) {
      this.completed = true
      const s = this.room.getState()
      this.room.setState({
        ship: { ...s.ship, hull: Math.min(100, s.ship.hull + EVA.hullRepair) },
      })
    }
  }

  onExit(): void {}

  isComplete(): boolean {
    return this.completed || this.timer > EVA.duration + 5
  }

  getProgress(): number { return Math.min(1, this.timer / EVA.duration) }
}
