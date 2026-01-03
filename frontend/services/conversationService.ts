import api from "@/utils/api";

export type ConversationCreatePayload = {
  type: "direct" | "group";
  name?: string;
  avatar?: string;
  participants: string[];
};

export async function createConversation(payload: ConversationCreatePayload) {
  return await api.post("/api/conversations", payload);
}

export async function getMyConversations() {
  return await api.get("/api/conversations");
}

export async function getConversation(id: string) {
  return await api.get(`/api/conversations/${id}`);
}

export async function updateConversation(id: string, payload: { name?: string; avatar?: string }) {
  return await api.put(`/api/conversations/${id}`, payload);
}

export async function addConversationMembers(id: string, payload: { members?: string[]; emails?: string[] }) {
  return await api.post(`/api/conversations/${id}/members`, payload);
}
