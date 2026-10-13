// 그리기 단축키: 동작 목록, 기본 키, 키 조합 글자("Ctrl+KeyZ")와 화면 표시("Ctrl", "Z") 사이의 변환.
// 사용자가 바꾼 키는 그리기 설정(lib/userSettings, DB user_settings.shortcuts)에 바꾼 동작만 저장한다.
// 키 조합 형식과 동작 이름은 서버 server/routes/settings.js 의 readShortcuts 와 같아야 한다.

/** 단축키로 할 수 있는 동작 (표시 순서) */
export const SHORTCUT_ACTIONS = ["brush", "eraser", "sizeDown", "sizeUp", "undo", "redo", "zoomIn", "zoomOut", "zoomReset"] as const;
export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

/** 동작별 키 조합. "Ctrl+", "Shift+", "Alt+" 를 이 순서로 붙이고 마지막은 물리 키 이름(KeyboardEvent.code) */
export type ShortcutMap = Record<ShortcutAction, string>;

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  brush: "브러쉬",
  eraser: "지우개",
  sizeDown: "굵기 줄이기",
  sizeUp: "굵기 늘리기",
  undo: "되돌리기",
  redo: "다시 하기",
  zoomIn: "확대",
  zoomOut: "축소",
  zoomReset: "원래 크기",
};

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  brush: "KeyB",
  eraser: "KeyE",
  sizeDown: "BracketLeft",
  sizeUp: "BracketRight",
  undo: "Ctrl+KeyZ",
  redo: "Ctrl+KeyY",
  zoomIn: "Ctrl+Equal",
  zoomOut: "Ctrl+Minus",
  zoomReset: "Ctrl+Digit0",
};

/** 키 조합 글자 형식 (서버 readShortcuts 와 같다) */
const COMBO_RULE = /^(Ctrl\+)?(Shift\+)?(Alt\+)?[A-Za-z0-9]{1,20}$/;

/** 브라우저가 먼저 가져가서 막을 수 없거나, 설정 화면에서 쓰는 키 */
const RESERVED = new Set(["Escape", "Tab", "Shift+Tab", "Ctrl+KeyW", "Ctrl+KeyT", "Ctrl+KeyN", "Ctrl+Tab", "Ctrl+Shift+Tab", "F5", "Ctrl+KeyR"]);
const MODIFIER_CODES = new Set(["ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight", "CapsLock"]);

/** 숫자 패드 키는 위쪽 줄의 같은 키로 본다 (Ctrl + 숫자 패드 + 도 확대) */
function normalizeCode(code: string) {
  if (/^Numpad\d$/.test(code)) return `Digit${code.slice(6)}`;
  if (code === "NumpadAdd") return "Equal";
  if (code === "NumpadSubtract") return "Minus";
  return code;
}

/** 키 이벤트를 키 조합 글자로. 수정 키(Ctrl·Shift 등)만 눌렀으면 null. Mac의 ⌘ 는 Ctrl 로 본다 */
export function comboFromEvent(e: KeyboardEvent, { shift = true } = {}): string | null {
  if (!e.code || MODIFIER_CODES.has(e.code)) return null;
  return [e.ctrlKey || e.metaKey ? "Ctrl+" : "", shift && e.shiftKey ? "Shift+" : "", e.altKey ? "Alt+" : "", normalizeCode(e.code)].join("");
}

/** 키 이벤트에 맞는 동작. Shift 를 붙인 조합이 따로 없으면 Shift 를 빼고 한 번 더 찾는다 (Ctrl+Shift+= 도 확대) */
export function actionForEvent(e: KeyboardEvent, keys: ShortcutMap): ShortcutAction | null {
  const find = (combo: string | null) => (combo ? (SHORTCUT_ACTIONS.find((a) => keys[a] === combo) ?? null) : null);
  return find(comboFromEvent(e)) ?? (e.shiftKey ? find(comboFromEvent(e, { shift: false })) : null);
}

/** 새 키로 쓸 수 없으면 그 이유 */
export function comboProblem(combo: string): string | null {
  if (RESERVED.has(combo)) return "브라우저나 설정 화면이 쓰는 키라서 쓸 수 없어요.";
  if (!COMBO_RULE.test(combo)) return "이 키는 쓸 수 없어요.";
  return null;
}

const KEY_NAMES: Record<string, string> = {
  BracketLeft: "[",
  BracketRight: "]",
  Equal: "+",
  Minus: "−",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Space: "Space",
  Enter: "Enter",
  Backspace: "Backspace",
  Delete: "Delete",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/** "Ctrl+KeyZ" → ["Ctrl", "Z"] (키 모양 표시용) */
export function comboKeys(combo: string): string[] {
  const parts = combo.split("+");
  const code = parts.pop() ?? "";
  const name = KEY_NAMES[code] ?? code.replace(/^Key/, "").replace(/^Digit/, "");
  return [...parts, name];
}

/** "Ctrl+KeyZ" → "Ctrl+Z" (버튼 안내 글자용) */
export const comboText = (combo: string) => comboKeys(combo).join("+");

/** 저장된 값(바꾼 동작만)을 기본값 위에 얹는다. 형식이 틀린 항목은 기본값으로, 두 동작이 같은 키를 쓰면 모두 기본값으로 */
export function resolveShortcuts(saved: Partial<Record<string, unknown>> | null | undefined): ShortcutMap {
  const keys = { ...DEFAULT_SHORTCUTS };
  for (const action of SHORTCUT_ACTIONS) {
    const combo = saved?.[action];
    if (typeof combo === "string" && COMBO_RULE.test(combo)) keys[action] = combo;
  }
  return new Set(Object.values(keys)).size === SHORTCUT_ACTIONS.length ? keys : { ...DEFAULT_SHORTCUTS };
}

/** 기본값과 다른 동작만 남긴다 (DB에 저장하는 모양) */
export function changedShortcuts(keys: ShortcutMap): Partial<ShortcutMap> {
  const out: Partial<ShortcutMap> = {};
  for (const action of SHORTCUT_ACTIONS) if (keys[action] !== DEFAULT_SHORTCUTS[action]) out[action] = keys[action];
  return out;
}
