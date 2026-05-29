import {
  AmbientLight,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Points,
  Scene,
  WebGLRenderer,
} from 'three'
import { createStarField } from './StarField.js'
import { createSpaceshipMesh } from './SpaceshipMesh.js'

export class SceneManager {
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  readonly renderer: WebGLRenderer
  readonly shipMesh: Group
  private readonly stars: Points

  constructor() {
    this.scene = new Scene()

    this.camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000)
    this.camera.position.set(0, 4, 12)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    document.body.appendChild(this.renderer.domElement)

    const ambient = new AmbientLight(0xffffff, 0.4)
    this.scene.add(ambient)

    const sun = new DirectionalLight(0xffffff, 1.2)
    sun.position.set(10, 20, 10)
    this.scene.add(sun)

    this.stars = createStarField()
    this.scene.add(this.stars)

    this.shipMesh = createSpaceshipMesh()
    this.scene.add(this.shipMesh)

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
