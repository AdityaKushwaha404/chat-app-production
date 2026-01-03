import React, { useEffect, useState } from "react";
import { View, StyleSheet, FlatList, TextInput, Pressable, Alert } from "react-native";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import * as ImagePicker from 'expo-image-picker';
import { uploadFileToCloudinary } from '@/services/imageService';
import { useLocalSearchParams, useRouter } from "expo-router";
import { getConversation, addConversationMembers, updateConversation } from "@/services/conversationService";
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await getConversation(id);
        if (res && res.success) {
          if (!mounted) return;
          setConv(res.data);
          setNameDraft(res.data?.name || "");
        }
      } catch (e) {
        console.warn("getConversation failed", e);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const onAdd = async () => {
    if (!email.trim()) return Alert.alert("Enter email", "Please type an email to add");
    setAdding(true);
    try {
      const res = await addConversationMembers(id, { emails: [email.trim().toLowerCase()] });
      if (res && res.success) {
        setConv(res.data);
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
      const res = await updateConversation(id, { name: nameDraft.trim() });
      if (res && res.success) {
        setConv(res.data);
        setEditingName(false);
      } else {
        Alert.alert("Failed", res?.msg || "Could not update group");
      }
    } catch (e) {
      console.warn("update group name", e);
      Alert.alert("Error", "Could not update group");
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
      const r = await updateConversation(id, { avatar: avatarUrl });
      if (r && r.success) {
        setConv(r.data);
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

  return (
    <ScreenWrapper showPattern={true} bgOpacity={0.3}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>{/* back handled by wrapper */}</Pressable>
        <Typo size={20} fontWeight="700">Group Info</Typo>
      </View>

      <View style={styles.container}>
        <View style={styles.groupHeader}>
          <Avatar uri={conv?.avatar || null} size={84} />
          {isCreator || isAdmin ? (
            <Pressable onPress={onChangeAvatar} style={{ marginLeft: 12 }}><Typo size={14} color={colors.primary}>Change Avatar</Typo></Pressable>
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
              <Typo size={18} fontWeight="700">{conv?.name || "Group"}</Typo>
              <Typo size={13} color={colors.neutral600}>{(conv?.participants || []).length} members</Typo>
              {(isCreator || isAdmin) ? (
                <Pressable onPress={() => setEditingName(true)} style={{ marginTop: 8 }}><Typo size={14} color={colors.primary}>Edit Group</Typo></Pressable>
              ) : null}
            </View>
          )}
        </View>

        <View style={{ marginTop: 18 }}>
          <Typo size={16} fontWeight="700">Members</Typo>
          <FlatList data={conv?.participants || []} keyExtractor={(i: any) => i._id || i} renderItem={({ item }) => (
            <View style={styles.memberRow}>
              <Avatar uri={item?.avatar || null} size={44} />
              <View style={{ marginLeft: 12 }}>
                <Typo size={15} fontWeight="700">{item?.name || item?.email || "User"}</Typo>
                <Typo size={13} color={colors.neutral600}>{item?.email || ""}</Typo>
              </View>
            </View>
          )} style={{ marginTop: 12 }} />
        </View>

        {isCreator ? (
          <View style={{ marginTop: 18 }}>
            <Typo size={15} fontWeight="700">Add member by email</Typo>
            <TextInput value={email} onChangeText={setEmail} style={styles.addInput} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Button onPress={onAdd} style={{ marginTop: 10 }}>
              <Typo size={15} fontWeight="700">Add</Typo>
            </Button>
          </View>
        ) : null}
      </View>
    </ScreenWrapper>
  );
};

export default GroupInfo;

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center" },
  container: { padding: 16 },
  groupHeader: { flexDirection: "row", alignItems: "center" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  addInput: { marginTop: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#eee" },
  nameInput: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#eee" },
});
