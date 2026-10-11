// 파일 내려받기
/** data URL을 파일로 내려받는다. */
export function downloadImage(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
