import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'

// Two ice axes shown in 1st-person (parented directly to the camera)

const REST_Y    = -0.28   // hanging at side
const SWING_Y   =  0.05   // raised for swing
const REST_Z    = -0.30
const SWING_Z   = -0.45
const REST_ROT  = -0.25   // tilt at rest
const SWING_ROT = -0.80   // steeper tilt at swing
const PLANT_ROT =  0.35   // tilted forward when planted

function buildAxe(flipX: number): Group {
  const g    = new Group()
  const metal = new MeshStandardMaterial({ color: 0x3a3a4a, metalness: 0.88, roughness: 0.22 })
  const grip  = new MeshStandardMaterial({ color: 0x1a1208, metalness: 0.05, roughness: 0.92 })
  const spike = new MeshStandardMaterial({ color: 0x8899aa, metalness: 0.95, roughness: 0.08 })

  // Handle (cylinder, slightly tapered)
  const handle = new Mesh(new CylinderGeometry(0.014, 0.020, 0.44, 8), grip)
  handle.rotation.z = flipX * 0.10
  g.add(handle)

  // Head (pick) — an angled tapered box
  const head = new Mesh(new BoxGeometry(0.025, 0.10, 0.28), metal)
  head.position.set(flipX * 0.01, 0.265, -0.06)
  head.rotation.x = -0.38
  g.add(head)

  // Spike tip
  const tip = new Mesh(new CylinderGeometry(0.003, 0.012, 0.12, 6), spike)
  tip.position.set(flipX * 0.01, 0.300, -0.18)
  tip.rotation.x = -0.55
  g.add(tip)

  // Grip wrap
  for (let i = 0; i < 4; i++) {
    const wrap = new Mesh(new CylinderGeometry(0.022, 0.022, 0.016, 8),
      new MeshStandardMaterial({ color: 0x2a2a36, metalness: 0.1, roughness: 0.95 }))
    wrap.position.y = -0.12 + i * 0.055
    g.add(wrap)
  }

  return g
}

export class IceAxeView {
  readonly group: Group
  private readonly leftAxe:  Group
  private readonly rightAxe: Group

  // Animated state: 0=rest, 1=planted
  private leftState  = 0
  private rightState = 0

  constructor() {
    this.group = new Group()

    this.leftAxe  = buildAxe(-1)
    this.rightAxe = buildAxe(1)

    // Initial rest position (lower corners of screen)
    this.leftAxe.position.set(-0.22, REST_Y, REST_Z)
    this.leftAxe.rotation.x = REST_ROT
    this.rightAxe.position.set(0.22, REST_Y, REST_Z)
    this.rightAxe.rotation.x = REST_ROT

    this.group.add(this.leftAxe)
    this.group.add(this.rightAxe)
  }

  /**
   * Call each frame with the current pull-animation progress (0-1).
   * @param swinging 'left'|'right'|'none'  which axe just started swinging
   * @param pullProgress 0-1 from SurfaceState.pullProgress
   * @param activeAxe which axe swings NEXT ('left'|'right')
   */
  update(swinging: 'left' | 'right' | 'none', pullProgress: number, activeAxe: 'left' | 'right', dt: number): void {
    // Drive left state toward planted if it was just used, else toward rest
    const leftTarget  = (swinging === 'left'  || (activeAxe === 'right' && pullProgress > 0 && pullProgress < 1)) ? 1 : 0
    const rightTarget = (swinging === 'right' || (activeAxe === 'left'  && pullProgress > 0 && pullProgress < 1)) ? 1 : 0

    this.leftState  += (leftTarget  - this.leftState)  * Math.min(1, dt * 12)
    this.rightState += (rightTarget - this.rightState) * Math.min(1, dt * 12)

    this._applyPose(this.leftAxe,  this.leftState,  -1)
    this._applyPose(this.rightAxe, this.rightState,  1)
  }

  private _applyPose(axe: Group, t: number, side: number): void {
    axe.position.x = side * 0.22
    axe.position.y = REST_Y + (SWING_Y - REST_Y) * t
    axe.position.z = REST_Z + (SWING_Z - REST_Z) * t
    axe.rotation.x = REST_ROT + (PLANT_ROT - REST_ROT) * t
  }

  /** Trigger a quick swing animation on one axe */
  triggerSwing(side: 'left' | 'right'): void {
    if (side === 'left')  this.leftState  = 0.6
    else                  this.rightState = 0.6
  }
}
