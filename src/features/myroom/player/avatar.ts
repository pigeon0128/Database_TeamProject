import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import type { Scene } from "@babylonjs/core/scene"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { material } from "../engine/room"

// Independent low-poly robot. All geometry/materials are authored here.
export function createAvatar(scene: Scene) {
  const root = new TransformNode("player", scene)
  const body = new TransformNode("player-body", scene)
  body.parent = root
  const green = material(scene, "player-green", "#73ab54")
  const light = material(scene, "player-shell", "#c5d7a6")
  const dark = material(scene, "player-joints", "#334038")
  const visor = material(scene, "player-visor", "#1c3433")
  const glow = material(scene, "player-eyes", "#b7f1ce")
  glow.emissiveColor = glow.diffuseColor.scale(0.6)
  const pieces: Mesh[] = []
  function box(
    name: string,
    size: number[],
    position: number[],
    mat: StandardMaterial,
    parent = body,
  ) {
    const mesh = MeshBuilder.CreateBox(
      `player-${name}`,
      { width: size[0], height: size[1], depth: size[2] },
      scene,
    )
    mesh.parent = parent
    mesh.position.set(position[0], position[1], position[2])
    mesh.material = mat
    mesh.isPickable = false
    mesh.receiveShadows = true
    pieces.push(mesh)
    return mesh
  }
  box("torso", [0.52, 0.57, 0.36], [0, 1.02, 0], green)
  box("chest", [0.3, 0.26, 0.025], [0, 1.05, 0.195], light)
  box("neck", [0.15, 0.15, 0.15], [0, 1.35, 0], dark)
  box("head", [0.62, 0.47, 0.46], [0, 1.61, 0], green)
  box("visor", [0.5, 0.25, 0.025], [0, 1.61, 0.244], visor)
  for (const x of [-0.14, 0.14])
    box("eye", [0.09, 0.055, 0.02], [x, 1.64, 0.265], glow)
  box("antenna", [0.045, 0.14, 0.045], [0, 1.91, 0], dark)
  box("antenna-tip", [0.11, 0.08, 0.11], [0, 2.01, 0], light)
  const arms: TransformNode[] = [],
    legs: TransformNode[] = []
  for (const sign of [-1, 1]) {
    const arm = new TransformNode(`player-arm-${sign}`, scene)
    arm.parent = body
    arm.position.set(sign * 0.37, 1.24, 0)
    box("arm", [0.16, 0.41, 0.19], [0, -0.21, 0], green, arm)
    box("hand", [0.18, 0.16, 0.2], [0, -0.48, 0], light, arm)
    arms.push(arm)
    const leg = new TransformNode(`player-leg-${sign}`, scene)
    leg.parent = root
    leg.position.set(sign * 0.16, 0.68, 0)
    box("leg", [0.18, 0.44, 0.21], [0, -0.22, 0], dark, leg)
    box("boot", [0.25, 0.2, 0.36], [0, -0.57, 0.055], light, leg)
    legs.push(leg)
  }
  root.rotation.y = Math.PI
  let phase = 0,
    time = 0
  return {
    root,
    pieces,
    animate(dt: number, speed: number) {
      time += dt
      phase += dt * Math.min(speed * 4.4, 14)
      const walking = Math.min(speed / 1.5, 1)
      body.position.y =
        Math.sin(time * 2.4) * 0.009 * (1 - walking) +
        Math.abs(Math.sin(phase)) * 0.025 * walking
      arms.forEach((arm, i) => {
        arm.rotation.x =
          Math.sin(phase + i * Math.PI) * 0.5 * walking +
          Math.sin(time * 2.4) * 0.025 * (1 - walking)
      })
      legs.forEach((leg, i) => {
        leg.rotation.x = -Math.sin(phase + i * Math.PI) * 0.42 * walking
      })
    },
    dispose() {
      root.dispose()
      ;[green, light, dark, visor, glow].forEach((m) => m.dispose())
    },
  }
}
