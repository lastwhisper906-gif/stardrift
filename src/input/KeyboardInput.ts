import type { RawInput } from './InputTypes.js'

export class KeyboardInput {
  private readonly keys: Record<string, boolean> = {}
  private readonly justPressedKeys = new Set<string>()

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault()
      }
      if (!this.keys[e.code]) this.justPressedKeys.add(e.code)
      this.keys[e.code] = true
    })
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false
    })
  }

  /**
   * PILOTING mode controls:
   *   Space       = boost (instant max throttle while held; release = drop to 0)
   *   W / S       = throttle up / down
   *   A / ←       = yaw left        D / → = yaw right
   *   ↑ / F       = pitch up (nose up)    ↓ / R = pitch down
   *   Q / E       = roll
   *   Z / X       = vertical thrust up / down
   */
  getPilotInput(): RawInput {
    const k = this.keys
    return {
      yaw:           (k['KeyA'] || k['ArrowLeft']  ? -1 : 0) + (k['KeyD'] || k['ArrowRight'] ? 1 : 0),
      pitch:         (k['KeyR'] || k['ArrowDown']  ? -1 : 0) + (k['KeyF'] || k['ArrowUp']   ? 1 : 0),
      roll:          (k['KeyQ'] ? -1 : 0) + (k['KeyE'] ? 1 : 0),
      throttleDelta: (k['KeyW'] ?  1 : 0) + (k['KeyS'] ? -1 : 0),
      verticalDelta: (k['KeyZ'] ?  1 : 0) + (k['KeyX'] ? -1 : 0),
      boost:         !!(k['Space']),
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

  /** True while key is held down. */
  isHeld(code: string): boolean { return !!this.keys[code] }

  /** Returns true once per key press; clears the flag. */
  consumeJustPressed(code: string): boolean {
    if (this.justPressedKeys.has(code)) {
      this.justPressedKeys.delete(code)
      return true
    }
    return false
  }
}
