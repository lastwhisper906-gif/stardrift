import { Euler } from 'three'
import { SceneManager } from './render/SceneManager.js'
import { CockpitRoom } from './render/CockpitRoom.js'
import { LocalRoom } from './state/LocalRoom.js'
import { InputRouter } from './input/InputRouter.js'
import { KeyboardInput } from './input/KeyboardInput.js'
import { EventManager } from './events/EventManager.js'
import { AsteroidEvent } from './events/AsteroidEvent.js'
import { HUD } from './hud/HUD.js'
import { CharacterController } from './character/CharacterController.js'
import { CameraController } from './camera/CameraController.js'
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

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene = new SceneManager()

// Cockpit room (walkable space) — added to shipGroup
const cockpitRoom = new CockpitRoom()
scene.shipGroup.add(cockpitRoom.group)

// Character + camera controller
const character = new CharacterController()
scene.shipGroup.add(character.mesh)

const camCtrl = new CameraController(scene.camera, scene.shipGroup)

// Start in WALKING mode: hide 1st-person arm meshes
scene.cockpit.setArmsVisible(false)
camCtrl.setMode('walking')

// ── Events ────────────────────────────────────────────────────────────────────
const asteroidEvent = new AsteroidEvent(scene.scene, room)
const eventManager = new EventManager(room)
eventManager.register(asteroidEvent)

// ── HUD ───────────────────────────────────────────────────────────────────────
const hud = new HUD()
hud.setInteractPrompt(false)  // shown when near helm in WALKING mode

// ── Timers ────────────────────────────────────────────────────────────────────
let pilotingTimer = 0
let nextTriggerDelay = 20

let lastTime = performance.now()

function loop(): void {
  const now = performance.now()
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now

  const raw = keyboard.getRawInput()
  const mode = camCtrl.mode

  // ── F key: toggle WALKING ↔ PILOTING ────────────────────────────────────
  if (keyboard.consumeJustPressed('KeyF')) {
    if (mode === 'walking' && character.isNearHelm()) {
      // Sit down
      camCtrl.setMode('piloting')
      character.mesh.visible = false
      scene.cockpit.setArmsVisible(true)
      hud.setInteractPrompt(false)
    } else if (mode === 'piloting') {
      // Stand up
      character.placeAtHelm()
      camCtrl.setMode('walking')
      character.mesh.visible = true
      scene.cockpit.setArmsVisible(false)
    }
  }

  // ── Input dispatch ───────────────────────────────────────────────────────
  if (mode === 'piloting') {
    // Ship control via Station handlers
    const state = room.getState()
    const next = router.dispatch('player1', raw, state, dt)
    const physShip = updatePhysics(next.ship, dt)
    room.setState({ ship: physShip, tick: state.tick + 1 })
  } else {
    // Character movement; ship drifts (physics still runs with zero input)
    character.move(raw.yaw, raw.pitch, dt)
    const state = room.getState()
    const physShip = updatePhysics(state.ship, dt)
    room.setState({ ship: physShip, tick: state.tick + 1 })
  }

  // ── Events (only trigger when someone is at the helm) ───────────────────
  const phase = room.getState().phase
  if (mode === 'piloting' && phase === 'PILOTING') {
    pilotingTimer += dt
    if (pilotingTimer >= nextTriggerDelay) {
      pilotingTimer = 0
      nextTriggerDelay = 25 + Math.random() * 20
      eventManager.trigger('asteroid')
    }
  } else {
    pilotingTimer = 0
  }
  if (keyboard.consumeJustPressed('KeyX') && phase === 'PILOTING') {
    eventManager.trigger('asteroid')
  }
  eventManager.update(dt)

  // ── Sync ship group (camera follows automatically) ───────────────────────
  const ship = room.getState().ship
  const [px, py, pz] = ship.position
  const [rx, ry, rz] = ship.rotation
  scene.shipGroup.position.set(px, py, pz)
  scene.shipGroup.setRotationFromEuler(new Euler(rx, ry, rz, 'YXZ'))

  // ── Camera update ────────────────────────────────────────────────────────
  camCtrl.update(character)

  // ── Cockpit animation (only useful in PILOTING) ──────────────────────────
  if (mode === 'piloting') {
    scene.cockpit.update(raw, ship, dt)
  }

  // ── HUD ──────────────────────────────────────────────────────────────────
  const nearHelm = mode === 'walking' && character.isNearHelm()
  hud.setInteractPrompt(nearHelm)

  const asteroidDist =
    eventManager.getActiveEventId() === 'asteroid'
      ? asteroidEvent.getDistanceToShip()
      : undefined
  hud.update(ship, room.getState().phase, asteroidDist)

  scene.render()
  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
