import api from "@/utils/api";

export async function getGroup(groupId: string) {
  return await api.get(`/api/groups/${groupId}`);
}

export async function updateGroup(groupId: string, payload: { name?: string; description?: string; photo?: string }) {
  return await api.put(`/api/groups/${groupId}`, payload);
}

export async function addMembers(groupId: string, payload: { members?: string[]; emails?: string[] }) {
  return await api.post(`/api/groups/${groupId}/add`, payload);
}

export async function removeMembers(groupId: string, payload: { members: string[] }) {
  return await api.post(`/api/groups/${groupId}/remove`, payload);
}

export async function updateSettings(groupId: string, payload: { onlyAdminCanSend?: boolean; onlyAdminCanEdit?: boolean }) {
  return await api.put(`/api/groups/${groupId}/settings`, payload);
}

export async function mute(groupId: string, until?: string | Date | null) {
  return await api.put(`/api/groups/${groupId}/mute`, { until: until || null });
}

export async function unmute(groupId: string) {
  return await api.put(`/api/groups/${groupId}/unmute`, {});
}

export async function setAvatar(groupId: string, url: string) {
  return await api.post(`/api/groups/${groupId}/avatar`, { url });
}

export async function leave(groupId: string) {
  return await api.post(`/api/groups/${groupId}/leave`, {});
}

export default { getGroup, updateGroup, addMembers, removeMembers, updateSettings, mute, unmute, setAvatar, leave };
