export type DorobusMainCharacterName = "codex" | "zero" | "naty" | "rico" | "xylo";

const characterUrls: Record<DorobusMainCharacterName, string> = {
  codex: "/assets/dorobus/characters/codex.svg",
  zero: "/assets/dorobus/characters/zero.svg",
  naty: "/assets/dorobus/characters/naty.svg",
  rico: "/assets/dorobus/characters/rico.svg",
  xylo: "/assets/dorobus/characters/xylo.svg",
};

type Props = {
  character: DorobusMainCharacterName;
  label: string;
  className?: string;
  joyful?: boolean;
};

export default function DorobusMainCharacter({ character, label, className = "", joyful = false }: Props) {
  const src = character === "codex" && joyful ? "/assets/dorobus/drawing/codex-guide.svg" : characterUrls[character];
  return <img src={src} alt={label} className={`select-none object-contain ${className}`} draggable={false} />;
}
