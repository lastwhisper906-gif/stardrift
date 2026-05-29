import { describe, it, expect, beforeEach } from 'vitest'
import { InputRouter } from './InputRouter.js'
import { Station } from '../stations/Station.js'
import { helmHandler } from '../stations/HelmHandler.js'
import { throttleHandler } from '../stations/ThrottleHandler.js'
import { createInitialGameState } from '../state/GameState.js'
import type { RawInput } from './InputTypes.js'

const ZERO_INPUT: RawInput = { yaw: 0, pitch: 0, roll: 0, throttleDelta: 0, verticalDelta: 0 }
const DT = 0.016

describe('InputRouter', () => {
  let router: InputRouter

  beforeEach(() => {
    router = new InputRouter()
    router.registerHandler(helmHandler)
    router.registerHandler(throttleHandler)
  })

  it('assigns stations to a player', () => {
    router.assignStations('p1', [Station.Helm, Station.Throttle])
    expect(router.getStations('p1')).toEqual([Station.Helm, Station.Throttle])
  })

  it('returns empty stations for unknown player', () => {
    expect(router.getStations('unknown')).toEqual([])
  })

  it('dispatches yaw input through HelmHandler', () => {
    router.assignStations('p1', [Station.Helm])
    const state = createInitialGameState()
    const result = router.dispatch('p1', { ...ZERO_INPUT, yaw: 1 }, state, DT)
    expect(result.ship.rotation[1]).toBeGreaterThan(0)
  })

  it('dispatches throttle input through ThrottleHandler', () => {
    router.assignStations('p1', [Station.Throttle])
    const state = createInitialGameState()
    const result = router.dispatch('p1', { ...ZERO_INPUT, throttleDelta: 1 }, state, DT)
    expect(result.ship.throttle).toBeGreaterThan(0)
  })

  it('game logic does not access player mapping', () => {
    router.assignStations('p1', [Station.Helm])
    const state = createInitialGameState()
    const result = router.dispatch('p1', ZERO_INPUT, state, DT)
    expect(result.ship.rotation).toEqual([0, 0, 0])
  })
})
