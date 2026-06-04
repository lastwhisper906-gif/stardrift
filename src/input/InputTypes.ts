import type { Station } from '../stations/Station.js'

export interface RawInput {
  yaw: number
  pitch: number
  roll: number
  throttleDelta: number
  verticalDelta: number
  boost: boolean        // Space held = instant max throttle; release = drop to 0
}

export interface ClimberInput {
  leftAxe:    boolean   // Q — plant left ice axe explicitly
  rightAxe:   boolean   // E — plant right ice axe explicitly
  advance:    boolean   // W — auto-swing the currently active axe (WASD forward)
  rotateLeft:  boolean  // A — rotate camera yaw left
  rotateRight: boolean  // D — rotate camera yaw right
  mouseLeft:  boolean   // left mouse button = left axe
  mouseRight: boolean   // right mouse button = right axe
}

export interface StationInput {
  station: Station
  payload: RawInput
  dt: number
}
