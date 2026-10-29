import { useCallback, useEffect, useRef, useState } from "react"
import { api, ApiError } from "../../../lib/api"
import { myroomApi } from "../api"
import type { RoomArtwork } from "../artwork"
import { myRoomPreviewEnabled } from "../preview/enabled"
import type { RoomLayout, RoomState } from "../types"

const ignoreUnauthorized = () => {}

export function useMyRoom(preview = false, expire = ignoreUnauthorized) {
  const isPreview = import.meta.env.DEV && preview && myRoomPreviewEnabled
  const [layout, setLayout] = useState<RoomLayout>({ objects: [] })
  const [baseline, setBaseline] = useState(JSON.stringify({ objects: [] }))
  const [revision, setRevision] = useState(0),
    [artworks, setArtworks] = useState<RoomArtwork[]>([])
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
      const [room, collection] = source
        ? [source.load(), source.artworks]
        : await Promise.all([
            myroomApi.load(),
            api
              .collection()
              .then((c) =>
                c.creatures.filter((a) => a.collected && a.imageKey),
              ),
          ])
      if (requestId !== generation.current) return
      if (room.schemaVersion !== 1)
        throw new Error("새 버전의 방이에요. 앱을 업데이트해 주세요.")
      setLayout(room.layout)
      setBaseline(JSON.stringify(room.layout))
      setRevision(room.revision)
      setArtworks(collection)
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
