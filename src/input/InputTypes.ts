import type { Station } from '../stations/Station.js'

export interface RawInput {
  yaw: number
  pitch: number
  roll: number
  throttleDelta: number
  verticalDelta: number
  boost: boolean        // Space held = instant max throttle; release = drop to 0
}

export interface StationInput {
  station: Station
  payload: RawInput
  dt: number
}
