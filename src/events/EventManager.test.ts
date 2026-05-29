import { describe, it, expect, vi } from 'vitest'
import { EventManager } from './EventManager.js'
import { LocalRoom } from '../state/LocalRoom.js'
import type { IEvent } from './IEvent.js'

function makeMockEvent(id: string, completeAfter = 1): IEvent {
  let calls = 0
  return {
    id,
    onEnter: vi.fn(),
    update: vi.fn(() => { calls++ }),
    onExit: vi.fn(),
    isComplete: () => calls >= completeAfter,
  }
}

describe('EventManager', () => {
  it('starts in PILOTING phase', () => {
    const room = new LocalRoom()
    const em = new EventManager(room)
    expect(em.getPhase()).toBe('PILOTING')
  })

  it('transitions to IN_EVENT when trigger succeeds', () => {
    const room = new LocalRoom()
    const em = new EventManager(room)
    const event = makeMockEvent('asteroid', 999)
    em.register(event)
    expect(em.trigger('asteroid')).toBe(true)
    expect(em.getPhase()).toBe('IN_EVENT')
    expect(em.getActiveEventId()).toBe('asteroid')
  })

  it('rejects trigger when IN_EVENT', () => {
    const room = new LocalRoom()
    const em = new EventManager(room)
    em.register(makeMockEvent('a', 999))
    em.register(makeMockEvent('b', 999))
    em.trigger('a')
    expect(em.trigger('b')).toBe(false)
  })

  it('returns to PILOTING after event completes', () => {
    const room = new LocalRoom()
    const em = new EventManager(room)
    const event = makeMockEvent('asteroid', 1)
    em.register(event)
    em.trigger('asteroid')
    em.update(0.016)
    expect(em.getPhase()).toBe('PILOTING')
    expect(em.getActiveEventId()).toBe(null)
  })
})
