import { getSocket } from "./socket";

export function testSocket(cb?: (res: any) => void) {
  const socket = getSocket();
  if (!socket) throw new Error("Socket not connected");

  socket.emit("test:ping", { ts: Date.now() }, (res: any) => {
    if (cb) cb(res);
  });
}

export default { testSocket };
