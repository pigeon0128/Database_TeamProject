import { useEffect, useState } from "react"
import {
  CATALOG,
  MAX_COLORED_SCALE,
  MAX_OBJECTS,
  MIN_COLORED_SCALE,
  onTable,
  placementError,
  supportsArtwork,
} from "../../../shared/myroom.js"
import { navigate } from "../../router"
import { useAuth } from "../../auth"
import MyRoomViewport from "./MyRoomViewport"
import { useMyRoom } from "./hooks/useMyRoom"
import { useStoredSpecs } from "./hooks/useStoredSpecs"
import { myRoomPreviewEnabled } from "./preview/enabled"
import type { ObjectType, Placement, RoomObject } from "./types"
import InventoryPanel from "./ui/InventoryPanel"
import ArtworkPicker from "./ui/ArtworkPicker"
import { Icon, Modal, ObjectThumbnail } from "./ui/RoomUI"
import "./myroom.css"

export default function MyRoomPage() {
  const { user, expire } = useAuth()

  return <RoomPage onUnauthorized={expire} nickname={user?.loginId ?? "나"} />
}

export function PreviewMyRoomPage() {
  return <RoomPage preview nickname="Preview" />
}

/** 색칠 오브젝트 크기 조절 막대 (기본 크기의 0.5~2.5배) */
function SizeSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="mr-size">
      <span>크기</span>
      <input
        type="range"
        min={MIN_COLORED_SCALE}
        max={MAX_COLORED_SCALE}
        step={0.1}
        value={value}
        aria-label="오브젝트 크기"
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 10) / 10)}
      />
      <output>{value.toFixed(1)}배</output>
    </label>
  )
}

