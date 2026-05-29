import type { Station } from '../stations/Station.js'

export interface RawInput {
  yaw: number
  pitch: number
  roll: number
  throttleDelta: number
  verticalDelta: number
}

export interface StationInput {
  station: Station
  payload: RawInput
  dt: number
}
