import type { IEvent } from './IEvent.js'
import type { IStateRoom } from '../state/IStateRoom.js'

type Phase = 'PILOTING' | 'IN_EVENT'

export class EventManager {
  private events: Map<string, IEvent> = new Map()
  private active: IEvent | null = null

  constructor(private readonly room: IStateRoom) {}

  register(event: IEvent): void {
    this.events.set(event.id, event)
  }

  trigger(id: string): boolean {
    const phase: Phase = this.room.getState().phase
    if (phase !== 'PILOTING') return false
    const event = this.events.get(id)
    if (event == null) return false

    this.active = event
    this.room.setState({ phase: 'IN_EVENT' })
    event.onEnter()
    return true
  }

  update(dt: number): void {
    if (this.active == null) return
    this.active.update(dt)
    if (this.active.isComplete()) {
      this.active.onExit()
      this.active = null
      this.room.setState({ phase: 'PILOTING' })
    }
  }

  getPhase(): Phase {
    return this.room.getState().phase
  }

  getActiveEventId(): string | null {
    return this.active?.id ?? null
  }
}