function RoomPage({
  preview = false,
  onUnauthorized,

  nickname,
}: {
  preview?: boolean
  onUnauthorized?: () => void

  nickname: string
}) {
  const isPreview = import.meta.env.DEV && preview && myRoomPreviewEnabled
  const room = useMyRoom(isPreview, onUnauthorized)
  const [panel, setPanel] = useState<"inventory" | "artwork" | "help" | null>(
    null,
  )
  const [selectedId, setSelected] = useState<string | null>(null),
    [placement, setPlacement] = useState<Placement | null>(null)
  const [hint, setHint] = useState<string | null>(null),
    [reset, setReset] = useState(0),
    [exit, setExit] = useState(false)
  const specs = useStoredSpecs(room.layout, placement, !isPreview)
  const storedName = (o: RoomObject) =>
    room.stored.find((s) => s.id === o.storedObjectId)?.name
  const [resizeError, setResizeError] = useState<string | null>(null)
  const selected = room.layout.objects.find((o) => o.id === selectedId)
  useEffect(() => setResizeError(null), [selectedId])
  function resize(object: RoomObject, scale: number) {
    const next = { ...object, scale }
    const error = placementError(next, room.layout.objects)
    setResizeError(error)
    if (error) return
    room.setLayout((l) => ({
      objects: l.objects.map((o) => (o.id === object.id ? next : o)),
    }))
  }
  const busy = room.loading || room.saving || !room.ready
  function select(id: string | null) {
    if (busy) return
    setSelected(id)
    if (supportsArtwork(room.layout.objects.find((o) => o.id === id)?.type))
      setPanel("artwork")
  }
  function place(object: RoomObject) {
    if (busy) return
    room.setLayout((current) => {
      const before = current.objects.find((o) => o.id === object.id)
      let rest = current.objects.filter((o) => o.id !== object.id)
      // 테이블을 옮기면 그 위의 색칠 오브젝트도 함께 옮겨요.
      if (before?.type === "table") {
        const turn = object.rotation - before.rotation,
          cos = Math.round(Math.cos(turn)),
          sin = Math.round(Math.sin(turn))
        rest = rest.map((o) => {
          if (o.type !== "colored" || !onTable(o, before)) return o
          const dx = o.position.x - before.position.x,
            dz = o.position.z - before.position.z
          return {
            ...o,
            position: {
              x: object.position.x + dx * cos + dz * sin,
              y: o.position.y,
              z: object.position.z - dx * sin + dz * cos,
            },
            rotation:
              (((o.rotation + turn) % (Math.PI * 2)) + Math.PI * 2) %
              (Math.PI * 2),
          }
        })
      }
      return { objects: [...rest, object] }
    })
    setPlacement(null)
    setSelected(object.id)
    if (supportsArtwork(object.type) && !object.artworkDrawingId)
      setPanel("artwork")
  }
  function start(
    type: ObjectType,
    original?: RoomObject,
    storedObjectId?: number,
  ) {
    if (busy || (!original && room.layout.objects.length >= MAX_OBJECTS)) return
    setPanel(null)
    setPlacement({
      type,
      original,
      rotation: original?.rotation ?? 0,
      storedObjectId,
      scale: original?.scale,
    })
  }
  const goBack = () => (room.dirty ? setExit(true) : navigate("/"))
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches("input, textarea, select") ||
          e.target.isContentEditable)
      )
        return
      if (e.key === "Escape") {
        setPlacement(null)
        setPanel(null)
      }
      if (panel || exit || busy) return
      if (e.key.toLowerCase() === "i" && !placement) setPanel("inventory")
      if (e.key.toLowerCase() === "r" && placement?.type !== "frame")
        setPlacement((p) =>
          p
            ? { ...p, rotation: (p.rotation + Math.PI / 2) % (Math.PI * 2) }
            : null,
        )
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [panel, placement, exit, busy])
  function downloadBackup() {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ schemaVersion: 1, layout: room.layout }, null, 2)],
        { type: "application/json" },
      ),
    )
    const a = document.createElement("a")
    a.href = url
    a.download = "myroom-unsaved-layout.json"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <main className="mr-page" aria-label="마이룸">
      <MyRoomViewport
        layout={room.layout}
        artworks={room.artworks}
        selected={selectedId}
        placement={placement}
        specs={specs}
        reset={reset}
        nickname={nickname}
        blocked={busy || !!panel || exit || room.conflict}
        onSelect={select}
        onPlace={place}
        onHint={setHint}
      />
      <nav className="mr-sidebar" aria-label="마이룸 메뉴">
        <div className="mr-mark" aria-hidden="true">
          D
        </div>
        {!isPreview && (
          <button
            aria-label="메인으로 돌아가기"
            title="메인으로 돌아가기"
            onClick={goBack}
          >
            <Icon name="home" />
          </button>
        )}
        <button
          className={panel === "inventory" ? "active" : ""}
          aria-label="인벤토리 열기"
          title="인벤토리 (I)"
          disabled={busy}
          onClick={() => {
            setPlacement(null)
            setPanel(panel === "inventory" ? null : "inventory")
          }}
        >
          <Icon name="inventory" />
        </button>
        <span className="mr-sidebar-spacer" />
        <button
          aria-label="조작 안내"
          title="조작 안내"
          onClick={() => setPanel(panel === "help" ? null : "help")}
        >
          <Icon name="help" />
        </button>
        <button
          aria-label="카메라 초기화"
          title="카메라 초기화"
          onClick={() => setReset((n) => n + 1)}
        >
          <Icon name="reset" />
        </button>
        {!isPreview && (
          <button
            className="mr-exit"
            aria-label="마이룸 나가기"
            title="마이룸 나가기"
            onClick={goBack}
          >
            <Icon name="home" />
          </button>
        )}
      </nav>
      <header className="mr-topbar">
        <div>
          <h1>{isPreview ? "마이룸 Preview" : "마이룸"}</h1>
          <span>
            {isPreview
              ? "샘플 작품 · 이 브라우저에만 저장 · DB 미사용"
              : "나만의 작품을 전시하는 공간"}
          </span>
        </div>
        <div className="mr-save-group">
          <span role="status" className={room.dirty ? "mr-unsaved" : ""}>
            {room.saving
              ? "저장 중…"
              : room.dirty
                ? "미저장 변경 사항"
                : room.saved
                  ? isPreview
                    ? "로컬 저장 완료"
                    : "저장 완료"
                  : isPreview
                    ? "Preview 로컬 저장"
                    : "저장된 방"}
          </span>
          <button
            className="mr-primary"
            disabled={busy || !room.dirty || room.conflict || !!placement}
            onClick={() => void room.save()}
          >
            <Icon name="save" />
            저장
          </button>
        </div>
      </header>
      {room.loading && (
        <div className="mr-loading" role="status">
          <div className="mr-spinner" />
          마이룸을 준비하고 있어요…
        </div>
      )}
      {room.error && (
        <div className="mr-error" role="alert">
          <p>{room.error}</p>
          {!room.dirty && !room.loading && (
            <button onClick={() => void room.load()}>다시 불러오기</button>
          )}
        </div>
      )}
      {room.conflict && (
        <section className="mr-conflict" aria-label="저장 충돌">
          <h2>다른 화면에서 방이 변경됐어요</h2>
          <p>
            내 미저장 배치는 유지됩니다. 저장된 방을 확인한 뒤 선택해 주세요.
          </p>
          <button className="mr-secondary" onClick={downloadBackup}>
            내 배치 파일로 보관
          </button>
          {!room.remote ? (
            <button
              className="mr-primary"
              onClick={() => void room.inspectConflict()}
            >
              저장된 방 확인
            </button>
          ) : (
            <>
              <p>
                저장된 방: 오브젝트 {room.remote.layout.objects.length}개 · 버전{" "}
                {room.remote.revision}
              </p>
              <button
                className="mr-primary"
                onClick={() => {
                  setPlacement(null)
                  setSelected(null)
                  room.acceptRemote()
                }}
              >
                저장된 방 불러오기
              </button>
              <small>내 배치는 복원 버튼으로 다시 가져올 수 있어요.</small>
            </>
          )}
        </section>
      )}
      {room.backup && (
        <button className="mr-restore" onClick={room.restoreBackup}>
          이전 미저장 배치 복원
        </button>
      )}
      {selected && !placement && !panel && (
        <aside className="mr-selection" aria-label="선택한 오브젝트">
          <div className="mr-selection-heading">
            <h2>{storedName(selected) ?? CATALOG[selected.type].name}</h2>
            <button
              className="mr-icon-button"
              aria-label="선택 해제"
              onClick={() => setSelected(null)}
            >
              <Icon name="close" />
            </button>
          </div>
          {selected.type === "colored" && (
            <>
              <SizeSlider
                value={selected.scale ?? 1}
                onChange={(v) => resize(selected, v)}
              />
              {resizeError && <p className="mr-size-error">{resizeError}</p>}
            </>
          )}
          {supportsArtwork(selected.type) && (
            <button disabled={busy} onClick={() => setPanel("artwork")}>
              <Icon name="frame" />
              그림 선택 / 교체
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => start(selected.type, selected)}
          >
            <Icon name="move" />
            위치 변경
          </button>
          {selected.type !== "frame" && (
            <button
              disabled={busy}
              onClick={() => start(selected.type, selected)}
            >
              회전하며 재배치
            </button>
          )}
          <button
            className="mr-danger"
            disabled={busy}
            onClick={() => {
              room.setLayout((l) => ({
                objects: l.objects.filter(
                  (o) =>
                    o.id !== selected.id &&
                    !(
                      selected.type === "table" &&
                      o.type === "colored" &&
                      onTable(o, selected)
                    ),
                ),
              }))
              setSelected(null)
            }}
          >
            <Icon name="trash" />
            방에서 제거
          </button>
        </aside>
      )}
      {placement ? (
        <div className="mr-placement" role="status">
          <div className="mr-placement-heading">
            {placement.type === "colored" ? (
              <img
                className="mr-thumbnail"
                alt=""
                src={
                  room.stored.find(
                    (s) =>
                      s.id ===
                      (placement.storedObjectId ??
                        placement.original?.storedObjectId),
                  )?.thumbnail
                }
              />
            ) : (
              <ObjectThumbnail type={placement.type} />
            )}
            <div>
              <small>
                배치 모드 <i />
              </small>
              <strong>
                {(placement.original && storedName(placement.original)) ??
                  room.stored.find((s) => s.id === placement.storedObjectId)
                    ?.name ??
                  CATALOG[placement.type].name}{" "}
                설치
              </strong>
            </div>
          </div>
          <p>{hint}</p>
          {placement.type === "colored" && (
            <SizeSlider
              value={placement.scale ?? placement.original?.scale ?? 1}
              onChange={(v) => setPlacement((p) => p && { ...p, scale: v })}
            />
          )}
          <div className="mr-placement-keys">
            <span>
              <kbd>클릭</kbd> 설치
            </span>
            {placement.type !== "frame" && (
              <button
                aria-label="가구 90도 회전"
                onClick={() =>
                  setPlacement(
                    (p) =>
                      p && {
                        ...p,
                        rotation: (p.rotation + Math.PI / 2) % (2 * Math.PI),
                      },
                  )
                }
              >
                <kbd>R</kbd> 회전
              </button>
            )}
            <button onClick={() => setPlacement(null)}>
              <kbd>ESC</kbd> 취소
            </button>
          </div>
        </div>
      ) : (
        <div className="mr-bottom-tip">
          <Icon name="move" />
          <span>
            <kbd>WASD / 방향키</kbd> 이동 · <kbd>Space</kbd> 점프 · 우클릭 회전
            · <kbd>I</kbd> 인벤토리
          </span>
        </div>
      )}
      {panel === "inventory" && (
        <InventoryPanel
          onClose={() => setPanel(null)}
          onPlace={(type) => start(type)}
          stored={room.stored}
          onPlaceStored={(id) => start("colored", undefined, id)}
          onDeleteStored={room.removeStored}
        />
      )}
      {panel === "artwork" && selected && supportsArtwork(selected.type) && (
        <ArtworkPicker
          preview={isPreview}
          artworks={room.artworks}
          current={selected.artworkDrawingId}
          onClose={() => setPanel(null)}
          onChoose={(id) => {
            room.setLayout((l) => ({
              objects: l.objects.map((o) =>
                o.id === selected.id ? { ...o, artworkDrawingId: id } : o,
              ),
            }))
            setPanel(null)
          }}
        />
      )}
      {panel === "help" && (
        <aside className="mr-help">
          <header>
            <h2>조작 안내</h2>
            <button
              className="mr-icon-button"
              aria-label="조작 안내 닫기"
              onClick={() => setPanel(null)}
            >
              <Icon name="close" />
            </button>
          </header>
          <h3>주요 조작</h3>
          <p>
            <kbd>WASD / 방향키</kbd> 이동
          </p>
          <p>
            <kbd>Space</kbd> 점프
          </p>
          <p>
            <kbd>우클릭 드래그</kbd> 카메라 회전
          </p>
          <p>
            <kbd>휠</kbd> 확대 / 축소
          </p>
          <p>
            <kbd>I</kbd> 인벤토리
          </p>
          <p>
            <kbd>클릭</kbd> 오브젝트 선택
          </p>
          <hr />
          <h3>배치 모드</h3>
          <p>
            <kbd>클릭</kbd> 설치
          </p>
          <p>
            <kbd>R</kbd> 가구 90° 회전
          </p>
          <p>
            <kbd>ESC</kbd> 취소
          </p>
          <p className="mr-muted">
            3D 화면을 클릭한 뒤 이동해요. UI와 배치 중 이동·점프는 잠시 멈추며,
            배치 중에도 우클릭과 휠로 카메라를 조절할 수 있어요. 액자는 벽
            방향에 맞춰 회전해요. 변경을 마치면 오른쪽 위 저장을 눌러 주세요.
          </p>
        </aside>
      )}
      {exit && (
        <Modal
          title="저장하지 않은 변경 사항"
          onClose={() => setExit(false)}
          className="mr-confirm"
        >
          <p>
            아직 저장하지 않은 배치가 있어요. 저장하거나 파일로 보관한 뒤 나갈
            수 있어요.
          </p>
          <button className="mr-secondary" onClick={downloadBackup}>
            배치 파일로 보관
          </button>
          <button className="mr-secondary" onClick={() => setExit(false)}>
            계속 꾸미기
          </button>
          <button className="mr-danger" onClick={() => navigate("/")}>
            저장하지 않고 나가기
          </button>
        </Modal>
      )}
    </main>
  )
}
