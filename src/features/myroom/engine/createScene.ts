import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator"
import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core/scene"
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents"
import "@babylonjs/core/Rendering/outlineRenderer"
import "@babylonjs/core/Culling/ray"
import {
  CATALOG,
  ROOM,
  placementError,
  TABLE_TOP,
  wallRotation,
  type Wall,
} from "../../../../shared/myroom.js"
import type { RoomArtwork } from "../artwork"
import type { ColoredSpec, Placement, RoomLayout, RoomObject } from "../types"
import { createObject } from "../objects/createObject"
import { createRoom } from "./room"

import { createPlayerController } from "../player/controller"

export function createRoomScene(
  canvas: HTMLCanvasElement,
  callbacks: {
    select: (id: string | null) => void
    place: (object: RoomObject) => void
    hint: (value: string | null) => void
  },

  nickname = "나",
) {
  const engine = new Engine(
    canvas,
    true,
    { preserveDrawingBuffer: true, stencil: true },
    true,
  )
  try {
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.17, 0.12, 0.075, 1)
    const camera = new ArcRotateCamera(
      "myroom-camera",
      -Math.PI / 2,
      Math.PI / 3,
      13,
      new Vector3(0, 0, 0),
      scene,
    )
    camera.attachControl(canvas, true)
    camera.lowerBetaLimit = 0.25
    camera.upperBetaLimit = Math.PI / 2.15
    camera.lowerRadiusLimit = 5
    camera.upperRadiusLimit = 18
    camera.wheelDeltaPercentage = 0.015
    camera.panningSensibility = 0
    camera.keysUp = []
    camera.keysDown = []
    camera.keysLeft = []
    camera.keysRight = []
    camera.minZ = 0.08
    const ambient = new HemisphericLight(
      "soft-room-light",
      new Vector3(0, 1, 0),
      scene,
    )
    ambient.intensity = 0.7
    ambient.groundColor = new Color3(0.35, 0.27, 0.2)
    const sun = new DirectionalLight(
      "room-sun",
      new Vector3(-0.5, -1, 0.4),
      scene,
    )
    sun.position.set(4, 12, -6)
    sun.intensity = 0.3
    const shadows = new ShadowGenerator(1024, sun)
    shadows.useBlurExponentialShadowMap = true
    shadows.blurKernel = 24
    shadows.setDarkness(0.3)
    const room = createRoom(scene)

    const player = createPlayerController(scene, camera, canvas, nickname)

    let layout: RoomLayout = { objects: [] },
      specs: Record<number, ColoredSpec> = {},
      artworks: RoomArtwork[] = [],
      selected: string | null = null
    let placing: Placement | null = null,
      candidate: RoomObject | null = null
    const objects = new Map<string, ReturnType<typeof createObject>>()
    let preview: ReturnType<typeof createObject> | null = null
    let down = { x: 0, y: 0 }
    const onContext = (event: Event) => event.preventDefault()
    canvas.addEventListener("contextmenu", onContext)
    function updateCandidate(x: number, y: number) {
      if (!placing || !preview) return
      const hit = scene.pick(x, y, (mesh) =>
        placing!.type === "frame"
          ? mesh.metadata?.surface === "wall"
          : mesh.metadata?.surface === "floor" ||
            (placing!.type === "colored" &&
              mesh.metadata?.surface === "tabletop"),
      )
      if (!hit?.hit || !hit.pickedPoint) {
        candidate = null
        preview.root.setEnabled(false)
        callbacks.hint(
          placing.type === "frame"
            ? "액자를 걸 벽을 가리켜 주세요."
            : placing.type === "colored"
              ? "바닥이나 테이블 위를 가리켜 주세요."
              : "방 안쪽 바닥을 가리켜 주세요.",
        )
        return
      }
      const p = hit.pickedPoint,
        wall = hit.pickedMesh?.metadata?.wall as Wall
      const snap = (v: number) => Math.round(v * 10) / 10
      const position =
        placing.type === "frame"
          ? {
              x:
                wall === "left"
                  ? -ROOM.halfWidth + 0.12
                  : wall === "right"
                    ? ROOM.halfWidth - 0.12
                    : snap(p.x),
              y: snap(p.y),
              z:
                wall === "back"
                  ? ROOM.halfDepth - 0.12
                  : wall === "front"
                    ? -ROOM.halfDepth + 0.12
                    : snap(p.z),
            }
          : {
              x: snap(p.x),
              y: hit.pickedMesh?.metadata?.surface === "tabletop" ? TABLE_TOP : 0,
              z: snap(p.z),
            }
      const storedObjectId =
        placing.original?.storedObjectId ?? placing.storedObjectId
      const object: RoomObject = {
        id: placing.original?.id ?? "preview",
        type: placing.type,
        position,
        rotation:
          placing.type === "frame" ? wallRotation(wall) : placing.rotation,
        scale:
          placing.type === "colored"
            ? (placing.scale ?? placing.original?.scale ?? 1)
            : 1,
        ...(placing.type === "frame" ? { wall } : {}),
        ...(placing.original?.artworkDrawingId
          ? { artworkDrawingId: placing.original.artworkDrawingId }
          : {}),
        ...(storedObjectId ? { storedObjectId } : {}),
      }
      const error = placementError(object, layout.objects)
      preview.root.setEnabled(true)
      preview.root.position.set(position.x, position.y, position.z)
      preview.root.rotation.y = object.rotation
      preview.tint(!error)
      candidate = error ? null : object
      callbacks.hint(
        error ??
          (placing.type === "frame"
            ? "클릭하면 이 벽에 액자를 설치해요."
            : placing.type === "colored"
              ? "클릭하면 여기에 놓아요."
              : "클릭하면 가구를 설치해요."),
      )
    }
    const pointer = scene.onPointerObservable.add((info) => {
      const e = info.event as PointerEvent
      if (info.type === PointerEventTypes.POINTERDOWN)
        down = { x: e.clientX, y: e.clientY }
      if (info.type === PointerEventTypes.POINTERMOVE && placing)
        updateCandidate(scene.pointerX, scene.pointerY)
      if (
        info.type === PointerEventTypes.POINTERUP &&
        e.button === 0 &&
        Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5
      ) {
        if (placing) {
          updateCandidate(scene.pointerX, scene.pointerY)
          if (candidate)
            callbacks.place({
              ...candidate,
              id: placing.original?.id ?? crypto.randomUUID(),
            })
        } else
          callbacks.select(
            info.pickInfo?.pickedMesh?.metadata?.objectId ?? null,
          )
      }
    })
    scene.onBeforeRenderObservable.add(() => {
      player.update(engine.getDeltaTime() / 1000)

      for (const wall of room.walls) {
        const name = wall.metadata.wall as Wall
        const outside =
          name === "front"
            ? camera.position.z < -ROOM.halfDepth
            : name === "back"
              ? camera.position.z > ROOM.halfDepth
              : name === "left"
                ? camera.position.x < -ROOM.halfWidth
                : camera.position.x > ROOM.halfWidth
        wall.setEnabled(!outside)
      }
    })
    const resize = new ResizeObserver(() => engine.resize())
    resize.observe(canvas)
    engine.runRenderLoop(() => scene.render())
    function rebuild() {
      objects.forEach((o) => o.root.dispose())
      objects.clear()
      for (const o of layout.objects) {
        const instance = createObject(
          scene,
          o,
          artworks.find((a) => a.drawingId === o.artworkDrawingId),
          false,
          o.storedObjectId ? specs[o.storedObjectId] : undefined,
        )
        objects.set(o.id, instance)
        if (placing?.original?.id === o.id) instance.root.setEnabled(false)
        instance.pieces.forEach((m) => {
          m.renderOutline = selected === o.id
          m.outlineColor = Color3.FromHexString("#39a3ff")
          m.outlineWidth = 0.025
        })
      }
      if (shadows.getShadowMap())
        shadows.getShadowMap()!.renderList = [...objects.values()]
          .flatMap((o) => o.pieces)
          .concat(player.pieces)
    }
    return {
      sync(
        next: RoomLayout,
        nextArtworks: RoomArtwork[],
        nextSelected: string | null,
        nextPlacement: Placement | null,
        nextSpecs: Record<number, ColoredSpec> = {},
      ) {
        layout = next
        const specsChanged = specs !== nextSpecs
        specs = nextSpecs

        player.syncObjects(layout.objects)

        artworks = nextArtworks
        selected = nextSelected
        const changed = placing !== nextPlacement || (specsChanged && !!placing)
        placing = nextPlacement
        rebuild()
        if (changed) {
          preview?.root.dispose()
          preview = null
          candidate = null
          if (placing) {
            const o: RoomObject = {
              id: "preview",
              type: placing.type,
              position: { x: 0, y: 0, z: 0 },
              rotation: placing.rotation,
              scale:
                placing.type === "colored"
                  ? (placing.scale ?? placing.original?.scale ?? 1)
                  : 1,
              ...(placing.type === "colored"
                ? {
                    storedObjectId:
                      placing.original?.storedObjectId ?? placing.storedObjectId,
                  }
                : {}),
            }
            preview = createObject(
              scene,
              o,
              undefined,
              true,
              o.storedObjectId ? specs[o.storedObjectId] : undefined,
            )
            preview.root.setEnabled(false)
            callbacks.hint(
              placing.type === "frame"
                ? "액자를 걸 벽을 가리켜 주세요."
                : placing.type === "colored"
                  ? "놓을 바닥이나 테이블 위를 가리켜 주세요."
                  : "가구를 놓을 바닥을 가리켜 주세요.",
            )
          } else {
            callbacks.hint(null)
          }
        }
        if (placing) updateCandidate(scene.pointerX, scene.pointerY)
      },
      resetCamera() {
        player.resetCamera()
      },

      setInteraction(blocked: boolean, placing: boolean) {
        player.setInteraction(blocked, placing)
      },
      dispose() {
        resize.disconnect()
        canvas.removeEventListener("contextmenu", onContext)
        scene.onPointerObservable.remove(pointer)

        player.dispose()

        engine.stopRenderLoop()
        scene.dispose()
        engine.dispose()
      },
    }
  } catch (error) {
    engine.dispose()
    throw error
  }
}
