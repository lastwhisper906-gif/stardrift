import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
} from 'three'

const STAR_COUNT = 1400  // single draw call — no PBR cost
const SPREAD     = 1400

export function createStarField(): Group {
  const g = new Group()

  // ── All stars in ONE Points object (1 draw call, no lighting shader) ─────
  const pos = new Float32Array(STAR_COUNT * 3)
  for (let i = 0; i < STAR_COUNT; i++) {
    const phi   = Math.acos(2 * Math.random() - 1)
    const theta = Math.random() * Math.PI * 2
    const r     = SPREAD * (0.8 + 0.2 * Math.random())
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    pos[i * 3 + 2] = r * Math.cos(phi)
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  // PointsMaterial + sizeAttenuation:false = simplest possible point shader
  g.add(new Points(geo, new PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false })))

  // ── Distant sun (MeshBasicMaterial — no lighting calc at all) ────────────
  const sun = new Mesh(
    new SphereGeometry(20, 8, 6),
    new MeshBasicMaterial({ color: 0xffee88 }),
  )
  sun.position.set(600, 200, -800)
  g.add(sun)

  // ── Gas giant (MeshBasicMaterial, very low poly) ──────────────────────────
  const giant = new Mesh(
    new SphereGeometry(60, 10, 7),
    new MeshBasicMaterial({ color: 0x334488 }),
  )
  giant.position.set(-900, -120, -1000)
  g.add(giant)

  // Ring (16 segments, MeshBasicMaterial) ──────────────────────────────────
  const innerR = 88, outerR = 150, segs = 16
  const rVerts: number[] = [], rInds: number[] = []
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2
    rVerts.push(Math.cos(a) * innerR, 0, Math.sin(a) * innerR)
    rVerts.push(Math.cos(a) * outerR, 0, Math.sin(a) * outerR)
  }
  for (let i = 0; i < segs; i++) {
    const b = i * 2
    rInds.push(b, b + 1, b + 2, b + 2, b + 1, b + 3)
  }
  const ringGeo = new BufferGeometry()
  ringGeo.setAttribute('position', new Float32BufferAttribute(rVerts, 3))
  ringGeo.setIndex(rInds)
  const ring = new Mesh(ringGeo, new MeshBasicMaterial({ color: 0x445577, side: 2 }))
  ring.position.copy(giant.position)
  ring.rotation.x = 0.35
  g.add(ring)

  return g
}
