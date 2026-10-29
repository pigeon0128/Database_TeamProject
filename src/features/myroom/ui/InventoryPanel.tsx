import { useState } from "react"
import { CATALOG } from "../../../../shared/myroom.js"
import type { ObjectType } from "../types"
import { Modal, ObjectThumbnail } from "./RoomUI"

const descriptions: Record<ObjectType, string> = {
  frame: "벽에 거는 액자. 내 도감의 완성 작품을 전시할 수 있어요.",
  easel: "바닥에 세우는 목재 이젤. 완성 작품을 골라 캔버스에 전시해요.",
  chair: "접이식 의자를 바닥에 놓아 보세요.",
  table: "나무 책상. 의자와 함께 배치할 수 있어요.",
  plant: "작은 나무와 화분으로 방을 꾸며 보세요.",
}
export default function InventoryPanel({
  onClose,
  onPlace,
}: {
  onClose: () => void
  onPlace: (type: ObjectType) => void
}) {
  const [tab, setTab] = useState("전체"),
    [selected, setSelected] = useState<ObjectType | null>(null)
  const categories = ["전체", "벽 가구", "의자", "테이블", "장식"]
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
            .filter((c) => tab === "전체" || tab === c)
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
                        onClick={() => setSelected(type)}
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
        </div>
        <aside className="mr-item-detail">
          <h3>선택한 아이템</h3>
          {selected ? (
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
