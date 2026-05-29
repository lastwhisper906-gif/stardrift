import { Euler, Vector3 } from 'three'
import { SceneManager } from './render/SceneManager.js'
import { LocalRoom } from './state/LocalRoom.js'
import { InputRouter } from './input/InputRouter.js'
import { KeyboardInput } from './input/KeyboardInput.js'
import { EventManager } from './events/EventManager.js'
import { helmHandler } from './stations/HelmHandler.js'
import { throttleHandler } from './stations/ThrottleHandler.js'
import { verticalHandler } from './stations/VerticalHandler.js'
import { Station, ALL_STATIONS } from './stations/Station.js'
import { updatePhysics } from './systems/PhysicsSystem.js'

const room = new LocalRoom()

const router = new InputRouter()
router.registerHandler(helmHandler)
router.registerHandler(throttleHandler)
router.registerHandler(verticalHandler)
router.assignStations('player1', ALL_STATIONS)

const keyboard = new KeyboardInput()
const eventManager = new EventManager(room)
const scene = new SceneManager()

let lastTime = performance.now()

function loop(): void {
  const now = performance.now()
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now

  const raw = keyboard.getRawInput()
  const state = room.getState()
  const next = router.dispatch('player1', raw, state)

  const physShip = updatePhysics(next.ship, dt)
  room.setState({ ship: physShip, tick: state.tick + 1 })

  eventManager.update(dt)

  const ship = room.getState().ship
  const [px, py, pz] = ship.position
  const [rx, ry, rz] = ship.rotation
  scene.shipMesh.position.set(px, py, pz)
  scene.shipMesh.setRotationFromEuler(new Euler(rx, ry, rz, 'YXZ'))

  const camOffset = new Vector3(0, 4, 12)
  camOffset.applyEuler(new Euler(rx * 0.3, ry, 0, 'YXZ'))
  scene.camera.position.set(px + camOffset.x, py + camOffset.y, pz + camOffset.z)
  scene.camera.lookAt(px, py, pz)

  scene.render()
  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
