import { useEffect, useRef, useState } from "react"
import type { RoomArtwork } from "./artwork"
import type { Placement, RoomLayout, RoomObject } from "./types"
import { createRoomScene } from "./engine/createScene"

export default function MyRoomViewport(props: {
  layout: RoomLayout
  artworks: RoomArtwork[]
  selected: string | null
  placement: Placement | null
  reset: number

  nickname: string

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
      room = createRoomScene(
        canvas.current!,
        {
          select: (id) => latest.current.onSelect(id),

          place: (o) => latest.current.onPlace(o),

          hint: (h) => latest.current.onHint(h),
        },
        latest.current.nickname,
      )
      runtime.current = room
      const p = latest.current
      room.sync(p.layout, p.artworks, p.selected, p.placement)

      room.setInteraction(p.blocked, !!p.placement)
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
    () => runtime.current?.setInteraction(props.blocked, !!props.placement),
    [props.blocked, props.placement],
  )
  return (
    <>
      <canvas
        ref={canvas}
        className="mr-canvas"
        data-testid="myroom-canvas"
        tabIndex={0}
        aria-label="3D 마이룸. WASD 또는 방향키로 이동, Space로 점프, 우클릭 드래그로 회전, 좌클릭으로 선택 및 배치해요."
      />
      {error && (
        <div className="mr-engine-error" role="alert">
          {error}
        </div>
      )}
    </>
  )
}
