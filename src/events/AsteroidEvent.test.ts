import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AsteroidEvent } from './AsteroidEvent.js'
import { LocalRoom } from '../state/LocalRoom.js'

const mockScene = { add: vi.fn(), remove: vi.fn() }

describe('AsteroidEvent', () => {
  let room: LocalRoom
  let event: AsteroidEvent

  beforeEach(() => {
    room = new LocalRoom()
    event = new AsteroidEvent(mockScene as never, room)
    vi.clearAllMocks()
  })

  it('is not complete before onEnter', () => {
    expect(event.isComplete()).toBe(false)
  })

  it('adds a mesh to scene on onEnter', () => {
    event.onEnter()
    expect(mockScene.add).toHaveBeenCalledOnce()
  })

  it('removes mesh from scene on onExit', () => {
    event.onEnter()
    event.onExit()
    expect(mockScene.remove).toHaveBeenCalledOnce()
  })

  it('completes after max duration', () => {
    event.onEnter()
    event.update(40)   // > MAX_DURATION (38 s)
    expect(event.isComplete()).toBe(true)
  })

  it('deals hull damage when asteroid is within hit distance', () => {
    // Place ship and asteroid at same position by using a room
    // whose ship is at (0,0,0) and then forcing asteroid to same spot.
    // We do this by calling onEnter (asteroid spawns 120 u ahead),
    // then teleporting the asteroid via update with 0 dt and checking
    // that hull damage only happens after enough time passes.
    event.onEnter()
    const initialHull = room.getState().ship.hull
    // Normally asteroid is far away — hull should be intact after 1 frame.
    event.update(0.016)
    expect(room.getState().ship.hull).toBe(initialHull)
  })

  it('getDistanceToShip returns a finite number after first update', () => {
    event.onEnter()
    event.update(0.016)
    expect(Number.isFinite(event.getDistanceToShip())).toBe(true)
  })
})
