import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { CLIMBING } from '../tuning.js'

// Two ice axes shown in 1st-person (parented directly to the camera)

const REST_Y    = -0.18   // raised from -0.28 so hands stay inside 85° FOV
const REST_Z    = -0.35   // pushed out from -0.30 for a natural arm-length extension
const REST_ROT  = -0.25   // tilt at rest

// Windup pose — axe pulls up and back before strike
const WINDUP_Y    =  0.06
const WINDUP_Z    = -0.22
const WINDUP_ROT  = -0.60

// Impact pose — axe drives sharply forward and down into ice
const IMPACT_Y    = -0.30
const IMPACT_Z    = -0.52
const IMPACT_ROT  =  0.90

type AxePhase = 'rest' | 'windup' | 'impact' | 'hold' | 'return'
interface AxeAnimState { phase: AxePhase; timer: number }

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

// World-space planted axe: just the tool (no arm/sleeve), rendered in scene space
// at the anchor position on the planet surface.
function buildPlantedAxe(flipX: number): Group {
  const g     = new Group()
  const metal = new MeshStandardMaterial({ color: 0x3a3a4a, metalness: 0.88, roughness: 0.22 })
  const grip  = new MeshStandardMaterial({ color: 0x1a1208, metalness: 0.05, roughness: 0.92 })
  const spike = new MeshStandardMaterial({ color: 0x8899aa, metalness: 0.95, roughness: 0.08 })

  const handle = new Mesh(new CylinderGeometry(0.014, 0.020, 0.44, 8), grip)
  handle.rotation.z = flipX * 0.10
  g.add(handle)

  const head = new Mesh(new BoxGeometry(0.025, 0.10, 0.28), metal)
  head.position.set(flipX * 0.01, 0.265, -0.06)
  head.rotation.x = -0.38
  g.add(head)

  const tip = new Mesh(new CylinderGeometry(0.003, 0.012, 0.12, 6), spike)
  tip.position.set(flipX * 0.01, 0.300, -0.18)
  tip.rotation.x = -0.55
  g.add(tip)

  return g
}

const _Y_AXIS  = new Vector3(0, 1, 0)

const REST_STATE: AxeAnimState = { phase: 'rest', timer: 0 }

export class IceAxeView {
  readonly group:      Group   // camera-space — add to scene.camera
  readonly worldGroup: Group   // world-space  — add to scene.scene

  private readonly leftAxe:   Group
  private readonly rightAxe:  Group
  private readonly leftPlanted:  Group
  private readonly rightPlanted: Group

  private leftAnim:  AxeAnimState = { ...REST_STATE }
  private rightAnim: AxeAnimState = { ...REST_STATE }

  // Pre-allocated scratch
  private readonly _plantQ    = new Quaternion()
  private readonly _anchorV   = new Vector3()
  private readonly _outward   = new Vector3()
  private readonly _negOutward = new Vector3()

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

