import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three'

// Camera-parented FPS pilot arms for the sub-ship cockpit.
// Positioned in camera-local space so the pilot always sees their hands
// on the HOTAS controls at the bottom of the screen.

const SUIT_COL  = 0x47586e   // suit sleeve — readable against the dark cockpit
const GLOVE_COL = 0x3c4a5e   // glove — lightened further so the hand reads as a hand
const CUFF_COL  = 0x33405a   // cuff ring
const STICK_COL = 0x10161f   // HOTAS grip (kept dark — Lethal-Company tone)

// depthTest=false ensures arms always render on top of 3-D scene geometry
// (the HOTAS sticks in world space would otherwise occlude camera-parented arms)
function noDepth(m: MeshStandardMaterial): MeshStandardMaterial {
  m.depthTest = false
  return m
}

function buildPilotArm(side: number): Group {
  const g        = new Group()
  const suitMat  = noDepth(new MeshStandardMaterial({ color: SUIT_COL,  metalness: 0.15, roughness: 0.75, emissive: SUIT_COL,  emissiveIntensity: 0.18 }))
  const gloveMat = noDepth(new MeshStandardMaterial({ color: GLOVE_COL, metalness: 0.10, roughness: 0.85, emissive: GLOVE_COL, emissiveIntensity: 0.30 }))
  const cuffMat  = noDepth(new MeshStandardMaterial({ color: CUFF_COL,  metalness: 0.50, roughness: 0.45, emissive: CUFF_COL,  emissiveIntensity: 0.12 }))
  const stickMat = noDepth(new MeshStandardMaterial({ color: STICK_COL, metalness: 0.22, roughness: 0.90 }))

  // Forearm — runs from off-screen bottom up to the hand
  const forearm = new Mesh(new CylinderGeometry(0.028, 0.038, 0.38, 8), suitMat)
  forearm.position.set(0, -0.19, 0.04)
  forearm.rotation.x = 0.30   // angled slightly forward/toward screen
  g.add(forearm)

  // Upper arm hint (just barely visible at very bottom edge)
  const upper = new Mesh(new CylinderGeometry(0.032, 0.040, 0.22, 8), suitMat)
  upper.position.set(side * 0.020, -0.46, 0.10)
  upper.rotation.x = 0.20
  upper.rotation.z = side * 0.15
  g.add(upper)

  // Wrist cuff
  const cuff = new Mesh(new CylinderGeometry(0.032, 0.032, 0.032, 10), cuffMat)
  cuff.position.set(0, 0.02, 0)
  g.add(cuff)

  // Gloved palm — wraps the grip
  const hand = new Mesh(new BoxGeometry(0.070, 0.052, 0.090), gloveMat)
  hand.position.set(0, 0.072, -0.004)
  g.add(hand)

  // Four fingers curling over the FRONT of the grip (toward the screen, -z),
  // each a short cylinder laid horizontal so the knuckles read clearly.
  for (let i = 0; i < 4; i++) {
    const finger = new Mesh(new CylinderGeometry(0.0095, 0.0095, 0.052, 6), gloveMat)
    finger.rotation.z = Math.PI / 2                       // lay finger horizontal (along x)
    finger.position.set((i - 1.5) * 0.017, 0.090, -0.050) // across the front face of the grip
    g.add(finger)
    // second segment (fingertip) curling further down/in
    const tip = new Mesh(new CylinderGeometry(0.0085, 0.0085, 0.030, 6), gloveMat)
    tip.rotation.z = Math.PI / 2
    tip.position.set((i - 1.5) * 0.017, 0.070, -0.066)
    g.add(tip)
  }

  // Thumb wrapping from the inner side
  const thumb = new Mesh(new CylinderGeometry(0.011, 0.011, 0.046, 6), gloveMat)
  thumb.rotation.x = side * 0.5
  thumb.position.set(side * 0.040, 0.066, -0.030)
  g.add(thumb)

  // HOTAS stick grip visible above hand
  const shaft = new Mesh(new CylinderGeometry(0.014, 0.018, 0.14, 8), stickMat)
  shaft.position.set(0, 0.15, 0)
  g.add(shaft)

  const stickBase = new Mesh(new CylinderGeometry(0.026, 0.030, 0.022, 10), stickMat)
  stickBase.position.set(0, 0.10, 0)
  g.add(stickBase)

  // Top action button (blue glow)
  const btn = new Mesh(
    new SphereGeometry(0.011, 6, 4),
    noDepth(new MeshStandardMaterial({ color: 0x1a3355, emissive: 0x0a2244, emissiveIntensity: 0.80 })),
  )
  btn.position.set(0, 0.225, -0.012)
  g.add(btn)

  // Trigger (front of grip)
  const trig = new Mesh(new BoxGeometry(0.020, 0.030, 0.018), gloveMat)
  trig.position.set(0, 0.050, -0.046)
  g.add(trig)

  return g
}

// Rest positions in camera-local space (lower-left/right of view).
// z=-0.28 puts arms in FRONT of the 3-D HOTAS geometry (~z=-0.25 in camera-local)
// so depth order is correct even without relying solely on depthTest=false.
const LEFT_POS  = new Vector3(-0.235, -0.285, -0.270)
const RIGHT_POS = new Vector3( 0.235, -0.285, -0.270)

export class SubshipArmsView {
  readonly group: Group
  private readonly leftArm:  Group
  private readonly rightArm: Group

  // Smoothed animation state
  private yawSmooth      = 0
  private pitchSmooth    = 0
  private throttleSmooth = 0

  constructor() {
    this.group = new Group()
    this.group.renderOrder = 999   // draw after all scene geometry

    this.leftArm  = buildPilotArm(-1)
    this.rightArm = buildPilotArm(1)

    this.leftArm.position.copy(LEFT_POS)
    this.rightArm.position.copy(RIGHT_POS)

    this.group.add(this.leftArm)
    this.group.add(this.rightArm)
    this.group.visible = false
  }

  /**
   * Animate arms based on current pilot input.
   * @param yaw          -1..1 yaw input
   * @param throttleDelta -1..1 throttle input
   * @param pitch        -1..1 pitch input
   * @param dt           frame delta in seconds
   */
  update(yaw: number, throttleDelta: number, pitch: number, dt: number): void {
    const s = Math.min(1, dt * 10)
    this.yawSmooth      += (yaw           - this.yawSmooth)      * s
    this.pitchSmooth    += (pitch         - this.pitchSmooth)    * s
    this.throttleSmooth += (throttleDelta - this.throttleSmooth) * s

    // Right hand: steering stick — tilts with yaw (z-rot) and pitch (x-rot)
    this.rightArm.rotation.z = -this.yawSmooth      * 0.18
    this.rightArm.rotation.x =  this.pitchSmooth    * 0.14

    // Left hand: throttle lever — rocks forward/back with throttleDelta
    this.leftArm.rotation.x  = -this.throttleSmooth * 0.16
  }

  setVisible(v: boolean): void {
    this.group.visible = v
  }
}
