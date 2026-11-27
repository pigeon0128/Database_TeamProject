// 마이룸 왼쪽 도구 막대의 "그린 그림 보기": 내 도감·스토리 완성작과 AI 그림을 한눈에 본다.
// AI 그림은 ✏️ 로 이름을 바꿀 수 있다 (처음 이름은 쓴 설명의 앞부분이라 알아보기 어려워서).
// AI 그림만 오른쪽 위 빨간 X 로 지울 수 있다 (도감·스토리 완성작은 점수·도감 기록과 이어져 있어 여기서는 보기만).
// 지우기 전에 한 번 더 묻는다. 액자에 걸려 있는 그림은 지우지 않는다 (useMyRoom.removeArtwork).
import { useState } from "react"
import { roomArtworkGuide, roomArtworkImage, type RoomArtwork } from "../artwork"
import { Modal } from "./RoomUI"

/** 이름 길이 (서버·DB 와 같다) */
const MAX_TITLE = 40

const kindLabel = (kind: RoomArtwork["kind"]) =>
  kind === "story" ? "스토리 완성작" : kind === "ai" ? "AI 그림" : "도감 완성작"

export default function GalleryPanel({
  artworks,
  onDelete,
  onRename,
  onClose,
}: {
  artworks: RoomArtwork[]
  /** 지운다. 못 지우면 이유(한국어), 지웠으면 null */
  onDelete: (drawingId: number) => Promise<string | null>
  /** 이름을 바꾼다. 못 바꾸면 이유(한국어), 바꿨으면 null */
  onRename: (drawingId: number, title: string) => Promise<string | null>
  onClose: () => void
}) {
  /** 지울지 묻는 그림 */
  const [asking, setAsking] = useState<RoomArtwork | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  /** 이름을 고치는 중인 그림과 적고 있는 이름 */
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null)
  const [renaming, setRenaming] = useState(false)

  const saveName = async () => {
    if (!editing || renaming) return
    const title = editing.text.trim()
    const before = artworks.find((a) => a.drawingId === editing.id)
    if (!title || title === before?.name) {
      setEditing(null)
      return
    }
    setRenaming(true)
    const error = await onRename(editing.id, title)
    setRenaming(false)
    if (error) setMessage({ ok: false, text: error })
    else {
      setMessage({ ok: true, text: `이름을 "${title}"(으)로 바꿨어요.` })
      setEditing(null)
    }
  }

  const confirmDelete = async () => {
    if (!asking || deleting) return
    setDeleting(true)
    const error = await onDelete(asking.drawingId)
    setDeleting(false)
    setMessage(error ? { ok: false, text: error } : { ok: true, text: `"${asking.name}"을(를) 지웠어요.` })
    setAsking(null)
  }

  return (
    <>
      <Modal title="그린 그림 보기" onClose={onClose} className="mr-artwork-picker mr-gallery">
        <p className="mr-policy">
          내가 완성한 도감·스토리 그림과 AI 그림이에요. AI 그림은 ✏️ 로 이름을 바꾸고, 오른쪽 위 ✕ 로 지울 수 있어요.
        </p>
        {message && (
          <p role="status" className={`mr-gallery-message ${message.ok ? "ok" : "error"}`}>
            {message.text}
          </p>
        )}
        {artworks.length ? (
          <div className="mr-artwork-grid">
            {artworks.map((a) => (
              <div key={a.drawingId} className="mr-gallery-item">
                <div className="mr-artwork-image">
                  {roomArtworkGuide(a) && <img src={roomArtworkGuide(a)} alt="" className="guide" loading="lazy" />}
                  <img src={roomArtworkImage(a)} alt={a.name} loading="lazy" />
                </div>
                {a.kind === "ai" && (
                  <button
                    type="button"
                    className="mr-artwork-delete"
                    aria-label={`${a.name} 지우기`}
                    title="이 그림 지우기"
                    onClick={() => {
                      setMessage(null)
                      setAsking(a)
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 7l10 10M17 7 7 17" />
                    </svg>
                  </button>
                )}
                {editing?.id === a.drawingId ? (
                  // 이름 고치기: Enter 저장, Esc 취소 (Esc 가 창까지 닫지 않게 막는다)
                  <form
                    className="mr-gallery-rename"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void saveName()
                    }}
                  >
                    <input
                      value={editing.text}
                      onChange={(e) => setEditing({ id: a.drawingId, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.stopPropagation()
                          setEditing(null)
                        }
                      }}
                      maxLength={MAX_TITLE}
                      aria-label="새 이름"
                      autoFocus
                      disabled={renaming}
                    />
                    <button type="submit" disabled={renaming || !editing.text.trim()} aria-label="이름 저장">
                      {renaming ? "…" : "저장"}
                    </button>
                  </form>
                ) : (
                  <div className="mr-gallery-name">
                    <strong title={a.name}>{a.name}</strong>
                    {a.kind === "ai" && (
                      <button
                        type="button"
                        aria-label={`${a.name} 이름 바꾸기`}
                        title="이름 바꾸기"
                        onClick={() => {
                          setMessage(null)
                          setEditing({ id: a.drawingId, text: a.name })
                        }}
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                )}
                <small>{kindLabel(a.kind)}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="mr-empty">
            <p>아직 그린 그림이 없어요.</p>
            <p>도감이나 스토리에서 그림을 완성하거나, AI 그림 연습실에서 마이룸에 추가해 보세요.</p>
          </div>
        )}
      </Modal>

      {/* 한 번 더 묻기 */}
      {asking && (
        <Modal title="그림 지우기" onClose={() => !deleting && setAsking(null)} className="mr-confirm">
          <p>
            <b>"{asking.name}"</b>을(를) 지울까요?
            <br />
            지운 그림은 되돌릴 수 없어요.
          </p>
          <button className="mr-secondary" onClick={() => setAsking(null)} disabled={deleting}>
            취소
          </button>
          <button className="mr-danger" onClick={() => void confirmDelete()} disabled={deleting}>
            {deleting ? "지우는 중…" : "지우기"}
          </button>
        </Modal>
      )}
    </>
  )
}
