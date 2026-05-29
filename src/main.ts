import { Euler, Vector3 } from 'three'
import { AudioSystem } from './audio/AudioSystem.js'
import { SpaceStation } from './render/SpaceStation.js'
import { SceneManager } from './render/SceneManager.js'
import { CockpitRoom } from './render/CockpitRoom.js'
import { LocalRoom } from './state/LocalRoom.js'
import { InputRouter } from './input/InputRouter.js'
import { KeyboardInput } from './input/KeyboardInput.js'
import { EventManager } from './events/EventManager.js'
import { AsteroidEvent } from './events/AsteroidEvent.js'
import { AlienEvent } from './events/AlienEvent.js'
import { BlackHoleEvent } from './events/BlackHoleEvent.js'
import { EvaEvent } from './events/EvaEvent.js'
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
const asteroidEvent   = new AsteroidEvent(scene.scene, room)
const alienEvent      = new AlienEvent(scene.scene, room)
const blackHoleEvent  = new BlackHoleEvent(scene.scene, room)
const evaEvent        = new EvaEvent(room)
const eventManager    = new EventManager(room)
eventManager.register(asteroidEvent)
eventManager.register(alienEvent)
eventManager.register(blackHoleEvent)
eventManager.register(evaEvent)

// ── HUD ───────────────────────────────────────────────────────────────────────
const hud   = new HUD()
const audio = new AudioSystem()
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

let lastTime  = performance.now()
let totalTime = 0
let prevHull  = 100

function loop(): void {
  const now = performance.now()
  const dt  = Math.min((now - lastTime) / 1000, 0.05)
  lastTime   = now

  // Dismiss title on any key, then start the actual loop
  if (!hud.isTitleDismissed()) {
    // Peek at keydown events to dismiss
    if (keyboard.consumeJustPressed('Enter') || keyboard.consumeJustPressed('Space') ||
        keyboard.consumeJustPressed('KeyW')  || keyboard.consumeJustPressed('KeyA') ||
        keyboard.consumeJustPressed('KeyS')  || keyboard.consumeJustPressed('KeyD')) {
      hud.dismissTitle()
      audio.init()
    }
    scene.render()
    requestAnimationFrame(loop)
    return
  }
  totalTime += dt

  const mode = camCtrl.mode

  // ── Dismiss title screen on any key ──────────────────────────────────────
  // (handled below via keyboard polling — any consumeJustPressed drains the queue)

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
    audio.setThrottle(physShip.throttle)
    if (mode === 'piloting') scene.cockpit.update(pilotInput, physShip, dt)
  } else {
    audio.setThrottle(0)
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
    const o2dx   = character.position.x - 3.65
    const o2dz   = character.position.z - 3.25
    const nearO2 = Math.sqrt(o2dx * o2dx + o2dz * o2dz) < 2.5
    if (nearO2 && keyboard.isHeld('KeyE') && room.getState().ship.oxygen < 100) {
      const st = room.getState()
      room.setState({ ship: { ...st.ship, oxygen: Math.min(100, st.ship.oxygen + 8 * dt) } })
    }
    hud.setO2Prompt(nearO2 && room.getState().ship.oxygen < 100)

    // Entrance door animation
    cockpitRoom.update(character.position.z, dt, totalTime)

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
      // Weighted random event selection
      const roll = Math.random()
      const hull = room.getState().ship.hull
      let eventId = 'asteroid'
      if (roll < 0.30) eventId = 'alien'
      else if (roll < 0.45) eventId = 'blackhole'
      else if (hull < 40) eventId = 'eva'   // EVA only triggers when hull is critical
      eventManager.trigger(eventId)
    }
    // Player fires at alien (Space key while piloting)
    if (keyboard.consumeJustPressed('Space') && eventManager.getActiveEventId() === 'alien') {
      const state = room.getState()
      const [rx, ry] = state.ship.rotation
      const shipFwd = new Vector3(
        -Math.sin(ry) * Math.cos(rx), Math.sin(rx), -Math.cos(ry) * Math.cos(rx),
      )
      const shipPos = new Vector3(...state.ship.position as [number, number, number])
      const hit = alienEvent.shoot(shipPos, shipFwd)
      scene.muzzleLight.intensity = 6
      audio.playShot()
      if (hit) { hud.flashHit(); audio.playAlertBeep() }
    }
    // Decay muzzle flash
    if (scene.muzzleLight.intensity > 0) {
      scene.muzzleLight.intensity = Math.max(0, scene.muzzleLight.intensity - dt * 24)
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
  const [rx, ry, rz] = ship.rotation
  scene.shipGroup.position.set(...ship.position as [number, number, number])
  scene.shipGroup.setRotationFromEuler(new Euler(rx, ry, rz, 'YXZ'))

  // ── Camera update ────────────────────────────────────────────────────────
  camCtrl.update(character, dt)

  // ── HUD ──────────────────────────────────────────────────────────────────
  const nearHelm = mode === 'walking' && character.isNearHelm()
  hud.setInteractPrompt(nearHelm)

  // Impact audio + camera shake when hull decreases
  if (ship.hull < prevHull - 0.5) {
    audio.playImpact()
    camCtrl.shake(1.0)
  }
  prevHull = ship.hull

  // Pre-compute station distance for HUD and docking
  const _sp = ship.position
  const [_sx, _sy, _sz] = SpaceStation.POSITION
  const distToStation = Math.sqrt((_sp[0]-_sx)**2 + (_sp[1]-_sy)**2 + (_sp[2]-_sz)**2)
  const shipSpeed     = Math.sqrt(ship.velocity[0]**2 + ship.velocity[1]**2 + ship.velocity[2]**2)

  const activeEvent = eventManager.getActiveEventId()
  const asteroidDist = activeEvent === 'asteroid' ? asteroidEvent.getDistanceToShip()
                     : activeEvent === 'blackhole' ? blackHoleEvent.getDistanceToShip()
                     : undefined
  hud.update(ship, room.getState().phase, asteroidDist, activeEvent ?? 'asteroid')

  if (activeEvent === 'alien') {
    hud.setAlienWarning(true, alienEvent.getDistanceToShip(), alienEvent.getHealth())
    const inRange = (mode === 'piloting' || mode === 'exterior') && alienEvent.getDistanceToShip() < 120
    hud.setCombatPrompt(inRange)
    hud.setStationWaypoint(false)
  } else {
    hud.setAlienWarning(false)
    hud.setCombatPrompt(false)
    // Show station waypoint when not in event
    const showStation = (mode === 'piloting' || mode === 'exterior') && !gameOver
    const dockReady   = distToStation < 35 && shipSpeed < 6
    hud.setStationWaypoint(showStation, distToStation, dockReady)
  }

  // ── Mode indicator ────────────────────────────────────────────────────────
  hud.setMode(mode === 'exterior' ? 'EXT VIEW' : mode)

  // ── Mission progress + docking check ────────────────────────────────────
  const [px, py, pz]   = ship.position
  const distFromOrigin = Math.sqrt(px * px + py * py + pz * pz)
  hud.setMissionProgress(distFromOrigin)

  if (!gameOver && distToStation < 35 && shipSpeed < 6 && keyboard.consumeJustPressed('Space')) {
    const st = room.getState()
    room.setState({ ship: { ...st.ship, hull: 100, oxygen: 100 } })
    audio.playDock()
    hud.flashHit()
  }

  // ── Win / lose detection ──────────────────────────────────────────────────
  if (!gameOver) {
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
