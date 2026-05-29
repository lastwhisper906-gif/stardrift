import { Euler, Vector3 } from 'three'
import { SceneManager } from './render/SceneManager.js'
import { CockpitRoom } from './render/CockpitRoom.js'
import { LocalRoom } from './state/LocalRoom.js'
import { InputRouter } from './input/InputRouter.js'
import { KeyboardInput } from './input/KeyboardInput.js'
import { EventManager } from './events/EventManager.js'
import { AsteroidEvent } from './events/AsteroidEvent.js'
import { AlienEvent } from './events/AlienEvent.js'
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
const alienEvent    = new AlienEvent(scene.scene, room)
const eventManager  = new EventManager(room)
eventManager.register(asteroidEvent)
eventManager.register(alienEvent)

// ── HUD ───────────────────────────────────────────────────────────────────────
const hud = new HUD()
hud.setInteractPrompt(false)

// ── Timers / game state ───────────────────────────────────────────────────────
let pilotingTimer = 0
let nextTriggerDelay = 20
let gameOver = false

function resetGame(): void {
  room.setState({
    ship: {
      position: [0, 0, 0], rotation: [0, 0, 0],
      velocity: [0, 0, 0], angularVelocity: [0, 0, 0],
      throttle: 0, oxygen: 100, hull: 100,
    },
    phase: 'PILOTING',
    tick: 0,
  })
  character.placeAtHelm()
  camCtrl.setMode('walking')
  camCtrl.setWalkYaw(Math.PI)
  scene.shipExterior.group.visible = false
  character.mesh.visible = true
  scene.cockpit.setArmsVisible(false)
  pilotingTimer    = 0
  nextTriggerDelay = 20
  gameOver         = false
  hud.hideEndScreen()
}

let lastTime = performance.now()

