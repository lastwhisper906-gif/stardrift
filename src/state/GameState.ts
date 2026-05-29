import type { Vector3Tuple, EulerTuple } from '../types/math.js'

export interface ShipState {
  position: Vector3Tuple
  rotation: EulerTuple
  velocity: Vector3Tuple
  angularVelocity: Vector3Tuple
  throttle: number
  oxygen: number
  hull: number
}

export type GamePhase = 'PILOTING' | 'IN_EVENT'

export interface GameState {
  ship: ShipState
  phase: GamePhase
  tick: number
}

export function createInitialGameState(): GameState {
  return {
    ship: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      throttle: 0,
      oxygen: 100,
      hull: 100,
    },
    phase: 'PILOTING',
    tick: 0,
  }
}
