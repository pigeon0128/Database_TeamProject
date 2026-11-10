import test from "node:test"
import assert from "node:assert/strict"
import {
  createLayoutHistory,
  layoutHistoryReducer as reduce,
  historyDirty,
  layoutKey,
  placeLayoutObject,
} from "../src/features/myroom/hooks/layoutHistory.ts"
import { validateLayout, TABLE_TOP } from "../shared/myroom.js"

const object = (type = "easel", id = type) => ({
  id,
  type,
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
  scale: 1,
})
const empty = { objects: [] }
const edit = (state, objects, group) =>
  reduce(state, { type: "edit", update: { objects }, group })

test("install each catalog kind, undo and redo without changing the baseline", () => {
  for (const type of ["easel", "frame", "colored", "chair", "table", "plant"]) {
    let state = createLayoutHistory(empty)
    state = edit(state, [object(type)])
    assert.equal(state.past.length, 1)
    assert.equal(historyDirty(state), true)
    state = reduce(state, { type: "undo" })
    assert.deepEqual(state.present, empty)
    assert.equal(historyDirty(state), false)
    state = reduce(state, { type: "redo" })
    assert.equal(state.present.objects[0].type, type)
    assert.equal(historyDirty(state), true)
  }
})

test("move and rotate a table plus its raised object as one validated step", () => {
  const table = object("table")
  const raised = {
    ...object("colored"),
    storedObjectId: 1,
    position: { x: 0.3, y: TABLE_TOP, z: 0 },
  }
  const initial = { objects: [table, raised] }
  const moved = {
    ...table,
    position: { x: 3, y: 0, z: 4 },
    rotation: Math.PI / 2,
  }
  let state = reduce(createLayoutHistory(initial), {
    type: "edit",
    update: (l) => placeLayoutObject(l, moved),
  })
  assert.equal(state.past.length, 1)
  assert.equal(validateLayout(state.present).objects.length, 2)
  const child = state.present.objects.find((o) => o.id === "colored")
  assert.deepEqual(child.position, { x: 3, y: TABLE_TOP, z: 3.7 })
  assert.equal(child.rotation, Math.PI / 2)
  const next = state.present
  state = reduce(state, { type: "undo" })
  assert.deepEqual(state.present, initial)
  assert.deepEqual(reduce(state, { type: "redo" }).present, next)
})

test("artwork replacement and deletion restore both frame/easel links", () => {
  for (const type of ["frame", "easel"]) {
    const initial = { objects: [{ ...object(type), artworkDrawingId: 1 }] }
    let state = edit(createLayoutHistory(initial), [
      { ...initial.objects[0], artworkDrawingId: 2 },
    ])
    state = edit(state, [])
    state = reduce(state, { type: "undo" })
    assert.equal(state.present.objects[0].artworkDrawingId, 2)
    state = reduce(state, { type: "undo" })
    assert.equal(state.present.objects[0].artworkDrawingId, 1)
    state = reduce(reduce(state, { type: "redo" }), { type: "redo" })
    assert.deepEqual(state.present, empty)
  }
})

test("a new actual edit discards redo; no-op/reordered updates do not", () => {
  let state = edit(createLayoutHistory(empty), [object()])
  state = edit(state, [
    object(),
    { ...object("chair"), position: { x: 3, y: 0, z: 0 } },
  ])
  assert.equal(
    reduce(state, {
      type: "edit",
      update: { objects: [...state.present.objects].reverse() },
    }),
    state,
  )
  state = reduce(state, { type: "undo" })
  assert.equal(edit(state, [{ ...object(), scale: undefined }]), state)
  assert.equal(state.future.length, 1)
  state = edit(state, [object("plant")])
  assert.equal(state.future.length, 0)
})

test("slider changes group together, with a separate step for the next gesture", () => {
  const initial = { objects: [object("colored")] }
  let state = createLayoutHistory(initial)
  for (const scale of [1.1, 1.2, 1.3, 1.4])
    state = edit(state, [{ ...object("colored"), scale }], "drag-1")
  assert.equal(state.past.length, 1)
  state = reduce(state, { type: "endGroup" })
  state = edit(state, [{ ...object("colored"), scale: 1.5 }], "drag-2")
  assert.equal(state.past.length, 2)
  state = reduce(state, { type: "undo" })
  assert.equal(state.present.objects[0].scale, 1.4)
  assert.deepEqual(reduce(state, { type: "undo" }).present, initial)
})

test("a slider gesture returning to its start does not leave an empty undo step", () => {
  let state = createLayoutHistory({ objects: [object("colored")] })
  state = edit(state, [{ ...object("colored"), scale: 1.5 }], "drag")
  state = edit(state, [object("colored")], "drag")
  state = reduce(state, { type: "endGroup" })
  assert.equal(state.past.length, 0)
  assert.equal(historyDirty(state), false)
})

test("history is bounded to the most recent 50 edits", () => {
  let state = createLayoutHistory(empty)
  for (let i = 0; i < 75; i++)
    state = edit(state, [{ ...object(), position: { x: i, y: 0, z: 0 } }])
  assert.equal(state.past.length, 50)
  for (let i = 0; i < 50; i++) state = reduce(state, { type: "undo" })
  assert.equal(state.past.length, 0)
  assert.equal(state.present.objects[0].position.x, 24)
  assert.equal(state.future.length, 50)
})

test("successful save marks the requested snapshot, including edits during the request", () => {
  let state = edit(createLayoutHistory(empty), [object()])
  const snapshot = state.present
  state = edit(state, [object("plant")])
  state = reduce(state, { type: "saved", snapshot })
  assert.equal(state.baseline, layoutKey(snapshot))
  assert.equal(historyDirty(state), true)
  state = reduce(state, { type: "undo" })
  assert.equal(historyDirty(state), false)
  state = reduce(state, { type: "undo" })
  assert.equal(historyDirty(state), true)
  state = reduce(state, { type: "redo" })
  assert.equal(historyDirty(state), false)
})

test("remote acceptance resets history; backup restore is undoable against the new baseline", () => {
  let state = edit(createLayoutHistory(empty), [object()])
  const backup = state.present
  const remote = { objects: [object("plant")] }
  state = reduce(state, { type: "reset", layout: remote })
  assert.equal(state.past.length, 0)
  assert.equal(state.future.length, 0)
  assert.equal(historyDirty(state), false)
  state = reduce(state, { type: "edit", update: backup })
  assert.equal(historyDirty(state), true)
  state = reduce(state, { type: "undo" })
  assert.deepEqual(state.present, remote)
  assert.equal(historyDirty(state), false)
})

test("re-evaluating an updater/reducer in StrictMode has no external history side effects", () => {
  const state = createLayoutHistory(empty)
  const action = { type: "edit", update: (l) => placeLayoutObject(l, object()) }
  Object.freeze(state.present.objects)
  Object.freeze(state.present)
  Object.freeze(state.past)
  Object.freeze(state.future)
  Object.freeze(state)
  assert.deepEqual(reduce(state, action), reduce(state, action))
  assert.equal(state.past.length, 0)
  assert.equal(reduce(state, action).past.length, 1)
})
