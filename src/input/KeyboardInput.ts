import type { RawInput } from './InputTypes.js'

const KEYS: Record<string, boolean> = {}

export class KeyboardInput {
  constructor() {
    window.addEventListener('keydown', (e) => { KEYS[e.code] = true })
    window.addEventListener('keyup', (e) => { KEYS[e.code] = false })
  }

  getRawInput(): RawInput {
    return {
      yaw: (KEYS['KeyA'] || KEYS['ArrowLeft'] ? -1 : 0) + (KEYS['KeyD'] || KEYS['ArrowRight'] ? 1 : 0),
      pitch: (KEYS['KeyW'] || KEYS['ArrowUp'] ? -1 : 0) + (KEYS['KeyS'] || KEYS['ArrowDown'] ? 1 : 0),
      roll: (KEYS['KeyQ'] ? -1 : 0) + (KEYS['KeyE'] ? 1 : 0),
      throttleDelta: (KEYS['ShiftLeft'] || KEYS['ShiftRight'] ? 1 : 0) + (KEYS['Space'] ? -1 : 0),
      verticalDelta: (KEYS['KeyR'] ? 1 : 0) + (KEYS['KeyF'] ? -1 : 0),
    }
  }
}
