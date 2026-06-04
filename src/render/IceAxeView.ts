import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'

// Two ice axes shown in 1st-person (parented directly to the camera)

const REST_Y    = -0.18   // raised from -0.28 so hands stay inside 85° FOV
const SWING_Y   =  0.05   // raised for swing
const REST_Z    = -0.35   // pushed out from -0.30 for a natural arm-length extension
const SWING_Z   = -0.48
const REST_ROT  = -0.25   // tilt at rest
const SWING_ROT = -0.80   // steeper tilt at swing
const PLANT_ROT =  0.35   // tilted forward when planted

function buildAxe(flipX: number): Group {
  const g    = new Group()
  const metal = new MeshStandardMaterial({ color: 0x3a3a4a, metalness: 0.88, roughness: 0.22 })
  const grip  = new MeshStandardMaterial({ color: 0x1a1208, metalness: 0.05, roughness: 0.92 })
  const spike = new MeshStandardMaterial({ color: 0x8899aa, metalness: 0.95, roughness: 0.08 })
  // depthTest=false: arm/sleeve must always render on top of the planet surface mesh
  const suit  = new MeshStandardMaterial({ color: 0x252d3a, metalness: 0.12, roughness: 0.82, depthTest: false })
  const cuffM = new MeshStandardMaterial({ color: 0x1a2030, metalness: 0.38, roughness: 0.55, depthTest: false })
  const glove = new MeshStandardMaterial({ color: 0x141c28, metalness: 0.10, roughness: 0.88, depthTest: false })

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

  // Gloved hand gripping the handle (just below grip wrap)
  const hand = new Mesh(new CylinderGeometry(0.028, 0.030, 0.10, 8), glove)
  hand.position.set(flipX * 0.004, -0.20, 0)
  g.add(hand)

  // Wrist cuff (spacesuit cuff ring at bottom of handle)
  const cuff = new Mesh(new CylinderGeometry(0.032, 0.032, 0.030, 10), cuffM)
  cuff.position.set(0, -0.26, 0)
  g.add(cuff)

  // Forearm sleeve — comes from below the screen up to the cuff
  const sleeve = new Mesh(new CylinderGeometry(0.028, 0.038, 0.38, 8), suit)
  sleeve.position.set(flipX * 0.012, -0.49, 0.04)
  sleeve.rotation.x = 0.22  // slight forward tilt for natural arm angle
  g.add(sleeve)

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
    this.group.renderOrder = 999

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
