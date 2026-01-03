import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors, spacingY } from "@/constants/theme";
import { useRouter, useLocalSearchParams } from "expo-router";
import Avatar from "@/components/Avatar";
import * as ImagePicker from "expo-image-picker";
import { uploadFileToCloudinary } from "@/services/imageService";
import { Alert } from "react-native";
import { searchUsers } from "@/services/userService";
import { createConversation } from "@/services/conversationService";
import Button from "@/components/Button";

const NewConversationModal = () => {
  const router = useRouter();
  const params = useLocalSearchParams?.() || {};
  const isGroup = params?.isGroup === "1" || params?.isGroup === 1;

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Group specific
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers("");
  }, []);

  const fetchUsers = async (q: string) => {
    setLoading(true);
    try {
      const res = await searchUsers(q);
      setUsers(res);
    } catch (e) {
      setUsers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const pickGroupAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
    // @ts-ignore
    if (!res.canceled && Array.isArray((res as any).assets) && (res as any).assets.length > 0) {
      // @ts-ignore
      setGroupAvatar((res as any).assets[0].uri);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const startDirect = async (userId: string) => {
    setLoading(true);
    try {
      const resp = await createConversation({ type: "direct", participants: [userId] });
      if (resp?.success) {
        const id = resp.data?._id || resp.data?.id;
        if (id) router.replace({ pathname: "./chat", params: { id, name: resp.data?.name || "Chat" } });
        else router.replace("/(main)/home");
      }
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedIds.length === 0) return;
    setLoading(true);
    try {
      let avatarToSend: string | undefined = undefined;
      if (groupAvatar) {
        if (groupAvatar.startsWith("http://") || groupAvatar.startsWith("https://")) {
          avatarToSend = groupAvatar;
        } else {
          const up = await uploadFileToCloudinary({ uri: groupAvatar }, "chat_app");
          if (!up || !up.success) {
            Alert.alert("Upload failed", up?.msg || "Unable to upload group avatar");
            setLoading(false);
            return;
          }
          avatarToSend = up.data as string;
        }
      }

      const resp = await createConversation({
        type: "group",
        name: groupName.trim(),
        participants: selectedIds,
        avatar: avatarToSend,
      });
      if (resp?.success) {
        const id = resp.data?._id || resp.data?.id;
        if (id) router.replace({ pathname: "./chat", params: { id, name: resp.data?.name || groupName.trim() } });
        else router.replace("/(main)/home");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper showPattern={false} bgOpacity={0} isModal>
      <View style={styles.card}>
        <Typo size={20} fontWeight="800">{isGroup ? "New Group" : "Select User"}</Typo>

        {isGroup ? (
          <View>
            <Pressable onPress={pickGroupAvatar} style={styles.groupAvatarWrap}>
              {groupAvatar ? (
                <Image source={{ uri: groupAvatar }} style={styles.groupAvatar} />
              ) : (
                <Avatar uri={null} size={88} isGroup={true} />
              )}
            </Pressable>

            <Typo size={14} style={{ marginTop: 12 }}>Group name</Typo>
            <TextInput value={groupName} onChangeText={setGroupName} style={styles.input} placeholder="e.g. Family" />
          </View>
        ) : null}

        <Typo size={14} style={{ marginTop: 12 }}>{isGroup ? "Add people" : "Search people"}</Typo>
        <TextInput value={query} onChangeText={setQuery} style={styles.input} placeholder="Search by name or email" />

        <ScrollView style={{ marginTop: 12 }}>
          {loading ? (
            <ActivityIndicator />
          ) : (
            users.map((u) => (
              <Pressable key={u._id} onPress={() => (isGroup ? toggleSelect(u._id) : startDirect(u._id))} style={styles.userRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Avatar uri={u.avatar || null} size={48} />
                  <Typo size={16}>{u.name}</Typo>
                </View>

                {isGroup ? (
                  <View style={[styles.circle, selectedIds.includes(u._id) ? styles.circleSelected : null]} />
                ) : (
                  <Typo size={14} color={colors.neutral400}>Start</Typo>
                )}
              </Pressable>
            ))
          )}
        </ScrollView>

        <View style={{ marginTop: 16 }}>
          <Button onPress={() => (isGroup ? createGroup() : router.back())} style={{ padding: 14, borderRadius: 10 }} disabled={loading || (isGroup && (selectedIds.length === 0 || !groupName.trim()))}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Typo color={colors.white}>{isGroup ? "Create Group" : "Close"}</Typo>}
          </Button>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default NewConversationModal;

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.white, padding: 20 },
  input: { borderWidth: 1, borderColor: "#eee", padding: 12, borderRadius: 10, marginTop: 8 },
  userRow: { paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" },
  circle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.primary, marginRight: 8 },
  circleSelected: { backgroundColor: colors.primary },
  groupAvatarWrap: { alignSelf: "center", marginTop: 12 },
  groupAvatar: { width: 88, height: 88, borderRadius: 44 },
});
