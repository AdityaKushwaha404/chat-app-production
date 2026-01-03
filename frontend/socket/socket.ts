import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API_BASE_URL from "@/constants";

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;
  const token = await AsyncStorage.getItem("AUTH_TOKEN");
  if (!token) throw new Error("No auth token available");

  const url = API_BASE_URL.replace(/\/+$/, "");
  socket = io(url, {
    auth: { token },
    transports: ["websocket"],
  });

  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error("Failed to create socket"));
    socket.on("connect", () => resolve(socket as Socket));
    socket.on("connect_error", (err: any) => reject(err));
  });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

export default { connectSocket, disconnectSocket, getSocket };
