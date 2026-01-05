import React, { useEffect, useState } from "react";
import { View, StyleSheet, FlatList, TextInput, Pressable, Alert } from "react-native";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import * as ImagePicker from 'expo-image-picker';
import { uploadFileToCloudinary } from '@/services/imageService';
import { useLocalSearchParams, useRouter } from "expo-router";
import { getConversation } from "@/services/conversationService";
import * as groups from "@/services/groupService";
import { connectSocket, getSocket } from "@/socket/socket";
import { useAuth } from "@/contexts/authContext";
import { colors } from "@/constants/theme";

const GroupInfo = () => {
  const params = useLocalSearchParams() as any;
  const id = params?.id || params?.conversationId;
  const router = useRouter();
  const { user } = useAuth();

  const [conv, setConv] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [onlyAdminCanSend, setOnlyAdminCanSend] = useState<boolean>(false);
  const [onlyAdminCanEdit, setOnlyAdminCanEdit] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        // Prefer group endpoint for richer details
        let data: any = null;
        try {
          const g = await groups.getGroup(id);
          data = (g as any)?.data || g;
        } catch {}
        if (!data) {
          const res = await getConversation(id);
          data = (res as any)?.data || res;
        }
        if (data) {
          if (!mounted) return;
          setConv(data);
          setNameDraft(data?.name || "");
          setDescDraft(data?.description || "");
          setOnlyAdminCanSend(!!data?.settings?.onlyAdminCanSend);
          setOnlyAdminCanEdit(!!data?.settings?.onlyAdminCanEdit);
        }
      } catch (e) {
        console.warn("load group info failed", e);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Socket: subscribe to conversation updates and refresh UI
  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        if (!id) return;
        await connectSocket();
        const socket = getSocket();
        if (!socket) return;
        socket.emit("conversation:subscribe", { conversationId: id });

        const handlerRefresh = async () => {
          try {
            const g = await groups.getGroup(id);
            const data = (g as any)?.data || g;
            if (data) {
              setConv(data);
              setOnlyAdminCanSend(!!data?.settings?.onlyAdminCanSend);
              setOnlyAdminCanEdit(!!data?.settings?.onlyAdminCanEdit);
            }
          } catch (e) {}
        };

        const onAdded = (payload: any) => {
          if (payload?.conversationId?.toString() === id?.toString()) handlerRefresh();
        };
        const onRemoved = (payload: any) => {
          if (payload?.conversationId?.toString() === id?.toString()) handlerRefresh();
        };
        const onUpdated = (payload: any) => {
          if (payload?.conversationId?.toString() === id?.toString()) {
            const data = payload?.conversation;
            if (data) {
              setConv(data);
              setOnlyAdminCanSend(!!data?.settings?.onlyAdminCanSend);
              setOnlyAdminCanEdit(!!data?.settings?.onlyAdminCanEdit);
            } else {
              handlerRefresh();
            }
          }
        };
        const onSettingsUpdated = onUpdated;

        socket.on("conversation:members:added", onAdded);
        socket.on("conversation:members:removed", onRemoved);
        socket.on("conversation:updated", onUpdated);
        socket.on("conversation:settings:updated", onSettingsUpdated);

        unsub = () => {
          try {
            socket.off("conversation:members:added", onAdded);
            socket.off("conversation:members:removed", onRemoved);
            socket.off("conversation:updated", onUpdated);
            socket.off("conversation:settings:updated", onSettingsUpdated);
            socket.emit("conversation:unsubscribe", { conversationId: id });
          } catch {}
        };
      } catch (e) {
        // socket not available
      }
    })();
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [id]);

  const onAdd = async () => {
    if (!email.trim()) return Alert.alert("Enter email", "Please type an email to add");
    setAdding(true);
    try {
      const res = await groups.addMembers(id, { emails: [email.trim().toLowerCase()] });
      const data = (res as any)?.data || res;
      if (data) {
        setConv(data);
        setEmail("");
        Alert.alert("Added", "Member added to group");
      } else {
        Alert.alert("Failed", res?.msg || "Could not add member");
      }
    } catch (e) {
      console.warn("add member error", e);
      Alert.alert("Error", "Could not add member");
    } finally {
      setAdding(false);
    }
  };

  const onSaveName = async () => {
    if (!nameDraft || nameDraft.trim().length === 0) return Alert.alert("Invalid name", "Group name cannot be empty");
    try {
      const res = await groups.updateGroup(id, { name: nameDraft.trim() });
      const data = (res as any)?.data || res;
      if (data) {
        setConv(data);
        setEditingName(false);
      } else {
        Alert.alert("Failed", res?.msg || "Could not update group");
      }
    } catch (e) {
      console.warn("update group name", e);
      Alert.alert("Error", "Could not update group");
    }
  };

  const onSaveDesc = async () => {
    try {
      const res = await groups.updateGroup(id, { description: descDraft.trim() });
      const data = (res as any)?.data || res;
      if (data) {
        setConv(data);
        setEditingDesc(false);
      } else {
        Alert.alert("Failed", (res as any)?.msg || "Could not update description");
      }
    } catch (e) {
      console.warn("update group desc", e);
      Alert.alert("Error", "Could not update description");
    }
  };

  const onChangeAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      // @ts-ignore
      if ((res as any).canceled) return;
      // @ts-ignore
      const uri = (res as any).assets?.[0]?.uri || (res as any).uri;
      if (!uri) return;
      const up = await uploadFileToCloudinary({ uri }, 'chat_app_group');
      const avatarUrl = up && up.success ? (up.data as string) : uri;
      const r = await groups.updateGroup(id, { photo: avatarUrl });
      const data = (r as any)?.data || r;
      if (data) {
        setConv(data);
        Alert.alert('Updated', 'Group avatar updated');
      } else {
        Alert.alert('Failed', r?.msg || 'Could not update avatar');
      }
    } catch (e) {
      console.warn('change avatar error', e);
      Alert.alert('Error', 'Could not change avatar');
    }
  };

  const creatorId = conv?.createdBy?._id || conv?.createdBy;
  const userId = (user as any)?.id || (user as any)?._id;
  const isCreator = !!(creatorId && userId && creatorId.toString() === userId.toString());
  const isAdmin = Array.isArray(conv?.admins) && userId ? (conv.admins as any[]).map((x:any)=> (x?._id||x).toString()).includes(userId.toString()) : false;
  const onlyAdminsCanEdit = !!conv?.settings?.onlyAdminCanEdit;
  const canEdit = !onlyAdminsCanEdit ? true : (isCreator || isAdmin);

  const onSaveSettings = async () => {
    try {
      const res = await groups.updateSettings(id, { onlyAdminCanSend, onlyAdminCanEdit });
      const data = (res as any)?.data || res;
      if (!data) return Alert.alert('Failed', (res as any)?.msg || 'Could not update settings');
      Alert.alert('Saved', 'Settings updated');
    } catch (e) {
      Alert.alert('Error', 'Could not update settings');
    }
  };

  const onRemoveMember = async (memberId: string) => {
    try {
      const r = await groups.removeMembers(id, { members: [memberId] });
      const data = (r as any)?.data || r;
      if (data) setConv(data);
    } catch {}
  };

  const onLeave = async () => {
    try {
      const r = await groups.leave(id);
      const ok = (r as any)?.success === true || !!r;
      if (ok) {
        Alert.alert('Left group', 'You left the group');
        router.back();
      }
    } catch (e) {
      Alert.alert('Error', 'Could not leave group');
    }
  };

  return (
    <ScreenWrapper showPattern={true} bgOpacity={0.5}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>{/* back handled by wrapper */}</Pressable>
        <Typo size={20} fontWeight="700" color="#fff">Group Info</Typo>
      </View>

      <View style={styles.container}>
        <View style={styles.groupHeader}>
          <Avatar uri={conv?.avatar || null} size={84} />
          {canEdit ? (
            <Pressable onPress={onChangeAvatar} style={{ marginLeft: 12 }}><Typo size={14} color="#fff">Change Avatar</Typo></Pressable>
          ) : null}
          {editingName ? (
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TextInput value={nameDraft} onChangeText={setNameDraft} style={styles.nameInput} placeholder="Group name" />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Button onPress={onSaveName}><Typo size={15} fontWeight="700">Save</Typo></Button>
                <Button onPress={() => { setEditingName(false); setNameDraft(conv?.name || ""); }}><Typo size={15}>Cancel</Typo></Button>
              </View>
            </View>
          ) : (
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Typo size={18} fontWeight="700" color="#fff">{conv?.name || "Group"}</Typo>
              <Typo size={13} color="rgba(255,255,255,0.7)">{(conv?.participants || []).length} members</Typo>
              {canEdit ? (
                <Pressable onPress={() => setEditingName(true)} style={{ marginTop: 8 }}><Typo size={14} color="#fff">Edit Group</Typo></Pressable>
              ) : null}
            </View>
          )}
        </View>

        <View style={{ marginTop: 18 }}>
          <Typo size={16} fontWeight="700" color="#fff">Members</Typo>
          <FlatList data={conv?.participants || []} keyExtractor={(i: any) => i._id || i} renderItem={({ item }) => (
            <View style={styles.memberRow}>
              <Avatar uri={item?.avatar || null} size={44} />
              <View style={{ marginLeft: 12 }}>
                <Typo size={15} fontWeight="700" color="rgba(255,255,255,0.9)">{item?.name || item?.email || "User"}</Typo>
                <Typo size={13} color="rgba(255,255,255,0.7)">{item?.email || ""}</Typo>
              </View>
              {canEdit && (item?._id && item?._id !== userId) ? (
                <Pressable onPress={() => onRemoveMember(item._id)} style={{ marginLeft: 'auto', padding: 8 }}>
                  <Typo size={13} color="#fff">Remove</Typo>
                </Pressable>
              ) : null}
              {/* Admin tag */}
              {(() => {
                const isItemAdmin = Array.isArray(conv?.admins)
                  ? (conv.admins as any[]).map((x:any)=> (x?._id||x).toString()).includes((item?._id||'').toString())
                  : false;
                const isItemOwner = creatorId && item?._id && creatorId.toString() === item._id.toString();
                if (isItemOwner || isItemAdmin) {
                  return (
                    <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                      <Typo size={12} color="#fff">{isItemOwner ? 'Owner' : 'Admin'}</Typo>
                    </View>
                  );
                }
                return null;
              })()}
            </View>
          )} style={{ marginTop: 12 }} />
        </View>

        {canEdit ? (
          <View style={{ marginTop: 18 }}>
            <Typo size={15} fontWeight="700" color="#fff">Add member by email</Typo>
            <TextInput value={email} onChangeText={setEmail} style={styles.addInput} placeholder="email@example.com" placeholderTextColor="rgba(255,255,255,0.6)" keyboardType="email-address" autoCapitalize="none" />
            <Button onPress={onAdd} style={{ marginTop: 10 }}>
              <Typo size={15} fontWeight="700" color="#fff">Add</Typo>
            </Button>
          </View>
        ) : null}

        <View style={{ marginTop: 18 }}>
          <Typo size={16} fontWeight="700" color="#fff">Description</Typo>
          {editingDesc ? (
            <View style={{ marginTop: 8 }}>
              <TextInput
                value={descDraft}
                onChangeText={setDescDraft}
                style={[styles.nameInput, { minHeight: 80 }]}
                placeholder="Describe the group"
                multiline
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Button onPress={onSaveDesc}><Typo size={15} fontWeight="700">Save</Typo></Button>
                <Button onPress={() => { setEditingDesc(false); setDescDraft(conv?.description || ""); }}><Typo size={15}>Cancel</Typo></Button>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              <Typo size={14} color="rgba(255,255,255,0.8)">{conv?.description || "No description"}</Typo>
              {(isCreator || isAdmin) ? (
                <Pressable onPress={() => setEditingDesc(true)} style={{ marginTop: 8 }}>
                  <Typo size={14} color="#fff">Edit Description</Typo>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        {(isCreator || isAdmin) && (
          <View style={{ marginTop: 18 }}>
            <Typo size={16} fontWeight="700" color="#fff">Settings</Typo>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Typo style={{ flex: 1 }} color="#fff">Only admins can send</Typo>
              <Pressable onPress={() => setOnlyAdminCanSend(!onlyAdminCanSend)} style={{ padding: 8 }}>
                <Typo color="#fff">{onlyAdminCanSend ? 'ON' : 'OFF'}</Typo>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Typo style={{ flex: 1 }} color="#fff">Only admins can edit</Typo>
              <Pressable onPress={() => setOnlyAdminCanEdit(!onlyAdminCanEdit)} style={{ padding: 8 }}>
                <Typo color="#fff">{onlyAdminCanEdit ? 'ON' : 'OFF'}</Typo>
              </Pressable>
            </View>
            <Button onPress={onSaveSettings} style={{ marginTop: 10 }}>
              <Typo size={15} fontWeight="700" color="#fff">Save Settings</Typo>
            </Button>
          </View>
        )}

        <View style={{ marginTop: 24 }}>
          <Button onPress={onLeave}>
            <Typo size={15} fontWeight="700" color="#fff">Leave Group</Typo>
          </Button>
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default GroupInfo;

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center" },
  container: { padding: 16 },
  groupHeader: { flexDirection: "row", alignItems: "center" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  addInput: { marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", color: "#fff", backgroundColor: "rgba(255,255,255,0.08)" },
  nameInput: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", color: "#fff", backgroundColor: "rgba(255,255,255,0.08)" },
});
