import { Euler, Quaternion, Vector3 } from 'three'
import { createSubshipState, updateSubship } from './systems/SubshipSystem.js'
import type { SubshipState } from './systems/SubshipSystem.js'
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
import { SubshipEvent } from './events/SubshipEvent.js'
import { PlanetEvent, PLANET_RADIUS } from './events/PlanetEvent.js'
import { SURFACE_FOOT, SURFACE_EYE } from './render/PlanetMesh.js'
import { applyPlanetDrag, resolvePlanetCollision } from './systems/PlanetSystem.js'
import { updateClimbing } from './systems/ClimbingSystem.js'
import { IceAxeView } from './render/IceAxeView.js'
import { SubshipArmsView } from './render/SubshipArmsView.js'
import { TetherView } from './render/TetherView.js'
import { createInitialSurfaceState } from './state/GameState.js'
import { LAUNCH, LANDING } from './tuning.js'
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
camCtrl.setSubshipGroup(scene.subship.group)

// Debug helper — exposed for automated testing only, harmless in prod
;(window as unknown as Record<string, unknown>).__debug = {
  getPos:   () => ({ x: character.position.x, z: character.position.z }),
  getMode:  () => camCtrl.mode,
  getCamYaw:() => camCtrl.getCamYaw(),
  nearHelm: () => character.isNearHelm(),
  nearSub:  () => character.isNearSubship(),
  getLaunchPhase: () => launchPhase,
  getSubshipPos:  () => subshipState
    ? { x: +subshipState.position[0].toFixed(1), z: +subshipState.position[2].toFixed(1), throttle: +subshipState.throttle.toFixed(2) }
    : null,
  teleportToSubship: () => {
    character.position.set(2.2, character.position.y, 39)
    camCtrl.setWalkYaw(Math.PI)
  },
  // Surface test helpers — used by Playwright to verify Phase A reboard logic
  getSurfaceDistToSubship: () => +charWorldPos.distanceTo(scene.subship.group.position).toFixed(1),
  getSurfaceZeroG: () => {
    const s = room.getState().surface
    return {
      pos: { x: +charWorldPos.x.toFixed(2), y: +charWorldPos.y.toFixed(2), z: +charWorldPos.z.toFixed(2) },
      vel: s.charVelocity.map((v) => +v.toFixed(3)),
      speed: +Math.hypot(...s.charVelocity).toFixed(3),
      distFromCenter: +charWorldPos.distanceTo(planetEvent.getPlanetCenter()).toFixed(2),
      leftAnchored: s.leftAnchorPos !== null,
      rightAnchored: s.rightAnchorPos !== null,
    }
  },
  snapCharToSubship: () => {
    // Move charWorldPos directly under the parked subship for reboard testing
    const center = planetEvent.getPlanetCenter()
    const dir = scene.subship.group.position.clone().sub(center).normalize()
    charWorldPos.copy(center).addScaledVector(dir, PLANET_RADIUS + SURFACE_FOOT)
  },
  triggerLand: () => {
    // Directly start landing sequence (bypasses F key — used for headless Playwright tests)
    if (camCtrl.mode !== 'subship_piloting' || launchPhase !== 'flying' || planetLandPhase !== 'none') return false
    planetLandPhase = 'on_surface'
    hud.setLandPrompt(false)
    const surface = createInitialSurfaceState()
    surface.landingPhase = 'touching_down'
    surface.landingProgress = 0
    room.setState({ surface })
    lastSwinging = 'none'
    return true
  },
  getLandState: () => ({
    landPromptActive,
    planetLandPhase,
    landCooldown: +landCooldown.toFixed(2),
    distToPlanet: subshipState
      ? +new Vector3(...subshipState.position as [number,number,number])
          .distanceTo(planetEvent.getPlanetCenter()).toFixed(1)
      : null,
    surfaceLandPhase: room.getState().surface.landingPhase,
    surfaceProgress: +room.getState().surface.landingProgress.toFixed(3),
    tick: room.getState().tick,
  }),
  teleportSubshipToPlanet: () => {
    // Warp subship to 10m above planet surface (within PLANET_RADIUS+18 land threshold)
    if (!subshipState) return
    const c = planetEvent.getPlanetCenter()
    const targetZ = c.z + (PLANET_RADIUS + 10)
    subshipState = { ...subshipState, position: [c.x, c.y, targetZ], velocity: [0, 0, 0] }
    scene.subship.group.position.set(c.x, c.y, targetZ)
  },
}

