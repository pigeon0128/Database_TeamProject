import type { RoomLayout, RoomObject } from "../types.ts"
import { onTable } from "../../../../shared/myroom.js"

export const HISTORY_LIMIT = 50
export type LayoutUpdate = RoomLayout | ((current: RoomLayout) => RoomLayout)
export type LayoutHistory = {
  present: RoomLayout
  past: RoomLayout[]
  future: RoomLayout[]
  baseline: string
  group: string | null
}
export type HistoryAction = {
  type: "edit"
  update: LayoutUpdate
  group?: string | null
} | { type: "undo" | "redo" | "endGroup" } | {
  type: "reset"
  layout: RoomLayout
} | {
  type: "saved"
  snapshot: RoomLayout
}

// Object ordering / omitted default scale are not layout edits.
export function layoutKey(layout: RoomLayout): string {
  return JSON.stringify(
    [...layout.objects]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((o) => [
        o.id,
        o.type,
        o.position.x,
        o.position.y,
        o.position.z,
        o.rotation,
        o.scale ?? 1,
        o.wall ?? null,
        o.artworkDrawingId ?? null,
        o.storedObjectId ?? null,
      ]),
  )
}
export function createLayoutHistory(layout: RoomLayout): LayoutHistory {
  return {
    present: layout,
    past: [],
    future: [],
    baseline: layoutKey(layout),
    group: null,
  }
}
export const historyDirty = (state: LayoutHistory) =>
  layoutKey(state.present) !== state.baseline

function endGroup(state: LayoutHistory): LayoutHistory {
  if (!state.group) return state
  const previous = state.past[state.past.length - 1]
  return {
    ...state,
    group: null,
    past:
      previous && layoutKey(previous) === layoutKey(state.present)
        ? state.past.slice(0, -1)
        : state.past,
  }
}

// Pure: React StrictMode may evaluate this and updater functions more than once.
export function layoutHistoryReducer(
  state: LayoutHistory,
  action: HistoryAction,
): LayoutHistory {
  if (action.type === "reset") return createLayoutHistory(action.layout)
  if (action.type === "saved")
    return { ...endGroup(state), baseline: layoutKey(action.snapshot) }
  if (action.type === "endGroup") return endGroup(state)
  if (action.type === "edit") {
    const next =
      typeof action.update === "function"
        ? action.update(state.present)
        : action.update
    if (layoutKey(next) === layoutKey(state.present)) return state
    const group = action.group ?? null
    const previous = group && state.group === group ? state : endGroup(state)
    return {
      ...previous,
      present: next,
      past:
        group && previous.group === group
          ? previous.past
          : [...previous.past, previous.present].slice(-HISTORY_LIMIT),
      future: [],
      group,
    }
  }
  const current = endGroup(state)
  if (action.type === "undo") {
    const previous = current.past[current.past.length - 1]
    return previous
      ? {
          ...current,
          present: previous,
          past: current.past.slice(0, -1),
          future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
        }
      : current
  }
  const next = current.future[0]
  return next
    ? {
        ...current,
        present: next,
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        future: current.future.slice(1),
      }
    : current
}

/** A table and everything on it move in the same layout update / history step. */
export function placeLayoutObject(
  current: RoomLayout,
  object: RoomObject,
): RoomLayout {
  const before = current.objects.find((o) => o.id === object.id)
  let rest = current.objects.filter((o) => o.id !== object.id)
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
          (((o.rotation + turn) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
      }
    })
  }
  return { objects: [...rest, object] }
}
