import type { RawInput, ClimberInput } from './InputTypes.js'

export class KeyboardInput {
  private readonly keys: Record<string, boolean> = {}
  private readonly justPressedKeys = new Set<string>()

  private mouseDX = 0
  private mouseDY = 0
  private pointerLocked = false
  private mouseLeftDown  = false
  private mouseRightDown = false

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
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX
        this.mouseDY += e.movementY
      }
    })
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseLeftDown  = true
      if (e.button === 2) this.mouseRightDown = true
    })
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseLeftDown  = false
      if (e.button === 2) this.mouseRightDown = false
    })
    window.addEventListener('contextmenu', (e) => e.preventDefault())
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = !!document.pointerLockElement
    })
    document.addEventListener('pointerlockerror', () => {
      console.warn('[KeyboardInput] Pointer lock request failed')
    })

    // Re-acquire pointer lock on canvas click (browser requires a user gesture;
    // calling requestPointerLock from the rAF loop silently fails in Chrome/Firefox)
    const canvas = document.querySelector('canvas')
    if (canvas) {
      canvas.addEventListener('click', () => {
        if (!this.pointerLocked) canvas.requestPointerLock()
      })
    }
  }

  requestPointerLock(): void {
    const canvas = document.querySelector('canvas')
    if (canvas && !this.pointerLocked) canvas.requestPointerLock()
  }

  releasePointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock()
  }

  /** Returns accumulated mouse movement since last call and resets the buffer. */
  consumeMouseDelta(): { dx: number; dy: number } {
    const d = { dx: this.mouseDX, dy: this.mouseDY }
    this.mouseDX = 0
    this.mouseDY = 0
    return d
  }

  isPointerLocked(): boolean { return this.pointerLocked }

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
      pitch:         (k['KeyR'] || k['ArrowDown']  ? -1 : 0) + (k['ArrowUp']                 ? 1 : 0),
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

  /** Planet surface climbing: W=advance, Q=left axe, E=right axe, A/D=rotate, LMB/RMB=axes */
  getClimberInput(): ClimberInput {
    const k = this.keys
    return {
      leftAxe:    !!(k['KeyQ']),
      rightAxe:   !!(k['KeyE']),
      advance:    !!(k['KeyW'] || k['ArrowUp']),
      rotateLeft:  !!(k['KeyA'] || k['ArrowLeft']),
      rotateRight: !!(k['KeyD'] || k['ArrowRight']),
      mouseLeft:  this.mouseLeftDown,
      mouseRight: this.mouseRightDown,
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