// Ice axe view — 1st-person axes parented to camera (planet_surface mode)
const iceAxeView = new IceAxeView()
iceAxeView.group.visible      = false
iceAxeView.worldGroup.visible = false
scene.camera.add(iceAxeView.group)
// World-space planted-axe markers live in scene space (not shipGroup or camera)
scene.scene.add(iceAxeView.worldGroup)

// Subship pilot arms — 1st-person hands parented to camera (subship_piloting mode)
const subshipArms = new SubshipArmsView()
scene.camera.add(subshipArms.group)

// Tether attachment animation — plays during 'tethering' landing phase
const tetherView = new TetherView()
scene.camera.add(tetherView.group)

// Start in WALKING mode: hide 1st-person arm meshes
scene.cockpit.setArmsVisible(false)
camCtrl.setMode('walking')

// ── Events ────────────────────────────────────────────────────────────────────
const asteroidEvent   = new AsteroidEvent(scene.scene, room)
const alienEvent      = new AlienEvent(scene.scene, room)
const blackHoleEvent  = new BlackHoleEvent(scene.scene, room)
const evaEvent        = new EvaEvent(room)
const subshipEvent    = new SubshipEvent(scene.scene, room)
const planetEvent     = new PlanetEvent(scene.scene, room)
const eventManager    = new EventManager(room)
eventManager.register(asteroidEvent)
eventManager.register(alienEvent)
eventManager.register(blackHoleEvent)
eventManager.register(evaEvent)
eventManager.register(subshipEvent)
eventManager.register(planetEvent)

// Set false to skip planet spawn at startup (improves perf during development)
const DEBUG_SPAWN_PLANET = true
if (DEBUG_SPAWN_PLANET) eventManager.trigger('planet')

// ── HUD ───────────────────────────────────────────────────────────────────────
const hud   = new HUD()
const audio = new AudioSystem()
hud.setInteractPrompt(false)

// ── Timers / game state ───────────────────────────────────────────────────────
let pilotingTimer = 0
let nextTriggerDelay = 20
let gameOver = false

type LaunchPhase = 'docked' | 'hatch_open' | 'descending' | 'flying' | 'ascending'
let launchPhase: LaunchPhase = 'docked'
let subshipLocalY = 0.0

let subshipState: SubshipState | null = null
let landPromptActive = false   // hysteresis flag — prevents prompt flickering
let landCooldown = 0           // seconds; >0 suppresses land prompt after lift-off

// Pre-allocated vectors — reused every frame, zero GC pressure
const _hangarWP    = new Vector3()
const _shipUpVec   = new Vector3(0, 1, 0)   // local +y of the sub-ship
const _landQuat    = new Quaternion()        // scratch for landing orientation
const _landedEuler = new Euler(0, 0, 0, 'YXZ')  // scratch for syncing landed rotation to subshipState

// ── Planet surface exploration ────────────────────────────────────────────────
let planetLandPhase: 'none' | 'on_surface' = 'none'
const charWorldPos   = new Vector3()
const _charLocalTmp  = new Vector3()
let lastSwinging: 'left' | 'right' | 'none' = 'none'

// Display-smoothed position/rotation (lerped each frame for buttery movement)
let dispX = 0, dispY = 0, dispZ = 0
const dispQuat = new Quaternion()
const _tgtQuat = new Quaternion()
const _tgtEuler = new Euler(0, 0, 0, 'YXZ')

