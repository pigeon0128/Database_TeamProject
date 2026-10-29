// Explicit opt-in, local Vite development only. Production builds fold this to false.
export const myRoomPreviewEnabled =
  import.meta.env.DEV &&
  import.meta.env.VITE_MYROOM_PREVIEW === "true" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
