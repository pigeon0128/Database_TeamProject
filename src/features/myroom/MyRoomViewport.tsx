import { useEffect, useRef, useState } from "react"
import type { RoomArtwork } from "./artwork"
import type { Placement, RoomLayout, RoomMode, RoomObject } from "./types"
import { createRoomScene } from "./engine/createScene"

export default function MyRoomViewport(props: {
  layout: RoomLayout
  artworks: RoomArtwork[]
  selected: string | null
  placement: Placement | null
  reset: number
  mode: RoomMode
  blocked: boolean
  onSelect: (id: string | null) => void
  onPlace: (object: RoomObject) => void
  onHint: (hint: string | null) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    runtime = useRef<ReturnType<typeof createRoomScene> | null>(null)
  const latest = useRef(props)
  latest.current = props
  const [error, setError] = useState("")
  useEffect(() => {
    let room: ReturnType<typeof createRoomScene> | undefined
    try {
      room = createRoomScene(canvas.current!, {
        select: (id) => latest.current.onSelect(id),
        place: (o) => latest.current.onPlace(o),
        hint: (h) => latest.current.onHint(h),
      })
      runtime.current = room
      const p = latest.current
      room.sync(p.layout, p.artworks, p.selected, p.placement)
      room.setInteraction(p.mode, p.blocked)
    } catch {
      setError(
        "3D 화면을 시작하지 못했어요. WebGL을 지원하는 브라우저에서 다시 열어 주세요.",
      )
    }
    return () => {
      room?.dispose()
      runtime.current = null
    }
  }, [])
  useEffect(() => {
    runtime.current?.sync(
      props.layout,
      props.artworks,
      props.selected,
      props.placement,
    )
  }, [props.layout, props.artworks, props.selected, props.placement])
  useEffect(() => runtime.current?.resetCamera(), [props.reset])
  useEffect(
    () => runtime.current?.setInteraction(props.mode, props.blocked),
    [props.mode, props.blocked],
  )
  return (
    <>
      <canvas
        ref={canvas}
        className="mr-canvas"
        data-testid="myroom-canvas"
        tabIndex={0}
        aria-label={
          props.mode === "explore"
            ? "3D 마이룸 탐색. WASD 또는 방향키로 이동하고 우클릭 드래그로 시점을 회전해요."
            : "3D 마이룸 꾸미기. 드래그로 회전하고 클릭으로 가구를 배치해요."
        }
      />
      {error && (
        <div className="mr-engine-error" role="alert">
          {error}
        </div>
      )}
    </>
  )
}
