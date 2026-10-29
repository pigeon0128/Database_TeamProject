import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import type { ArcRotateCameraPointersInput } from "@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput"

export function configureRoomPointerInput(camera: ArcRotateCamera) {
  const pointers = camera.inputs.attached
    .pointers as ArcRotateCameraPointersInput
  pointers.buttons = [2]
  // Babylon 9.31 has two layers: allowed buttons AND movement input mapping.
  // Moving legacy pan off right-click alone leaves button 2 with no rotate entry.
  camera.movement.input.inputMap = camera.movement.input.inputMap.filter(
    (entry) => entry.source !== "pointer",
  )
  camera.movement.input.addEntry({
    source: "pointer",
    button: 2,
    interaction: "rotate",
  })
}
