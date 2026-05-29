import type { RawInput } from './InputTypes.js'

export class KeyboardInput {
  private readonly keys: Record<string, boolean> = {}
  private readonly justPressedKeys = new Set<string>()

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this.justPressedKeys.add(e.code)
      this.keys[e.code] = true
    })
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false
    })
  }

  /** PILOTING mode: W/S=throttle, A/D=yaw, Q/E=roll, R/F=pitch, Z/X=vertical thrust */
  getPilotInput(): RawInput {
    const k = this.keys
    return {
      yaw:           (k['KeyA'] || k['ArrowLeft']  ? -1 : 0) + (k['KeyD'] || k['ArrowRight'] ? 1 : 0),
      pitch:         (k['KeyR'] ? -1 : 0) + (k['KeyF'] ? 1 : 0),
      roll:          (k['KeyQ'] ? -1 : 0) + (k['KeyE'] ? 1 : 0),
      throttleDelta: (k['KeyW'] || k['ArrowUp']    ?  1 : 0) + (k['KeyS'] || k['ArrowDown']  ? -1 : 0),
      verticalDelta: (k['KeyZ'] ?  1 : 0) + (k['KeyX'] ? -1 : 0),
    }
  }

  /** WALKING mode: W/S=forward/back, A/D=strafe, Shift=run */
  getWalkAxes(): { fwd: number; right: number; isRunning: boolean } {
    const k = this.keys
    return {
      fwd:       (k['KeyW'] || k['ArrowUp']    ? 1 : 0) + (k['KeyS'] || k['ArrowDown']  ? -1 : 0),
      right:     (k['KeyD'] || k['ArrowRight'] ? 1 : 0) + (k['KeyA'] || k['ArrowLeft']  ? -1 : 0),
      isRunning: !!(k['ShiftLeft'] || k['ShiftRight']),
    }
  }

  /** Returns true once per key press; clears the flag. */
  consumeJustPressed(code: string): boolean {
    if (this.justPressedKeys.has(code)) {
      this.justPressedKeys.delete(code)
      return true
    }
    return false
  }
}
