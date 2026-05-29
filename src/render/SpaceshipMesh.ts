import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'

export function createSpaceshipMesh(): Group {
  const group = new Group()

  const bodyGeo = new BoxGeometry(1.5, 0.5, 3)
  const bodyMat = new MeshStandardMaterial({ color: 0x4488cc, metalness: 0.6, roughness: 0.4 })
  const body = new Mesh(bodyGeo, bodyMat)
  group.add(body)

  const wingGeo = new BoxGeometry(4, 0.15, 1.2)
  const wingMat = new MeshStandardMaterial({ color: 0x2255aa, metalness: 0.5, roughness: 0.5 })
  const wings = new Mesh(wingGeo, wingMat)
  wings.position.z = 0.3
  group.add(wings)

  const cockpitGeo = new BoxGeometry(0.7, 0.4, 0.8)
  const cockpitMat = new MeshStandardMaterial({ color: 0x88ccff, metalness: 0.2, roughness: 0.2 })
  const cockpit = new Mesh(cockpitGeo, cockpitMat)
  cockpit.position.set(0, 0.35, -0.8)
  group.add(cockpit)

  return group
}
