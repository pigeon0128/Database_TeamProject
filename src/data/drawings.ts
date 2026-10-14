// 앱에 있는 모든 그림(스토리 장면 + 도감 생물)을 DB drawing_id 로 찾는다. 리더보드에서 밑그림을 깔 때 쓴다.
import { creatureScenes } from "./creatures";
import { scenes } from "./scenes";

export const findDrawingScene = (drawingId: number) => [...scenes, ...creatureScenes].find((s) => s.drawingId === drawingId);
