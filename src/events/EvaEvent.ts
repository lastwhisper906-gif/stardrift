import type { IEvent } from './IEvent.js'
import type { IStateRoom } from '../state/IStateRoom.js'

// EVA (Extra-Vehicular Activity) event — triggered when hull drops below 40%
// Player must leave the ship and make their way to the repair panel
// (Simplified: just a timed repair task with higher O2 drain)
const EVA_DURATION  = 25    // seconds to complete EVA repair
const O2_EVA_DRAIN  = 0.8   // %/s extra O2 drain during EVA (suit is working hard)
const HULL_REPAIR   = 45    // hull points restored when EVA completes

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
    const newO2  = Math.max(0, state.ship.oxygen - O2_EVA_DRAIN * dt)
    this.room.setState({ ship: { ...state.ship, oxygen: newO2 } })

    // Auto-complete after duration (simplified: the crew member fixed the hull)
    if (this.timer >= EVA_DURATION && !this.completed) {
      this.completed = true
      const s = this.room.getState()
      this.room.setState({
        ship: { ...s.ship, hull: Math.min(100, s.ship.hull + HULL_REPAIR) },
      })
    }
  }

  onExit(): void {}

  isComplete(): boolean {
    return this.completed || this.timer > EVA_DURATION + 5
  }

  getProgress(): number { return Math.min(1, this.timer / EVA_DURATION) }
}
