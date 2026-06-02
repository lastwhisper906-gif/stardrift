import {
  AmbientLight,
  DirectionalLight,
  Euler,
  Group,
  PerspectiveCamera,
  PointLight,
  Scene,
  WebGLRenderer,
} from 'three'
import { createStarField } from './StarField.js'
import { CockpitInterior } from './CockpitInterior.js'
import { ShipExterior } from './ShipExterior.js'
import { SpaceStation } from './SpaceStation.js'
import { CorridorHangar } from './CorridorHangar.js'
import { SubshipVehicle, SUBSHIP_OFFSET_Z } from './SubshipVehicle.js'

// Pilot eye position inside the cockpit (shipGroup local space)
const EYE_X = 0
const EYE_Y = 0.08
const EYE_Z = 0.10

export class SceneManager {
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  readonly renderer: WebGLRenderer
  readonly shipGroup: Group
  readonly cockpit: CockpitInterior
  readonly shipExterior: ShipExterior
  readonly muzzleLight: PointLight
  readonly spaceStation: SpaceStation
  readonly corridorHangar: CorridorHangar
  readonly subship: SubshipVehicle

  constructor() {
    this.scene = new Scene()

    this.camera = new PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 2000)

    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    document.body.appendChild(this.renderer.domElement)

    // ── Lighting ─────────────────────────────────────────────────────────
    this.scene.add(new AmbientLight(0xffffff, 0.85))  // brighter ambient

    const sun = new DirectionalLight(0xfff8e8, 1.4)
    sun.position.set(20, 30, 10)
    this.scene.add(sun)

    // Cockpit screen glow (instrument lights)
    const screenGlow = new PointLight(0x0044aa, 0.8, 3.5)
    screenGlow.position.set(0, EYE_Y - 0.3, EYE_Z - 0.6)

    this.scene.add(createStarField())

    // ── Ship group (everything inside the ship moves with it) ─────────────
    this.shipGroup = new Group()

    // Camera parented to shipGroup — no manual sync needed in main.ts
    this.camera.position.set(EYE_X, EYE_Y, EYE_Z)
    this.shipGroup.add(this.camera)

    // Screen glow follows cockpit
    this.shipGroup.add(screenGlow)

    // Single interior fill — covers full ship length; replaces 3 overlapping lights
    const interiorFill = new PointLight(0xbbccdd, 2.0, 48)
    interiorFill.position.set(0, 3.0, 10.0)
    this.shipGroup.add(interiorFill)

    // Cockpit interior
    this.cockpit = new CockpitInterior()
    this.shipGroup.add(this.cockpit.group)

    // Ship exterior hull (visible only in exterior camera mode)
    this.shipExterior = new ShipExterior()
    this.shipGroup.add(this.shipExterior.group)

    // Muzzle flash light (nose of ship, very brief intense burst when firing)
    this.muzzleLight = new PointLight(0x00ffaa, 0, 30)
    this.muzzleLight.position.set(0, 2, -8)
    this.shipGroup.add(this.muzzleLight)

    // Corridor + hangar behind cockpit room
    this.corridorHangar = new CorridorHangar()
    this.shipGroup.add(this.corridorHangar.group)

    // Sub-ship docked in hangar
    this.subship = new SubshipVehicle()
    this.shipGroup.add(this.subship.group)

    this.scene.add(this.shipGroup)

    // Space station (in world space, not shipGroup)
    this.spaceStation = new SpaceStation()
    this.scene.add(this.spaceStation.group)

    window.addEventListener('resize', this.onResize.bind(this))
  }

  isSubshipLaunched = false

  /** Detach sub-ship from shipGroup into world space (preserves world transform). */
  launchSubship(): void {
    if (!this.isSubshipLaunched) {
      this.scene.attach(this.subship.group)
      this.isSubshipLaunched = true
    }
  }

  /** Re-attach sub-ship back to shipGroup at docked position. */
  dockSubship(): void {
    if (this.isSubshipLaunched) {
      this.shipGroup.attach(this.subship.group)
      this.subship.group.position.set(0, 0, SUBSHIP_OFFSET_Z)
      this.subship.group.setRotationFromEuler(new Euler(0, 0, 0))
      this.isSubshipLaunched = false
    }
  }

  /** Attach back to shipGroup for ascent animation — places subship below the hatch. */
  attachSubshipForAscent(): void {
    if (this.isSubshipLaunched) {
      this.shipGroup.attach(this.subship.group)
      this.subship.group.position.set(0, -8.0, SUBSHIP_OFFSET_Z)
      this.subship.group.setRotationFromEuler(new Euler(0, 0, 0))
      this.isSubshipLaunched = false
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