    // World-space planted axes (shown at anchor position on planet surface)
    this.worldGroup = new Group()
    this.leftPlanted  = buildPlantedAxe(-1)
    this.rightPlanted = buildPlantedAxe(1)
    this.leftPlanted.visible  = false
    this.rightPlanted.visible = false
    this.worldGroup.add(this.leftPlanted)
    this.worldGroup.add(this.rightPlanted)
  }

  /** Start a multi-phase strike animation on the given axe. */
  triggerSwing(side: 'left' | 'right'): void {
    if (side === 'left')  this.leftAnim  = { phase: 'windup', timer: 0 }
    else                  this.rightAnim = { phase: 'windup', timer: 0 }
  }

  /**
   * Advance animations and update poses each frame.
   * Planted world-space axes appear at impact phase start, hide after return phase ends.
   */
  update(
    dt: number,
    leftAnchorPos:  [number, number, number] | null,
    rightAnchorPos: [number, number, number] | null,
    planetCenter: Vector3,
  ): void {
    this.leftAnim  = this._advanceAnim(this.leftAnim,  dt)
    this.rightAnim = this._advanceAnim(this.rightAnim, dt)

    this._applyPose(this.leftAxe,  this.leftAnim,  -1)
    this._applyPose(this.rightAxe, this.rightAnim,   1)

    // Planted axe visible during impact/hold/return phases (axe is "in the ice")
    const leftInIce  = this.leftAnim.phase  === 'impact' || this.leftAnim.phase  === 'hold' || this.leftAnim.phase  === 'return'
    const rightInIce = this.rightAnim.phase === 'impact' || this.rightAnim.phase === 'hold' || this.rightAnim.phase === 'return'
    this._updatePlantedMesh(this.leftPlanted,  leftInIce  && leftAnchorPos  !== null ? leftAnchorPos  : null, planetCenter)
    this._updatePlantedMesh(this.rightPlanted, rightInIce && rightAnchorPos !== null ? rightAnchorPos : null, planetCenter)
  }

  private _advanceAnim(anim: AxeAnimState, dt: number): AxeAnimState {
    if (anim.phase === 'rest') return anim
    const timer = anim.timer + dt
    switch (anim.phase) {
      case 'windup':  return timer >= CLIMBING.strikeWindUp  ? { phase: 'impact',  timer: timer - CLIMBING.strikeWindUp  } : { phase: 'windup',  timer }
      case 'impact':  return timer >= CLIMBING.strikeImpact  ? { phase: 'hold',    timer: timer - CLIMBING.strikeImpact  } : { phase: 'impact',  timer }
      case 'hold':    return timer >= CLIMBING.strikeHold    ? { phase: 'return',  timer: timer - CLIMBING.strikeHold    } : { phase: 'hold',    timer }
      case 'return':  return timer >= CLIMBING.strikeReturn  ? { phase: 'rest',    timer: 0                              } : { phase: 'return',  timer }
      default:        return anim
    }
  }

  private _applyPose(axe: Group, anim: AxeAnimState, side: number): void {
    let posY: number, posZ: number, rotX: number

    switch (anim.phase) {
      case 'rest':
        posY = REST_Y;   posZ = REST_Z;   rotX = REST_ROT
        break
      case 'windup': {
        const t = anim.timer / CLIMBING.strikeWindUp
        posY = REST_Y   + (WINDUP_Y   - REST_Y)   * t
        posZ = REST_Z   + (WINDUP_Z   - REST_Z)   * t
        rotX = REST_ROT + (WINDUP_ROT - REST_ROT) * t
        break
      }
      case 'impact': {
        const t = anim.timer / CLIMBING.strikeImpact
        posY = WINDUP_Y   + (IMPACT_Y   - WINDUP_Y)   * t
        posZ = WINDUP_Z   + (IMPACT_Z   - WINDUP_Z)   * t
        rotX = WINDUP_ROT + (IMPACT_ROT - WINDUP_ROT) * t
        break
      }
      case 'hold':
        posY = IMPACT_Y;   posZ = IMPACT_Z;   rotX = IMPACT_ROT
        break
      case 'return': {
        const t = anim.timer / CLIMBING.strikeReturn
        posY = IMPACT_Y   + (REST_Y   - IMPACT_Y)   * t
        posZ = IMPACT_Z   + (REST_Z   - IMPACT_Z)   * t
        rotX = IMPACT_ROT + (REST_ROT - IMPACT_ROT) * t
        break
      }
    }

    axe.position.x = side * 0.22
    axe.position.y = posY
    axe.position.z = posZ
    axe.rotation.x = rotX
  }

  private _updatePlantedMesh(
    planted: Group,
    anchor: [number, number, number] | null,
    planetCenter: Vector3,
  ): void {
    if (!anchor) { planted.visible = false; return }
    planted.visible = true

    this._anchorV.set(anchor[0], anchor[1], anchor[2])

    // Place group above anchor so the pick head sits at ice level.
    this._outward.copy(this._anchorV).sub(planetCenter).normalize()
    planted.position.copy(this._anchorV).addScaledVector(this._outward, 0.30)

    // Orient: local +Y → into planet so the pick drives into the ice and handle sticks up
    this._negOutward.copy(this._outward).negate()
    this._plantQ.setFromUnitVectors(_Y_AXIS, this._negOutward)
    planted.quaternion.copy(this._plantQ)
  }
}
