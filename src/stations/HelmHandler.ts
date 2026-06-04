import { Station } from './Station.js'
import type { StationHandler } from './StationHandler.js'
import type { StationInput } from '../input/InputTypes.js'
import type { GameState } from '../state/GameState.js'
import { HELM } from '../tuning.js'

export const helmHandler: StationHandler = {
  station: Station.Helm,
  handle(input: StationInput, state: GameState): Partial<GameState> {
    const [rx, ry, rz] = state.ship.rotation
    const dt   = input.dt
    const p    = input.payload

    // Pitch: input drives it; when idle, decay toward 0 (no more endless spiral)
    const newRx = Math.abs(p.pitch) > 0.01
      ? rx + p.pitch * HELM.pitchSpeed * dt
      : rx * Math.pow(HELM.pitchLevelDecay, dt)

    // Yaw: continuous (no auto-level — turning left/right should stay)
    const newRy = ry + p.yaw * HELM.yawSpeed * dt

    // Roll: input drives it; when idle, slowly return to level
    const newRz = Math.abs(p.roll) > 0.01
      ? rz + p.roll * HELM.rollSpeed * dt
      : rz * Math.pow(HELM.rollLevelDecay, dt)

    return {
      ship: {
        ...state.ship,
        rotation: [
          Math.max(-1.2, Math.min(1.2, newRx)),
          newRy,
          Math.max(-1.2, Math.min(1.2, newRz)),
        ],
      },
    }
  },
}
