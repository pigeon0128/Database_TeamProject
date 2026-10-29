import { useEffect, useRef, useState } from "react"
import { myroomApi } from "../api"
import type { ColoredSpec, Placement, RoomLayout } from "../types"

/** 방에 놓였거나 배치 중인 색칠 오브젝트의 모양을 필요할 때 한 번씩만 불러온다. */
export function useStoredSpecs(
  layout: RoomLayout,
  placement: Placement | null,
  enabled: boolean,
) {
  const [specs, setSpecs] = useState<Record<number, ColoredSpec>>({})
  const requested = useRef(new Set<number>())
  const wanted = [
    ...layout.objects.flatMap((o) => (o.storedObjectId ? [o.storedObjectId] : [])),
    ...(placement?.storedObjectId ?? placement?.original?.storedObjectId
      ? [(placement.storedObjectId ?? placement.original?.storedObjectId)!]
      : []),
  ]
  const key = [...new Set(wanted)].sort().join(",")
  useEffect(() => {
    if (!enabled) return
    for (const id of key ? key.split(",").map(Number) : []) {
      if (requested.current.has(id)) continue
      requested.current.add(id)
      myroomApi
        .stored(id)
        .then((r) => setSpecs((current) => ({ ...current, [id]: r.spec })))
        .catch(() => requested.current.delete(id))
    }
  }, [key, enabled])
  return specs
}
