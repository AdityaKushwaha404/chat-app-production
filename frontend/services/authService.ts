import api from "@/utils/api";
import { ResponseProps } from "@/types";

export async function login(email: string, password: string): Promise<ResponseProps> {
  try {
    const payload = await api.post("/api/auth/login", { email, password });
    return { success: true, data: payload };
  } catch (err: any) {
    const msg = err?.message || "Login failed";
    return { success: false, msg };
  }
}

export async function verify(token?: string): Promise<ResponseProps> {
  try {
    if (token) {
      // verify an arbitrary token
      const res = await api.get("/api/auth/verify", { headers: { Authorization: `Bearer ${token}` } } as any);
      return { success: true, data: res };
    }
    const res = await api.get("/api/auth/verify");
    return { success: true, data: res };
  } catch (err: any) {
    const msg = err?.message || "Verify failed";
    return { success: false, msg };
  }
}

export async function register(
  name: string,
  email: string,
  password: string,
  avatar?: string
): Promise<ResponseProps> {
  try {
    const payload = await api.post("/api/auth/register", { name, email, password, avatar });
    return { success: true, data: payload };
  } catch (err: any) {
    const msg = err?.message || "Registration failed";
    return { success: false, msg };
  }
}

export default { login, register };
