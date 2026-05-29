import {
  AmbientLight,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  PointLight,
  Scene,
  WebGLRenderer,
} from 'three'
import { createStarField } from './StarField.js'
import { CockpitInterior } from './CockpitInterior.js'
import { ShipExterior } from './ShipExterior.js'

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

  constructor() {
    this.scene = new Scene()

    this.camera = new PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 2000)

    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    document.body.appendChild(this.renderer.domElement)

    // ── Lighting ─────────────────────────────────────────────────────────
    this.scene.add(new AmbientLight(0xffffff, 0.25))

    const sun = new DirectionalLight(0xfff8e8, 1.0)
    sun.position.set(20, 30, 10)
    this.scene.add(sun)

    // Cockpit screen glow
    const screenGlow = new PointLight(0x0044aa, 0.6, 2.5)
    screenGlow.position.set(0, EYE_Y - 0.3, EYE_Z - 0.6)

    // ── Stars ─────────────────────────────────────────────────────────────
    this.scene.add(createStarField())

    // ── Ship group (everything inside the ship moves with it) ─────────────
    this.shipGroup = new Group()

    // Camera parented to shipGroup — no manual sync needed in main.ts
    this.camera.position.set(EYE_X, EYE_Y, EYE_Z)
    this.shipGroup.add(this.camera)

    // Screen glow follows cockpit
    this.shipGroup.add(screenGlow)

    // Cockpit interior
    this.cockpit = new CockpitInterior()
    this.shipGroup.add(this.cockpit.group)

    // Ship exterior hull (visible only in exterior camera mode)
    this.shipExterior = new ShipExterior()
    this.shipGroup.add(this.shipExterior.group)

    this.scene.add(this.shipGroup)

    window.addEventListener('resize', this.onResize.bind(this))
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
