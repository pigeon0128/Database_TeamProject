import { artworkUrl, type CreatureEntry } from "../../../lib/api"
import { creatureGuide } from "../../../data/creatures"
import { Modal } from "./RoomUI"

export default function ArtworkPicker({
  artworks,
  current,
  onChoose,
  onClose,
}: {
  artworks: CreatureEntry[]
  current?: number
  onChoose: (id: number) => void
  onClose: () => void
}) {
  return (
    <Modal
      title="전시할 그림 선택"
      onClose={onClose}
      className="mr-artwork-picker"
    >
      <p className="mr-policy">
        내 도감의 완성 작품이에요. 새 최고 기록을 완성하면 전시 그림도 함께
        갱신돼요.
      </p>
      {artworks.length ? (
        <div className="mr-artwork-grid">
          {artworks.map((a) => (
            <button
              key={a.drawingId}
              aria-label={`${a.name} 전시`}
              onClick={() => onChoose(a.drawingId)}
              aria-pressed={current === a.drawingId}
            >
              <div className="mr-artwork-image">
                {creatureGuide(a.slug) && (
                  <img src={creatureGuide(a.slug)!} alt="" className="guide" />
                )}
                <img
                  src={artworkUrl(a.imageKey!)}
                  alt={a.name}
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden"
                    e.currentTarget.parentElement?.setAttribute(
                      "data-image-error",
                      "그림을 불러오지 못했어요",
                    )
                  }}
                />
              </div>
              <strong>{a.name}</strong>
              <small>
                {current === a.drawingId ? "현재 전시 중" : "이 그림 전시하기"}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <div className="mr-empty">
          <p>아직 완성한 도감 그림이 없어요.</p>
          <p>도감에서 그림을 완성한 뒤 이 방으로 돌아와 주세요.</p>
        </div>
      )}
      <footer>
        <button className="mr-secondary" onClick={onClose}>
          취소
        </button>
      </footer>
    </Modal>
  )
}
