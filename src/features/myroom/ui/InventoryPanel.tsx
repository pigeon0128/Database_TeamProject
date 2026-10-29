import { useState } from "react"
import { CATALOG } from "../../../../shared/myroom.js"
import type { ObjectType, StoredSummary } from "../types"
import { Modal, ObjectThumbnail } from "./RoomUI"

const descriptions: Record<ObjectType, string> = {
  frame: "벽에 거는 액자. 내 도감의 완성 작품을 전시할 수 있어요.",
  chair: "접이식 의자를 바닥에 놓아 보세요.",
  table: "나무 책상. 의자와 함께 배치할 수 있어요.",
  plant: "작은 나무와 화분으로 방을 꾸며 보세요.",
  colored: "3D 색칠하기에서 수납한 오브젝트. 바닥이나 테이블 위에 놓을 수 있어요.",
}
export default function InventoryPanel({
  onClose,
  onPlace,
  stored,
  onPlaceStored,
  onDeleteStored,
}: {
  onClose: () => void
  onPlace: (type: ObjectType) => void
  stored: StoredSummary[]
  onPlaceStored: (id: number) => void
  /** 지우지 못하면 이유를, 지웠으면 null을 돌려준다 */
  onDeleteStored: (id: number) => Promise<string | null>
}) {
  const [tab, setTab] = useState("전체"),
    [selected, setSelected] = useState<ObjectType | null>(null),
    [storedId, setStoredId] = useState<number | null>(null),
    [deleteError, setDeleteError] = useState<string | null>(null)
  const categories = ["전체", "벽 가구", "의자", "테이블", "장식", "수납함"]
  const storedItem = stored.find((s) => s.id === storedId)
  async function remove(item: StoredSummary) {
    if (!window.confirm(`'${item.name}'을(를) 수납함에서 삭제할까요?
삭제하면 되돌릴 수 없어요.`))
      return
    const error = await onDeleteStored(item.id)
    setDeleteError(error)
    if (!error && storedId === item.id) setStoredId(null)
  }
  return (
    <Modal title="인벤토리" onClose={onClose} className="mr-inventory">
      <div className="mr-inventory-body">
        <div className="mr-inventory-list">
          <nav aria-label="아이템 분류">
            {categories.map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
              >
                {t}
              </button>
            ))}
          </nav>
          {categories
            .slice(1)
            .filter((c) => c !== "수납함" && (tab === "전체" || tab === c))
            .map((c) => (
              <section key={c}>
                <h3>가구 : {c}</h3>
                <div className="mr-item-grid">
                  {(Object.keys(CATALOG) as ObjectType[])
                    .filter((t) => CATALOG[t].category === c)
                    .map((type) => (
                      <button
                        key={type}
                        aria-label={`${CATALOG[type].name} 선택`}
                        aria-pressed={selected === type}
                        onClick={() => {
                          setSelected(type)
                          setStoredId(null)
                        }}
                        className={`mr-item ${
                          selected === type ? "selected" : ""
                        }`}
                      >
                        <span className="mr-rarity">기본</span>
                        <ObjectThumbnail type={type} />
                        <strong>{CATALOG[type].name}</strong>
                        <small>{CATALOG[type].category}</small>
                      </button>
                    ))}
                </div>
              </section>
            ))}
          {(tab === "전체" || tab === "수납함") && (
            <section>
              <h3>수납함 : 내가 색칠한 오브젝트</h3>
              {stored.length ? (
                <>
                <div className="mr-item-grid">
                  {stored.map((item) => (
                    <div key={item.id} className="mr-item-cell">
                      <button
                        aria-label={`${item.name} 선택`}
                        aria-pressed={storedId === item.id}
                        onClick={() => {
                          setStoredId(item.id)
                          setSelected(null)
                          setDeleteError(null)
                        }}
                        className={`mr-item ${storedId === item.id ? "selected" : ""}`}
                      >
                        <span className="mr-rarity">수납</span>
                        <img
                          className="mr-thumbnail"
                          src={item.thumbnail}
                          alt=""
                          draggable={false}
                        />
                        <strong>{item.name}</strong>
                        <small>색칠 오브젝트</small>
                      </button>
                      <button
                        className="mr-item-delete"
                        aria-label={`${item.name} 삭제`}
                        title="수납함에서 삭제"
                        onClick={() => void remove(item)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                {deleteError && (
                  <p className="mr-size-error" role="alert">
                    {deleteError}
                  </p>
                )}
                </>
              ) : (
                <p className="mr-muted">
                  아직 수납한 오브젝트가 없어요. 3D 색칠하기에서 칠한 뒤
                  '수납하기'를 눌러 보세요.
                </p>
              )}
            </section>
          )}
        </div>
        <aside className="mr-item-detail">
          <h3>선택한 아이템</h3>
          {storedItem ? (
            <>
              <img
                className="mr-thumbnail"
                src={storedItem.thumbnail}
                alt=""
                draggable={false}
              />
              <h3>{storedItem.name}</h3>
              <div className="mr-tags">
                <span>수납</span>
                <span>색칠</span>
              </div>
              <p>{descriptions.colored}</p>
              <button
                className="mr-primary"
                onClick={() => onPlaceStored(storedItem.id)}
              >
                배치
              </button>
            </>
          ) : selected ? (
            <>
              <ObjectThumbnail type={selected} />
              <h3>{CATALOG[selected].name}</h3>
              <div className="mr-tags">
                <span>기본</span>
                <span>가구</span>
              </div>
              <p>{descriptions[selected]}</p>
              <button className="mr-primary" onClick={() => onPlace(selected)}>
                배치
              </button>
            </>
          ) : (
            <p>아이템을 선택하면 상세 정보가 표시됩니다</p>
          )}
        </aside>
      </div>
    </Modal>
  )
}
