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

  getRawInput(): RawInput {
    const k = this.keys
    return {
      yaw:          (k['KeyA'] || k['ArrowLeft']  ? -1 : 0) + (k['KeyD'] || k['ArrowRight'] ? 1 : 0),
      pitch:        (k['KeyW'] || k['ArrowUp']    ? -1 : 0) + (k['KeyS'] || k['ArrowDown']  ? 1 : 0),
      roll:         (k['KeyQ'] ? -1 : 0) + (k['KeyE'] ? 1 : 0),
      throttleDelta:(k['ShiftLeft'] || k['ShiftRight'] ? 1 : 0) + (k['Space'] ? -1 : 0),
      verticalDelta:(k['KeyR'] ? 1 : 0) + (k['KeyF'] ? -1 : 0),
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
