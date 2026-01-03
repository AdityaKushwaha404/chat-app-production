export type UserItem = {
  _id: string;
  name: string;
  avatar?: string;
  email?: string;
};

import api from "@/utils/api";

export async function searchUsers(query = ""): Promise<UserItem[]> {
  const url = `/api/users${query ? `?search=${encodeURIComponent(query)}` : ""}`;
  const data = await api.get<UserItem[]>(url);
  return Array.isArray(data) ? data : [];
}

export async function getUserById(id: string): Promise<UserItem | null> {
  return await api.get(`/api/users/${id}`);
}

export async function registerPushToken(tokenValue: string) {
  return await api.post('/api/users/push-token', { token: tokenValue });
}
