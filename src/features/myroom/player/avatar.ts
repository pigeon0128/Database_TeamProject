import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import type { Scene } from "@babylonjs/core/scene"
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { material } from "../engine/room"

// Original primitive geometry, proportioned against user-supplied c1/c2 screenshots.
export function createAvatar(scene: Scene, nickname: string) {
  const root = new TransformNode("player", scene)
  // Match reference width while keeping the measured screen-space height.
  root.scaling.set(1.1, 1, 1.1)
  const body = new TransformNode("player-body", scene)
  body.parent = root
  const green = material(scene, "player-mint", "#65d69b")
  green.emissiveColor = green.diffuseColor.scale(0.22)
  const limb = material(scene, "player-limbs", "#2cbc69")
  limb.emissiveColor = limb.diffuseColor.scale(0.18)
  const black = material(scene, "player-eyes", "#103c29")
  const pieces: Mesh[] = []
  function own(mesh: Mesh, mat: StandardMaterial, parent = body) {
    mesh.parent = parent
    mesh.material = mat
    mesh.isPickable = false
    mesh.receiveShadows = true
    pieces.push(mesh)
    return mesh
  }
  function cylinder(
    name: string,
    diameter: number,
    height: number,
    x: number,
    y: number,
    z: number,
    parent = body,
  ) {
    const mesh = own(
      MeshBuilder.CreateCylinder(
        `player-${name}`,
        { diameter, height, tessellation: 24 },
        scene,
      ),
      limb,
      parent,
    )
    mesh.position.set(x, y, z)
    return mesh
  }
  function sphere(
    name: string,
    dimensions: number[],
    position: number[],
    mat: StandardMaterial,
    parent = body,
  ) {
    const mesh = own(
      MeshBuilder.CreateSphere(
        `player-${name}`,
        { diameter: 1, segments: 24 },
        scene,
      ),
      mat,
      parent,
    )
    mesh.scaling.set(dimensions[0], dimensions[1], dimensions[2])
    mesh.position.set(position[0], position[1], position[2])
    return mesh
  }
  // Short oval torso and a cylinder capped by a true hemisphere, without a visor or box joints.
  sphere("torso", [0.4, 0.39, 0.34], [0, 0.395, 0], green)
  cylinder("neck", 0.055, 0.06, 0, 0.595, 0)
  const head = own(
    MeshBuilder.CreateCylinder(
      "player-head",
      { diameter: 0.47, height: 0.31, tessellation: 32 },
      scene,
    ),
    green,
  )
  head.position.y = 0.755
  const dome = own(
    MeshBuilder.CreateSphere(
      "player-dome",
      { diameter: 0.47, slice: 0.5, segments: 32 },
      scene,
    ),
    green,
  )
  dome.position.y = 0.91
  for (const x of [-0.086, 0.086])
    sphere("eye", [0.052, 0.052, 0.026], [x, 0.835, 0.222], black)
  cylinder("antenna", 0.008, 0.31, 0, 1.3, 0)
  sphere("antenna-tip", [0.027, 0.027, 0.027], [0, 1.46, 0], limb)
  const base = own(
    MeshBuilder.CreateCylinder(
      "player-antenna-base",
      { diameterTop: 0, diameterBottom: 0.09, height: 0.08, tessellation: 24 },
      scene,
    ),
    limb,
  )
  base.position.y = 1.145
  const arms: TransformNode[] = [],
    legs: TransformNode[] = []
  for (const sign of [-1, 1]) {
    const arm = new TransformNode(`player-arm-${sign}`, scene)
    arm.parent = body
    arm.position.set(sign * 0.22, 0.51, 0)
    cylinder("upper-arm", 0.018, 0.105, 0, -0.055, 0, arm)
    sphere("elbow", [0.032, 0.032, 0.032], [0, -0.12, 0], limb, arm)
    cylinder("forearm", 0.016, 0.09, 0, -0.175, 0.015, arm)
    sphere("hand", [0.033, 0.046, 0.033], [0, -0.235, 0.02], limb, arm)
    arms.push(arm)
    const leg = new TransformNode(`player-leg-${sign}`, scene)
    leg.parent = root
    leg.position.set(sign * 0.075, 0.18, 0)
    cylinder("leg", 0.019, 0.13, 0, -0.065, 0, leg)
    sphere("foot", [0.064, 0.05, 0.09], [0, -0.155, 0.02], limb, leg)
    legs.push(leg)
  }
  const texture = new DynamicTexture(
    "player-nickname",
    { width: 512, height: 112 },
    scene,
    true,
  )
  const ctx = texture.getContext() as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 512, 112)
  ctx.fillStyle = "rgba(16,13,8,0.72)"
  ctx.beginPath()
  ctx.roundRect(0, 0, 512, 112, 22)
  ctx.fill()
  const text = nickname.trim().slice(0, 18) || "나"
  ctx.fillStyle = "white"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `bold ${text.length > 12 ? 42 : 54}px sans-serif`
  ctx.fillText(text, 256, 58, 470)
  texture.hasAlpha = true
  texture.update()
  const labelMaterial = material(scene, "player-label", "#ffffff")
  labelMaterial.diffuseTexture = texture
  labelMaterial.useAlphaFromDiffuseTexture = true
  labelMaterial.disableLighting = true
  labelMaterial.emissiveColor.set(1, 1, 1)
  const label = MeshBuilder.CreatePlane(
    "player-nickname",
    { width: 1.6, height: 0.35 },
    scene,
  )
  label.parent = root
  label.scaling.x = 1 / 1.1
  label.position.y = 1.91
  label.billboardMode = Mesh.BILLBOARDMODE_ALL
  label.material = labelMaterial
  label.isPickable = false
  root.rotation.y = Math.PI * 0.8
  let phase = 0,
    time = 0
  return {
    root,
    pieces,
    animate(
      dt: number,
      speed: number,
      airborne: boolean,
      verticalSpeed: number,
    ) {
      time += dt
      phase += dt * Math.min(speed * 5, 15)
      const walking = airborne ? 0 : Math.min(speed / 1.5, 1)
      body.position.y = airborne
        ? 0
        : Math.sin(time * 2.8) * 0.006 * (1 - walking) +
          Math.abs(Math.sin(phase)) * 0.012 * walking
      arms.forEach((arm, i) => {
        arm.rotation.x = airborne
          ? verticalSpeed > 0
            ? -0.6
            : 0.25
          : Math.sin(phase + i * Math.PI) * 0.6 * walking
        arm.rotation.z = (i ? -1 : 1) * (airborne ? 0.35 : 0.05)
      })
      legs.forEach((leg, i) => {
        leg.rotation.x = airborne
          ? i
            ? -0.22
            : 0.35
          : -Math.sin(phase + i * Math.PI) * 0.5 * walking
      })
    },
    dispose() {
      root.dispose()
      texture.dispose()
      ;[green, limb, black, labelMaterial].forEach((m) => m.dispose())
    },
  }
}
