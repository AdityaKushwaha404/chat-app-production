import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  conversations: "conversations",
  messagesPrefix: "messages:",
};

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export async function saveConversations(list: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.conversations, JSON.stringify(list || []));
  } catch {}
}

export async function loadConversations(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.conversations);
    return safeParse<any[]>(raw, []);
  } catch {
    return [];
  }
}

export async function saveMessages(conversationId: string, list: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.messagesPrefix + conversationId, JSON.stringify(list || []));
  } catch {}
}

export async function loadMessages(conversationId: string): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.messagesPrefix + conversationId);
    return safeParse<any[]>(raw, []);
  } catch {
    return [];
  }
}

export async function clearMessages(conversationId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.messagesPrefix + conversationId);
  } catch {}
}
