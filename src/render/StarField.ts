import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
} from 'three'

const STAR_COUNT  = 4500
const SPREAD      = 900

export function createStarField(): Group {
  const g = new Group()

  // ── Multi-layer star field (white, blue-white, warm) ────────────────────
  for (const [count, color, size] of [
    [STAR_COUNT, 0xffffff, 0.55],
    [800,        0xaabbff, 0.80],  // blue-white bright stars
    [400,        0xffddaa, 0.75],  // orange/warm stars
  ] as [number, number, number][]) {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Distribute on sphere shell to avoid near-field stars
      const phi   = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      const r     = SPREAD * (0.7 + 0.3 * Math.random())
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.add(new Points(geo, new PointsMaterial({ color, size, sizeAttenuation: true })))
  }

  // ── Distant nebula (large translucent sphere far away) ──────────────────
  const nebulaMat = new MeshStandardMaterial({
    color: 0x0a0a1e, emissive: 0x080820, emissiveIntensity: 1.0,
    transparent: true, opacity: 0.18, side: 1, /* BackSide = 1 */
    depthWrite: false,
  })
  const nebula = new Mesh(new SphereGeometry(820, 16, 12), nebulaMat)
  g.add(nebula)

  // ── Distant sun / star ───────────────────────────────────────────────────
  const sunMat = new MeshStandardMaterial({
    color: 0xfff4d0, emissive: 0xffdd88, emissiveIntensity: 1.0,
  })
  const sun = new Mesh(new SphereGeometry(18, 16, 12), sunMat)
  sun.position.set(500, 180, -650)
  g.add(sun)

  // ── Distant gas giant ───────────────────────────────────────────────────
  const giantMat = new MeshStandardMaterial({
    color: 0x3355aa, emissive: 0x1a2255, emissiveIntensity: 0.3,
  })
  const giant = new Mesh(new SphereGeometry(60, 24, 18), giantMat)
  giant.position.set(-700, -100, -800)
  g.add(giant)

  // Giant's ring
  const ringMat = new MeshStandardMaterial({
    color: 0x556688, emissive: 0x223355, emissiveIntensity: 0.2,
    transparent: true, opacity: 0.55, side: 2, /* DoubleSide = 2 */
  })
  const ring = new Mesh(new BufferGeometry(), ringMat)
  // Build flat ring geometry (annulus)
  const innerR = 80, outerR = 140, segs = 48
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
  ring.geometry.setAttribute('position', new Float32BufferAttribute(rVerts, 3))
  ring.geometry.setIndex(rInds)
  ring.geometry.computeVertexNormals()
  ring.position.copy(giant.position)
  ring.rotation.x = 0.35
  g.add(ring)

  return g
}