function resetGame(): void {
  eventManager.clear()
  room.setState({
    ship: {
      position: [0, 0, 0], rotation: [0, 0, 0],
      velocity: [0, 0, 0], angularVelocity: [0, 0, 0],
      throttle: 0, oxygen: 100, hull: 100, minerals: 0,
    },
    phase:   'PILOTING',
    tick:    0,
    surface: createInitialSurfaceState(),
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
  launchPhase      = 'docked'
  subshipLocalY    = 0.0
  subshipState     = null
  dispX = 0; dispY = 0; dispZ = 0
  dispQuat.identity()
  scene.dockSubship()
  hud.setLaunchPrompt(false)
  hud.setDockPrompt(false)
  hud.setLandPrompt(false)
  hud.setAnchorPrompt(false, false)
  hud.setSurfaceLockHint(false)
  hud.setSurfaceControlHint(false)
  hud.setReboardPrompt(false)
  hud.setMinerals(0)
  hud.hideEndScreen()
  planetLandPhase                = 'none'
  iceAxeView.group.visible       = false
  iceAxeView.worldGroup.visible  = false
  subshipArms.setVisible(false)
  landPromptActive = false
  landCooldown     = 0
  scene.subship.deployLegs(0)
  lastSwinging = 'none'
}

const TARGET_MS = 1000 / 60   // ~16.67 ms — cap render at 60 fps on high-refresh displays
let lastTime  = performance.now() - TARGET_MS
let totalTime = 0
let prevHull  = 100

function loop(): void {
  requestAnimationFrame(loop)
  const now = performance.now()
  if (now - lastTime < TARGET_MS * 0.9) return   // skip frame if called too early
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
    return
  }
  totalTime += dt

  const mode = camCtrl.mode

  // ── Visibility culling — hide geometry not reachable from the current camera ─
  const inInterior = mode === 'walking' || mode === 'piloting'
  const launchInProgress = launchPhase === 'hatch_open' || launchPhase === 'descending' || launchPhase === 'ascending'
  cockpitRoom.group.visible          = inInterior
  scene.cockpit.group.visible        = inInterior
  const subshipInHangar    = mode === 'subship_piloting' && launchPhase === 'docked'
  // P1: keep hangar visible while subship is piloted — prevents instant-disappear at launch
  const subshipPiloting = mode === 'subship_piloting'
  scene.corridorHangar.group.visible = mode === 'walking' || launchInProgress || subshipInHangar || subshipPiloting
  // P1: show mothership hull in exterior view OR when flying the subship outside
  scene.shipExterior.group.visible =
    mode === 'exterior' || (mode === 'subship_piloting' && launchPhase === 'flying')

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

  // ── F key ────────────────────────────────────────────────────────────────
  if (keyboard.consumeJustPressed('KeyF')) {
    if (mode === 'walking' && character.isNearHelm()) {
      camCtrl.setMode('piloting')
      scene.shipExterior.group.visible = false
      character.mesh.visible = false
      scene.cockpit.setArmsVisible(true)
      hud.setInteractPrompt(false)
      keyboard.requestPointerLock()   // FPS mouse-look in cockpit
    } else if (mode === 'walking' && character.isNearSubship()) {
      camCtrl.setMode('subship_piloting')
      character.mesh.visible = false
      hud.setInteractPrompt(false)
      scene.subship.setExteriorVisible(false)
      scene.subship.cockpitInterior.setArmsVisible(true)
      subshipArms.setVisible(true)
      if (launchPhase === 'docked') hud.setLaunchPrompt(true)
      keyboard.requestPointerLock()   // FPS mouse-look in subship cockpit
    } else if (mode === 'subship_piloting' && launchPhase === 'docked') {
      // ── Start launch sequence ───────────────────────────────────────────
      launchPhase   = 'hatch_open'
      subshipLocalY = 0.0
      scene.subship.group.position.y = 0.0
      hud.setLaunchPrompt(false)
    } else if (mode === 'subship_piloting' && launchPhase === 'flying'
            && planetLandPhase === 'none'
            && landPromptActive) {
      // ── Begin landing sequence (touching_down phase) ─────────────────────
      planetLandPhase = 'on_surface'   // outer guard — prevents re-entry
      hud.setLandPrompt(false)
      const surface = createInitialSurfaceState()
      surface.landingPhase = 'touching_down'
      surface.landingProgress = 0
      room.setState({ surface })
      lastSwinging = 'none'
    } else if (mode === 'subship_piloting' && launchPhase === 'flying') {
      // ── Return to main ship if close enough ─────────────────────────────
      _hangarWP.set(
        scene.shipGroup.position.x,
        scene.shipGroup.position.y - 1.1,
        scene.shipGroup.position.z + 40,
      )
      if (scene.subship.group.position.distanceTo(_hangarWP) < 18) {
        scene.attachSubshipForAscent()
        subshipLocalY = LAUNCH.descentTarget
        launchPhase   = 'ascending'
        subshipState  = null
        audio.setThrottle(0)
        hud.setDockPrompt(false)
      }
    } else if (mode === 'planet_surface' && room.getState().surface.landingPhase === 'on_surface') {
      // ── Re-board the parked subship (must be nearby) ─────────────────────
      const _distToSub = charWorldPos.distanceTo(scene.subship.group.position)
      if (_distToSub <= LANDING.reboardDist) {
        keyboard.releasePointerLock()
        camCtrl.beginReboardLerp(scene.subship.group)
        hud.setAnchorPrompt(false, false)
        hud.setReboardPrompt(false)
        room.setState({ surface: { ...room.getState().surface,
          landingPhase: 'reboarding', landingProgress: 0 } })
      }
      // else: too far away — the HUD prompt already guides the player back
    } else if (mode === 'piloting' || mode === 'exterior') {
      keyboard.releasePointerLock()   // release lock when leaving cockpit
      character.placeAtHelm()
      camCtrl.setMode('walking')
      camCtrl.setWalkYaw(Math.PI)
      scene.shipExterior.group.visible = false
      character.mesh.visible = true
      scene.cockpit.setArmsVisible(false)
    }
  }

  // ── Sub-ship launch / return animation ──────────────────────────────────
  if (launchPhase === 'hatch_open') {
    if (scene.corridorHangar.hatchProgress >= 0.86) {
      launchPhase = 'descending'
    }
  } else if (launchPhase === 'descending') {
    subshipLocalY -= LAUNCH.animSpeed * dt
    scene.subship.group.position.y = subshipLocalY
    if (subshipLocalY <= LAUNCH.descentTarget) {
      const worldPos = new Vector3()
      scene.subship.group.getWorldPosition(worldPos)
      subshipState = createSubshipState([worldPos.x, worldPos.y, worldPos.z])
      scene.launchSubship()
      launchPhase = 'flying'
    }
  } else if (launchPhase === 'ascending') {
    subshipLocalY += LAUNCH.animSpeed * dt
    scene.subship.group.position.y = subshipLocalY
    if (subshipLocalY >= 0) {
      scene.subship.group.position.set(0, 0, 40)
      launchPhase = 'docked'
      // If returning from planet, complete the event now that we're safely docked
      if (eventManager.getActiveEventId() === 'planet') planetEvent.markComplete()
      // Return pilot to walking mode
      character.placeNearSubship()
      camCtrl.setMode('walking')
      camCtrl.setWalkYaw(-Math.PI / 2)
      character.mesh.visible = true
      scene.subship.setExteriorVisible(true)
      scene.subship.cockpitInterior.setArmsVisible(false)
      subshipArms.setVisible(false)
    }
  }

  // ── Input dispatch ───────────────────────────────────────────────────────
  if (mode === 'planet_surface') {
    const st0 = room.getState()

    // Only run climbing when fully landed (not during touchdown/disembark animation)
    if (st0.surface.landingPhase === 'on_surface') {
      // Zero-g locomotion: pass HELD state directly. updateClimbing detects
      // press (cast anchor) / release (drop anchor) from the held flags vs the
      // current anchor state, so no edge-detection is needed here.
      const climbInput = keyboard.getClimberInput()

      const result = updateClimbing(
        st0.surface,
        charWorldPos,
        planetEvent.getPlanetCenter(),
        camCtrl.getCamYaw(),
        camCtrl.getCamPitch(),
        climbInput,
        dt,
        planetEvent.mesh.nodes,
      )

      // Handle mined node
      if (result.minedNode) {
        planetEvent.collectNode(result.minedNode)
        const minerals = st0.ship.minerals + 1
        room.setState({ surface: result.surface, ship: { ...st0.ship, minerals } })
        hud.flashHit()
        hud.setMinerals(minerals)
      } else {
        room.setState({ surface: result.surface })
      }

      // Ice axe view animation — fires when a new anchor is thrown
      lastSwinging = result.swung
      if (lastSwinging !== 'none') {
        iceAxeView.triggerSwing(lastSwinging)
        camCtrl.shake(0.15)   // small impact shake at the moment the axe bites
      }
      iceAxeView.update(
        dt,
        result.surface.leftAnchorPos,
        result.surface.rightAnchorPos,
        planetEvent.getPlanetCenter(),
      )

      // HUD: show axe prompts
      hud.setAnchorPrompt(true, result.surface.leftAnchorPos !== null || result.surface.rightAnchorPos !== null)
    }

    // Main ship drifts regardless
    const physShipP = updatePhysics(st0.ship, dt)
    room.setState({ ship: physShipP, tick: st0.tick + 1 })
  } else if (mode === 'piloting' || mode === 'exterior') {
    const pilotInput = keyboard.getPilotInput()
    const state = room.getState()
    const next = router.dispatch('player1', pilotInput, state, dt)
    let physShip = updatePhysics(next.ship, dt)
    // ── Planet collision for main ship ────────────────────────────────────
    if (eventManager.getActiveEventId() === 'planet') {
      const center = planetEvent.getPlanetCenter()
      physShip = applyPlanetDrag(physShip, center)
      physShip = resolvePlanetCollision(physShip, center)
    }
    room.setState({ ship: physShip, tick: state.tick + 1 })
    audio.setThrottle(physShip.throttle)
    if (mode === 'piloting') scene.cockpit.update(pilotInput, physShip, dt)
  } else if (mode === 'subship_piloting') {
    const subInput = keyboard.getPilotInput()
    scene.subship.update(subInput, dt)   // animate HOTAS sticks
    subshipArms.update(subInput.yaw, subInput.throttleDelta, subInput.pitch, dt)
    const _surfSt = room.getState().surface
    const _touchingDown = _surfSt.landingPhase === 'touching_down'
    if (launchPhase === 'flying' && subshipState && !_touchingDown) {
      subshipState = updateSubship(subshipState, subInput, dt)

      // ── Planet surface collision + proximity drag ──────────────────────
      if (eventManager.getActiveEventId() === 'planet') {
        const center = planetEvent.getPlanetCenter()
        subshipState = applyPlanetDrag(subshipState, center)
        subshipState = resolvePlanetCollision(subshipState, center)
      }

      scene.subship.group.position.set(...subshipState.position)
      scene.subship.group.rotation.set(
        subshipState.rotation[0], subshipState.rotation[1], subshipState.rotation[2], 'YXZ',
      )
      audio.setThrottle(subshipState.throttle)
    } else if (_touchingDown && subshipState) {
      // During descent: fade thruster audio to zero so it's silent at touchdown
      audio.setThrottle(subshipState.throttle * Math.max(0, 1 - _surfSt.landingProgress * 1.5))
    } else {
      audio.setThrottle(0)
    }
    // Main ship drifts regardless
    const st = room.getState()
    const physShip = updatePhysics(st.ship, dt)
    room.setState({ ship: physShip, tick: st.tick + 1 })
  } else {
    audio.setThrottle(0)
    // Character movement
    const axes = keyboard.getWalkAxes()
    if (keyboard.consumeJustPressed('Space')) character.jump()
    if (keyboard.consumeJustPressed('KeyC'))  character.toggleCrouch()
    character.move(axes.fwd, axes.right, dt, axes.isRunning, camCtrl.getCamYaw())

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

    // Entrance door animation (open when alien invading or character in corridor)
    const isAlienEvent = eventManager.getActiveEventId() === 'alien'
    cockpitRoom.update(isAlienEvent, character.position.z > 14, dt, totalTime)

    const state = room.getState()
    const physShip = updatePhysics(state.ship, dt)
    room.setState({ ship: physShip, tick: state.tick + 1 })
  }

  // ── Events (only trigger when piloting or sub-ship launched) ────────────
  const phase = room.getState().phase
  if ((mode === 'piloting' || mode === 'exterior' || (mode === 'subship_piloting' && launchPhase === 'flying')) && phase === 'PILOTING') {
    pilotingTimer += dt
    if (pilotingTimer >= nextTriggerDelay) {
      pilotingTimer    = 0
      nextTriggerDelay = 22 + Math.random() * 22
      // Weighted random event selection
      const roll = Math.random()
      const hull = room.getState().ship.hull
      let eventId = 'asteroid'
      if (roll < 0.25)        eventId = 'alien'
      else if (roll < 0.38)   eventId = 'blackhole'
      else if (roll < 0.50)   eventId = 'subship'   // scout probe deploys
      else if (roll < 0.65)   eventId = 'planet'    // planet exploration
      else if (hull < 40)     eventId = 'eva'        // EVA only when hull critical
      eventManager.trigger(eventId)
    }
    // Player fires at alien (Space key while piloting or sub-ship)
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

  // ── Planet landing animation ─────────────────────────────────────────────
  {
    const surf = room.getState().surface
    if (surf.landingPhase === 'touching_down') {
      const prevProg = surf.landingProgress
      const progress  = Math.min(1, prevProg + dt / LANDING.touchdownDur)
      room.setState({ surface: { ...surf, landingProgress: progress } })

      // One-shot shakes: primary hull contact, then secondary settle
      if (prevProg < 0.87 && progress >= 0.87) camCtrl.shake(0.8)
      if (prevProg < 0.95 && progress >= 0.95) camCtrl.shake(0.35)

      // Descend subship from stop radius toward surface
      const center      = planetEvent.getPlanetCenter()
      const subPos      = scene.subship.group.position
      const toSurface   = subPos.clone().sub(center).normalize()
      const targetDist  = PLANET_RADIUS + SURFACE_EYE + 0.5
      const currentDist = subPos.distanceTo(center)
      const newDist     = currentDist + (targetDist - currentDist) * Math.min(1, dt * 2.5)
      scene.subship.group.position.copy(center).addScaledVector(toSurface, newDist)
      if (subshipState) subshipState = { ...subshipState, position: [subPos.x, subPos.y, subPos.z] as [number, number, number] }

      // Gradually orient sub-ship so its belly faces the planet (up = surface normal)
      const surfUp = scene.subship.group.position.clone().sub(center).normalize()
      _landQuat.setFromUnitVectors(_shipUpVec, surfUp)
      scene.subship.group.quaternion.slerp(_landQuat, Math.min(1, dt * 1.8))

      // Deploy landing legs over the descent
      scene.subship.deployLegs(progress)

      if (progress >= 1) {
        const center2  = planetEvent.getPlanetCenter()
        const toCenter = scene.subship.group.position.clone().sub(center2)
        charWorldPos.copy(center2).addScaledVector(toCenter.normalize(), PLANET_RADIUS + SURFACE_FOOT)
        camCtrl.setWalkYaw(Math.PI + Math.atan2(toCenter.x, toCenter.z))
        camCtrl.beginDisembarkLerp()
        subshipArms.setVisible(false)   // hide cockpit arms as camera leaves cockpit
        iceAxeView.group.visible      = true
        iceAxeView.worldGroup.visible = true

        // Snapshot the landed orientation + zero velocity so that when the player
        // re-boards after mining, physics resumes from the surface-aligned pose
        // instead of snapping back to [0,0,0] rotation (which would put the
        // camera ~3 m inside the planet sphere, making the planet appear to vanish).
        if (subshipState) {
          _landedEuler.setFromQuaternion(scene.subship.group.quaternion)
          subshipState = { ...subshipState,
            rotation: [_landedEuler.x, _landedEuler.y, _landedEuler.z],
            velocity: [0, 0, 0],
          }
        }

        room.setState({ surface: { ...room.getState().surface, landingPhase: 'disembarking', landingProgress: 0 } })
      }
    } else if (surf.landingPhase === 'disembarking') {
      const progress = Math.min(1, surf.landingProgress + dt / LANDING.disembarkDur)
      room.setState({ surface: { ...surf, landingProgress: progress } })

      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
      camCtrl.applyDisembarkLerp(charWorldPos, planetEvent.getPlanetCenter(), ease)

      if (progress >= 1) {
        // Camera has reached surface eye — enter tethering phase
        character.mesh.visible = false
        room.setState({ surface: { ...room.getState().surface, landingPhase: 'tethering', landingProgress: 0 } })
      }
    } else if (surf.landingPhase === 'tethering') {
      // First frame of tethering: trigger the animation
      if (surf.landingProgress === 0) {
        tetherView.trigger()
        room.setState({ surface: { ...surf, landingProgress: 1 } })
      }
      tetherView.update(dt)

      if (tetherView.isComplete) {
        // Tether attached — enter full planet_surface mode
        camCtrl.setMode('planet_surface')
        keyboard.requestPointerLock()
        subshipArms.setVisible(false)
        scene.subship.setExteriorVisible(true)  // P1: show parked sub-craft from outside
        hud.setAnchorPrompt(true, false)
        const landPos: [number, number, number] = [charWorldPos.x, charWorldPos.y, charWorldPos.z]
        planetEvent.scatterNodesNear(charWorldPos)
        room.setState({ surface: { ...createInitialSurfaceState(),
          landingPhase: 'on_surface', landingProgress: 1,
          leftAnchorPos: landPos, rightAnchorPos: landPos } })
      }
    } else if (surf.landingPhase === 'reboarding') {
      // ── Camera lerps from surface eye back to subship cockpit eye ────────
      const progress = Math.min(1, surf.landingProgress + dt / LANDING.reboardDur)
      room.setState({ surface: { ...surf, landingProgress: progress } })

      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
      camCtrl.applyReboardLerp(ease)

      if (progress >= 1) {
        // Camera is back at cockpit eye — hand control to subship_piloting
        planetLandPhase               = 'none'
        landCooldown                  = 15   // suppress land prompt briefly after reboarding
        iceAxeView.group.visible      = false
        iceAxeView.worldGroup.visible = false
        character.mesh.visible        = true
        subshipArms.setVisible(true)
        scene.subship.setExteriorVisible(false)
        camCtrl.setMode('subship_piloting')
        room.setState({ surface: createInitialSurfaceState() })
      }
    }
  }

  // ── Hangar hatch animation ───────────────────────────────────────────────
  // Bay door only shown to the subship pilot, not to the walking player
  const _showBayDoor = mode === 'subship_piloting' || launchInProgress
  scene.corridorHangar.update(launchPhase !== 'docked', dt, _showBayDoor)

  // ── Sync ship group (lerped for smooth movement) ─────────────────────────
  const ship = room.getState().ship
  const [rx, ry, rz] = ship.rotation
  // Lerp factor: high enough for responsiveness, low enough to smooth out jitter
  const posLerp = Math.min(1, 14 * dt)
  const rotLerp = Math.min(1, 10 * dt)
  dispX += (ship.position[0] - dispX) * posLerp
  dispY += (ship.position[1] - dispY) * posLerp
  dispZ += (ship.position[2] - dispZ) * posLerp
  scene.shipGroup.position.set(dispX, dispY, dispZ)
  _tgtEuler.set(rx, ry, rz)
  _tgtQuat.setFromEuler(_tgtEuler)
  dispQuat.slerp(_tgtQuat, rotLerp)
  scene.shipGroup.setRotationFromQuaternion(dispQuat)

  // ── Camera update ────────────────────────────────────────────────────────
  const _surfLandPhase = room.getState().surface.landingPhase
  const _isFullySurface = mode === 'planet_surface' && _surfLandPhase === 'on_surface'
  const _climbKeys  = _isFullySurface ? keyboard.getClimberInput() : undefined
  // Always consume mouse delta to prevent accumulation; planet surface gets it via planetCtx
  const _mouseDelta = keyboard.consumeMouseDelta()
  const _planetCtx = _isFullySurface
    ? { charWorldPos, planetCenter: planetEvent.getPlanetCenter(),
        rotateLeft: !!_climbKeys?.rotateLeft, rotateRight: !!_climbKeys?.rotateRight,
        ...(_mouseDelta.dx !== 0 ? { mouseDX: _mouseDelta.dx } : {}),
        ...(_mouseDelta.dy !== 0 ? { mouseDY: _mouseDelta.dy } : {}) }
    : undefined
  // Pass mouse delta directly to camCtrl for piloting/subship modes;
  // skip during landing transitions (dedicated lerp functions handle those)
  if (_surfLandPhase !== 'disembarking' && _surfLandPhase !== 'tethering' && _surfLandPhase !== 'reboarding') {
    const _mx = _isFullySurface ? 0 : _mouseDelta.dx  // planet surface uses planetCtx
    const _my = _isFullySurface ? 0 : _mouseDelta.dy
    camCtrl.update(character, dt, _mx, _my, _planetCtx)
  }

  // ── HUD ──────────────────────────────────────────────────────────────────
  const nearHelm    = mode === 'walking' && character.isNearHelm()
  const nearSubship = mode === 'walking' && character.isNearSubship()
  hud.setInteractPrompt(nearHelm || nearSubship, nearSubship ? 'subship' : 'helm')
  hud.setLaunchPrompt(launchPhase === 'docked' && mode === 'subship_piloting')

  // Dock prompt: show when flying sub-ship near the hangar
  if (launchPhase === 'flying' && mode === 'subship_piloting') {
    _hangarWP.set(
      scene.shipGroup.position.x,
      scene.shipGroup.position.y - 1.1,
      scene.shipGroup.position.z + 40,
    )
    hud.setDockPrompt(scene.subship.group.position.distanceTo(_hangarWP) < 18)
  } else {
    hud.setDockPrompt(false)
  }

  // Land prompt — hysteresis: show at <PLANET_RADIUS+18, hide only at >PLANET_RADIUS+40
  // Suppressed for landCooldown seconds after lift-off to prevent instant re-prompt.
  if (landCooldown > 0) landCooldown = Math.max(0, landCooldown - dt)
  if (eventManager.getActiveEventId() === 'planet' && launchPhase === 'flying' && landCooldown === 0) {
    const _distToPlanet = scene.subship.group.position.distanceTo(planetEvent.getPlanetCenter())
    if (!landPromptActive && _distToPlanet < PLANET_RADIUS + 18) landPromptActive = true
    if (landPromptActive  && _distToPlanet > PLANET_RADIUS + 40) landPromptActive = false
  } else {
    landPromptActive = false
  }
  const _nearPlanet = launchPhase === 'flying' && mode === 'subship_piloting'
    && planetLandPhase === 'none' && landPromptActive
  hud.setLandPrompt(_nearPlanet)

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

  // EVA progress
  hud.setEvaProgress(activeEvent === 'eva', activeEvent === 'eva' ? evaEvent.getProgress() : 0)
  // HUD clock (dock banner timer)
  hud.tick(dt)

  if (activeEvent === 'alien') {
    hud.setAlienWarning(true, alienEvent.getDistanceToShip(), alienEvent.getHealth())
    const inRange = (mode === 'piloting' || mode === 'exterior' || mode === 'subship_piloting') && alienEvent.getDistanceToShip() < 120
    hud.setCombatPrompt(inRange)
    hud.setStationWaypoint(false)
  } else {
    hud.setAlienWarning(false)
    hud.setCombatPrompt(false)
    // Show station waypoint when not in event
    const showStation = (mode === 'piloting' || mode === 'exterior' || mode === 'subship_piloting') && !gameOver
    const dockReady   = distToStation < 35 && shipSpeed < 6
    hud.setStationWaypoint(showStation, distToStation, dockReady)
  }

  // ── Mode indicator ────────────────────────────────────────────────────────
  hud.setMode(
    mode === 'exterior'         ? 'EXT VIEW'  :
    mode === 'subship_piloting' ? 'SUB-SHIP'  :
    mode === 'planet_surface'   ? 'ON SURFACE' : mode
  )

  // ── Surface HUD hints (pointer-lock prompt + control guide + reboard) ───
  const onSurface = mode === 'planet_surface'
  const _surfActive = onSurface && room.getState().surface.landingPhase === 'on_surface'
  hud.setSurfaceLockHint(_surfActive && !keyboard.isPointerLocked())
  hud.setSurfaceControlHint(_surfActive)
  if (_surfActive) {
    const _dts = charWorldPos.distanceTo(scene.subship.group.position)
    hud.setReboardPrompt(_dts <= LANDING.reboardDist)
  } else {
    hud.setReboardPrompt(false)
  }

  // ── Mission progress + docking check ────────────────────────────────────
  const [px, py, pz]   = ship.position
  const distFromOrigin = Math.sqrt(px * px + py * py + pz * pz)
  hud.setMissionProgress(distFromOrigin)

  if (!gameOver && distToStation < 35 && shipSpeed < 6 && keyboard.consumeJustPressed('Space')) {
    const st = room.getState()
    room.setState({ ship: { ...st.ship, hull: 100, oxygen: 100 } })
    audio.playDock()
    hud.flashHit()
    hud.showDockSuccess()
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
}

requestAnimationFrame(loop)