function loop(): void {
  const now = performance.now()
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now

  const mode = camCtrl.mode

  // ── Tab: toggle exterior ship view while piloting ────────────────────────
  if (keyboard.consumeJustPressed('Tab') && (mode === 'piloting' || mode === 'exterior')) {
    if (mode === 'exterior') {
      camCtrl.setMode('piloting')
      scene.shipExterior.group.visible = false
    } else {
      camCtrl.setMode('exterior')
      scene.shipExterior.group.visible = true
    }
  }

  // ── F key: toggle WALKING ↔ PILOTING ────────────────────────────────────
  if (keyboard.consumeJustPressed('KeyF')) {
    if (mode === 'walking' && character.isNearHelm()) {
      camCtrl.setMode('piloting')
      scene.shipExterior.group.visible = false
      character.mesh.visible = false
      scene.cockpit.setArmsVisible(true)
      hud.setInteractPrompt(false)
    } else if (mode === 'piloting' || mode === 'exterior') {
      character.placeAtHelm()
      camCtrl.setMode('walking')
      camCtrl.setWalkYaw(Math.PI)
      scene.shipExterior.group.visible = false
      character.mesh.visible = true
      scene.cockpit.setArmsVisible(false)
    }
  }

  // ── Input dispatch ───────────────────────────────────────────────────────
  if (mode === 'piloting' || mode === 'exterior') {
    const pilotInput = keyboard.getPilotInput()
    const state = room.getState()
    const next = router.dispatch('player1', pilotInput, state, dt)
    const physShip = updatePhysics(next.ship, dt)
    room.setState({ ship: physShip, tick: state.tick + 1 })
    if (mode === 'piloting') scene.cockpit.update(pilotInput, physShip, dt)
  } else {
    // Character movement
    const axes = keyboard.getWalkAxes()
    if (keyboard.consumeJustPressed('Space')) character.jump()
    if (keyboard.consumeJustPressed('KeyC'))  character.toggleCrouch()
    character.move(axes.fwd, axes.right, dt, axes.isRunning)

    // ── Repair station interaction ─────────────────────────────────────────
    // Left secondary station centre approx (x=-3.65, z=3.25)
    const rdx = character.position.x - (-3.65)
    const rdz = character.position.z - 3.25
    const nearRepair = Math.sqrt(rdx * rdx + rdz * rdz) < 2.5
    if (nearRepair && keyboard.isHeld('KeyE') && room.getState().ship.hull < 100) {
      const st = room.getState()
      room.setState({ ship: { ...st.ship, hull: Math.min(100, st.ship.hull + 5 * dt) } })
    }
    hud.setRepairPrompt(nearRepair && room.getState().ship.hull < 100, room.getState().ship.hull)

    // ── O2 station interaction (right secondary station) ──────────────────
    const o2dx  = character.position.x - 3.65
    const o2dz  = character.position.z - 3.25
    const nearO2 = Math.sqrt(o2dx * o2dx + o2dz * o2dz) < 2.5
    if (nearO2 && keyboard.isHeld('KeyE') && room.getState().ship.oxygen < 100) {
      const st = room.getState()
      room.setState({ ship: { ...st.ship, oxygen: Math.min(100, st.ship.oxygen + 8 * dt) } })
    }

    // Entrance door animation
    cockpitRoom.update(character.position.z, dt)

    const state = room.getState()
    const physShip = updatePhysics(state.ship, dt)
    room.setState({ ship: physShip, tick: state.tick + 1 })
  }

  // ── Events (only trigger when someone is at the helm) ───────────────────
  const phase = room.getState().phase
  if ((mode === 'piloting' || mode === 'exterior') && phase === 'PILOTING') {
    pilotingTimer += dt
    if (pilotingTimer >= nextTriggerDelay) {
      pilotingTimer    = 0
      nextTriggerDelay = 22 + Math.random() * 22
      // Alternate: every other trigger is an alien event
      const useAlien = Math.random() < 0.45
      eventManager.trigger(useAlien ? 'alien' : 'asteroid')
    }
    // Player fires at alien (Space key while piloting)
    if (keyboard.consumeJustPressed('Space') && eventManager.getActiveEventId() === 'alien') {
      const state = room.getState()
      const [rx, ry] = state.ship.rotation
      const shipFwd = new Vector3(
        -Math.sin(ry) * Math.cos(rx), Math.sin(rx), -Math.cos(ry) * Math.cos(rx),
      )
      const shipPos = new Vector3(...state.ship.position as [number, number, number])
      alienEvent.shoot(shipPos, shipFwd)
    }
  } else {
    pilotingTimer = 0
  }
  if (keyboard.consumeJustPressed('KeyP') && phase === 'PILOTING') {
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

  // ── HUD ──────────────────────────────────────────────────────────────────
  const nearHelm = mode === 'walking' && character.isNearHelm()
  hud.setInteractPrompt(nearHelm)

  const activeEvent = eventManager.getActiveEventId()
  const asteroidDist = activeEvent === 'asteroid' ? asteroidEvent.getDistanceToShip() : undefined
  hud.update(ship, room.getState().phase, asteroidDist)

  if (activeEvent === 'alien') {
    hud.setAlienWarning(true, alienEvent.getDistanceToShip(), alienEvent.getHealth())
  } else {
    hud.setAlienWarning(false)
  }

  // ── Mode indicator ────────────────────────────────────────────────────────
  hud.setMode(mode === 'exterior' ? 'EXT VIEW' : mode)

  // ── Win / lose detection ──────────────────────────────────────────────────
  if (!gameOver) {
    const [px, py, pz] = ship.position
    const distFromOrigin = Math.sqrt(px * px + py * py + pz * pz)
    if (ship.hull <= 0) {
      gameOver = true
      hud.showEndScreen('destroyed', distFromOrigin)
    } else if (ship.oxygen <= 0) {
      gameOver = true
      hud.showEndScreen('oxygen', distFromOrigin)
    } else if (distFromOrigin >= 5000) {
      gameOver = true
      hud.showEndScreen('win', distFromOrigin)
    }
  }

  // Restart
  if (gameOver && keyboard.consumeJustPressed('KeyR')) resetGame()

  scene.render()
  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
