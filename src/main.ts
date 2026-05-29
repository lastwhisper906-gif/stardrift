import { Euler } from 'three'
import { SceneManager } from './render/SceneManager.js'
import { LocalRoom } from './state/LocalRoom.js'
import { InputRouter } from './input/InputRouter.js'
import { KeyboardInput } from './input/KeyboardInput.js'
import { EventManager } from './events/EventManager.js'
import { AsteroidEvent } from './events/AsteroidEvent.js'
import { HUD } from './hud/HUD.js'
import { helmHandler } from './stations/HelmHandler.js'
import { throttleHandler } from './stations/ThrottleHandler.js'
import { verticalHandler } from './stations/VerticalHandler.js'
import { ALL_STATIONS } from './stations/Station.js'
import { updatePhysics } from './systems/PhysicsSystem.js'

// ── Authority state ───────────────────────────────────────────────────────────
const room = new LocalRoom()

// ── Input ─────────────────────────────────────────────────────────────────────
const router = new InputRouter()
router.registerHandler(helmHandler)
router.registerHandler(throttleHandler)
router.registerHandler(verticalHandler)
router.assignStations('player1', ALL_STATIONS)

const keyboard = new KeyboardInput()

// ── Events ────────────────────────────────────────────────────────────────────
const scene = new SceneManager()
const asteroidEvent = new AsteroidEvent(scene.scene, room)
const eventManager = new EventManager(room)
eventManager.register(asteroidEvent)

// ── HUD ───────────────────────────────────────────────────────────────────────
const hud = new HUD()

// ── Event trigger timing ──────────────────────────────────────────────────────
let pilotingTimer = 0
let nextTriggerDelay = 20 // first asteroid after 20 s

let lastTime = performance.now()

function loop(): void {
  const now = performance.now()
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now

  // ── Input → Station handlers → GameState ────────────────────────────────
  const raw = keyboard.getRawInput()
  const state = room.getState()
  const next = router.dispatch('player1', raw, state, dt)
  const physShip = updatePhysics(next.ship, dt)
  room.setState({ ship: physShip, tick: state.tick + 1 })

  // ── Event manager ────────────────────────────────────────────────────────
  const phase = room.getState().phase
  if (phase === 'PILOTING') {
    pilotingTimer += dt
    if (pilotingTimer >= nextTriggerDelay) {
      pilotingTimer = 0
      nextTriggerDelay = 25 + Math.random() * 20 // 25–45 s until next
      eventManager.trigger('asteroid')
    }
  } else {
    pilotingTimer = 0
  }
  // X key: instant debug trigger
  if (keyboard.consumeJustPressed('KeyX') && phase === 'PILOTING') {
    eventManager.trigger('asteroid')
  }
  eventManager.update(dt)

  // ── Sync ship group → camera follows automatically ───────────────────────
  const ship = room.getState().ship
  const [px, py, pz] = ship.position
  const [rx, ry, rz] = ship.rotation
  scene.shipGroup.position.set(px, py, pz)
  scene.shipGroup.setRotationFromEuler(new Euler(rx, ry, rz, 'YXZ'))

  // ── Cockpit control animation ────────────────────────────────────────────
  scene.cockpit.update(raw, ship, dt)

  // ── HUD update ───────────────────────────────────────────────────────────
  const asteroidDist =
    eventManager.getActiveEventId() === 'asteroid'
      ? asteroidEvent.getDistanceToShip()
      : undefined
  hud.update(ship, room.getState().phase, asteroidDist)

  scene.render()
  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
