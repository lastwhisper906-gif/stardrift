import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
} from 'three'

const STAR_COUNT = 3000
const SPREAD = 800

export function createStarField(): Points {
  const positions = new Float32Array(STAR_COUNT * 3)
  for (let i = 0; i < STAR_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * SPREAD
    positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD
    positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))

  const material = new PointsMaterial({
    color: 0xffffff,
    size: 0.6,
    sizeAttenuation: true,
  })

  return new Points(geometry, material)
}
