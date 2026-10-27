// 그리기 툴바의 메뉴들: 굵기, 선 다듬기(손떨림 보정·선 끝 얇게), 되돌리기/다시 하기, 단축키 목록.
// 단축키 표시는 사용자가 바꾼 키(tools.keys)를 따른다.
import { Kbd, ToolbarButton, ToolbarMenu } from "../toolbar";
import { comboKeys, comboText, SHORTCUT_ACTIONS, SHORTCUT_LABELS, type ShortcutMap } from "../../lib/drawing/shortcuts";
import { BRUSH_MAX_SIZE, type DrawingTools } from "./useDrawingTools";

/** 툴바의 굵기 메뉴: 누르면 굵기 조절 바가 나온다 */
export function SizeMenu({ tools }: { tools: DrawingTools }) {
  const { size, sizeMax, erase, painting, keys } = tools;
  const name = erase ? "지우개" : painting ? "색칠 붓" : "브러쉬";
  return (
    <ToolbarMenu
      title={`${name} 굵기`}
      label={
        <>
          <span className="inline-block rounded-full bg-ink" style={{ width: 4 + Math.min(size, 24) / 2, height: 4 + Math.min(size, 24) / 2 }} aria-hidden="true" />
          굵기 {size}
        </>
      }
    >
      {() => (
        <label className="block text-sm font-bold">
          <span className="flex items-center justify-between">
            {name} 굵기 {size}
            <span className="flex gap-1">
              <Kbd>{comboText(keys.sizeDown)}</Kbd>
              <Kbd>{comboText(keys.sizeUp)}</Kbd>
            </span>
          </span>
          <input
            type="range"
            min={tools.sizeMin}
            max={sizeMax}
            value={size}
            onChange={(e) => tools.setSize(Number(e.target.value))}
            className="mt-2 w-full accent-sky-deep"
          />
          {!erase && !painting && sizeMax < BRUSH_MAX_SIZE && (
            <span className="mt-1 block text-xs font-medium text-ink-muted">흰 선 두께에 맞춰 브러쉬는 {sizeMax}까지만 굵게 할 수 있어요.</span>
          )}
        </label>
      )}
    </ToolbarMenu>
  );
}

/** 툴바의 선 다듬기 메뉴: 손떨림 보정과 선 끝 얇게 조절 바 (선 끝 얇게를 끈 화면에서는 손떨림 보정만) */
export function LineMenu({ tools }: { tools: DrawingTools }) {
  const { smoothing, fade, fadeEnabled } = tools;
  return (
    <ToolbarMenu title={fadeEnabled ? "손떨림 보정, 선 끝 얇게" : "손떨림 보정"} label={fadeEnabled ? "〰️ 선 다듬기" : "〰️ 손떨림 보정"}>
      {() => (
        <>
          <label className="block text-sm font-bold">
            <span className="flex justify-between">
              손떨림 보정 <span className="tabular-nums text-ink-muted">{smoothing}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={smoothing}
              onChange={(e) => tools.setSmoothing(Number(e.target.value))}
              className="mt-2 w-full accent-sky-deep"
            />
          </label>
          {fadeEnabled && (
            <label className="mt-3 block text-sm font-bold">
              <span className="flex justify-between">
                선 끝 얇게 <span className="tabular-nums text-ink-muted">{fade === 0 ? "끔" : fade}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={fade}
                onChange={(e) => tools.setFade(Number(e.target.value))}
                className="mt-2 w-full accent-sky-deep"
              />
            </label>
          )}
          <p className="mt-2 text-xs font-medium text-ink-muted">
            {fadeEnabled ? "보정을 올리면 선이 부드러워지고, 선 끝 얇게를 올리면 선의 시작과 끝이 가늘어져요." : "보정을 올리면 손이 떨려도 선이 부드럽게 그려져요."}
          </p>
        </>
      )}
    </ToolbarMenu>
  );
}

/** 되돌리기 / 다시 하기 */
export function HistoryButtons({ tools }: { tools: DrawingTools }) {
  return (
    <>
      <ToolbarButton title={`되돌리기 (${comboText(tools.keys.undo)})`} onClick={tools.undo}>
        <span className="text-lg leading-none">↶</span>
      </ToolbarButton>
      <ToolbarButton title={`다시 하기 (${comboText(tools.keys.redo)})`} onClick={tools.redo}>
        <span className="text-lg leading-none">↷</span>
      </ToolbarButton>
    </>
  );
}

/** 도움말 메뉴의 단축키 목록. 키는 설정 및 방법 화면에서 바꾼다 */
export function ShortcutList({ keys }: { keys: ShortcutMap }) {
  const rows: [string[], string][] = [...SHORTCUT_ACTIONS.map((a) => [comboKeys(keys[a]), SHORTCUT_LABELS[a]] as [string[], string]), [["휠"], "확대·축소"], [["우클릭"], "+드래그: 이동"]];
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
        {rows.map(([parts, desc]) => (
          <div key={desc} className="flex items-center gap-1.5">
            <dt className="flex shrink-0 items-center gap-0.5">
              {parts.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dt>
            <dd className="font-semibold">{desc}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs font-medium text-ink-muted">단축키는 메인의 "설정 및 방법"에서 바꿀 수 있어요.</p>
    </>
  );
}
