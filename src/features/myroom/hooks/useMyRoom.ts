import { useCallback, useEffect, useRef, useState } from "react"
import { ApiError } from "../../../lib/api"
import { myroomApi } from "../api"
import type { RoomArtwork } from "../artwork"
import { myRoomPreviewEnabled } from "../preview/enabled"
import type { ColoredSpec, RoomLayout, RoomState, StoredSummary } from "../types"

const ignoreUnauthorized = () => {}

export function useMyRoom(preview = false, expire = ignoreUnauthorized) {
  const isPreview = import.meta.env.DEV && preview && myRoomPreviewEnabled
  const [layout, setLayout] = useState<RoomLayout>({ objects: [] })
  const [baseline, setBaseline] = useState(JSON.stringify({ objects: [] }))
  const [revision, setRevision] = useState(0),
    [artworks, setArtworks] = useState<RoomArtwork[]>([]),
    [stored, setStored] = useState<StoredSummary[]>([])
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const generation = useRef(0)
  const [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [conflict, setConflict] = useState(false)
  const [remote, setRemote] = useState<RoomState | null>(null),
    [backup, setBackup] = useState<RoomLayout | null>(null)
  const dirty = baseline !== JSON.stringify(layout)
  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) expire()
      else setError(e instanceof Error ? e.message : "방을 불러오지 못했어요.")
    },
    [expire],
  )
  const load = useCallback(async () => {
    const requestId = ++generation.current
    setLoading(true)
    setError("")
    try {
      const source = isPreview
        ? (await import("../preview/data")).createPreviewSource()
        : null
      const [room, collection, storage] = source
        ? [source.load(), source.artworks, [] as StoredSummary[]]
        : await Promise.all([
            myroomApi.load(),
            myroomApi.artworks(),
            myroomApi.storage(),
          ])
      if (requestId !== generation.current) return
      if (room.schemaVersion !== 1)
        throw new Error("새 버전의 방이에요. 앱을 업데이트해 주세요.")
      setLayout(room.layout)
      setBaseline(JSON.stringify(room.layout))
      setRevision(room.revision)
      setArtworks(collection)
      setStored(storage)
      setSaved(false)
      setReady(true)
    } catch (e) {
      if (requestId === generation.current) fail(e)
    } finally {
      if (requestId === generation.current) setLoading(false)
    }
  }, [fail, isPreview])
  useEffect(() => {
    void load()
    return () => {
      generation.current++
    }
  }, [load])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  async function save() {
    if (saving || !dirty || conflict || loading || !ready) return
    setSaving(true)
    setError("")
    setSaved(false)
    const snapshot = layout
    try {
      const result = isPreview
        ? (await import("../preview/data"))
            .createPreviewSource()
            .save(snapshot, revision)
        : await myroomApi.save(snapshot, revision)
      setRevision(result.revision)
      setBaseline(JSON.stringify(snapshot))
      setSaved(true)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConflict(true)
      fail(e)
    } finally {
      setSaving(false)
    }
  }
  async function inspectConflict() {
    try {
      setRemote(
        isPreview
          ? (await import("../preview/data")).createPreviewSource().load()
          : await myroomApi.load(),
      )
    } catch (e) {
      fail(e)
    }
  }
  /** 수납함에서 지운다. 못 지우면 이유(한국어 메시지)를 돌려주고, 지웠으면 null */
  async function removeStored(id: number): Promise<string | null> {
    if (layout.objects.some((o) => o.storedObjectId === id))
      return "방에 놓여 있어요. 방에서 제거한 뒤 삭제해 주세요."
    try {
      await myroomApi.removeStored(id)
      setStored((list) => list.filter((s) => s.id !== id))
      return null
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) expire()
      if (e instanceof ApiError && e.status === 404)
        setStored((list) => list.filter((s) => s.id !== id))
      return e instanceof Error ? e.message : "삭제하지 못했어요."
    }
  }
  function acceptRemote() {
    if (!remote) return
    setBackup(layout)
    setLayout(remote.layout)
    setBaseline(JSON.stringify(remote.layout))
    setRevision(remote.revision)
    setConflict(false)
    setRemote(null)
    setError("")
    setSaved(false)
  }
  return {
    layout,
    setLayout,
    artworks,
    stored,
    removeStored,
    revision,
    dirty,
    loading,
    ready,
    saving,
    error,
    saved,
    conflict,
    remote,
    backup,
    save,
    load,
    inspectConflict,
    acceptRemote,
    restoreBackup: () => {
      if (backup) {
        setLayout(backup)
        setBackup(null)
      }
    },
  }
}
