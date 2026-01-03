import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, FlatList, Pressable, KeyboardAvoidingView, Platform, Image, ScrollView, Keyboard, Animated, Alert, Modal } from "react-native";
import RAnimated, { FadeInUp, FadeOut, Layout, SlideInDown, SlideOutDown, ZoomIn } from "react-native-reanimated";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Avatar from "@/components/Avatar";
import Input from "@/components/Input";
import { colors } from "@/constants/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { connectSocket } from "@/socket/socket";
import { useAuth } from "@/contexts/authContext";
import { MaterialIcons } from "@expo/vector-icons";
import moment from "moment";
import * as ImagePicker from "expo-image-picker";
import { uploadFileToCloudinary } from "@/services/imageService";
import { loadMessages, saveMessages } from "@/utils/storage";

type Message = {
  _id: string;
  senderId?: string;
  content?: string;
  attachment?: string;
  createdAt?: string;
  readBy?: string[];
};

const ChatScreen = () => {
  const params = useLocalSearchParams() as any;
  const router = useRouter();
  const conversationId = params?.id || params?.conversationId;
  const titleParam = params?.name || "Chat";

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const socketRef = useRef<any>(null);
  const keyboardAnim = useRef(new Animated.Value(12)).current;
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteSheet, setShowDeleteSheet] = useState<boolean>(false);
  const [lastDeletedMessages, setLastDeletedMessages] = useState<Message[]>([]);
  const lastDeletedRef = useRef<Message[]>([]);
  const [showUndo, setShowUndo] = useState<boolean>(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState<boolean>(false);
  const [forwardTargets, setForwardTargets] = useState<any[]>([]);

  const { user: currentUser } = useAuth();

  useEffect(() => {
    let mounted = true;
    // animate composer above keyboard
    const GAP = 12;
    const onShow = (e: any) => {
      const kbHeight = e?.endCoordinates?.height || 300;
      const toValue = kbHeight + GAP;
      Animated.spring(keyboardAnim, { toValue, useNativeDriver: false, damping: 20, stiffness: 150 }).start();
    };
    const onHide = () => {
      Animated.spring(keyboardAnim, { toValue: GAP, useNativeDriver: false, damping: 20, stiffness: 150 }).start();
    };

    const showSub = Keyboard.addListener("keyboardDidShow", onShow);
    const hideSub = Keyboard.addListener("keyboardDidHide", onHide);

    (async () => {
      try {
        const sock = await connectSocket();
        socketRef.current = sock;

        if (conversationId) {
          try {
            const cached = await loadMessages(conversationId);
            if (Array.isArray(cached) && cached.length > 0) setMessages(cached as any);
          } catch {}
          sock.emit("joinConversation", { conversationId }, (resp: any) => {
            if (!mounted) return;
            if (resp && resp.success) {
              setConversation(resp.conversation || null);
              setMessages(resp.messages || []);
              try { saveMessages(conversationId, resp.messages || []); } catch {}
              // Mark all messages as read for current user
              try {
                sock.emit("conversation:markRead", { conversationId }, () => {});
              } catch {}
            }
          });
        }

        const onNew = (msg: any) => {
          setMessages((s) => {
            const exists = s.find((m) => m._id === msg._id);
            if (exists) return s; 
            if ((msg as any).clientId) { 
              const idx = s.findIndex((m: any) => (m as any).clientId === (msg as any).clientId || m._id === (msg as any).clientId); 
              if (idx >= 0) { 
                const next = s.slice(); 
                next[idx] = msg; 
                try { if (conversationId) saveMessages(conversationId, next as any); } catch {} 
                return next; 
              } 
            } 
            const next = [...s, msg]; 
            try { if (conversationId) saveMessages(conversationId, next as any); } catch {} 
            return next; 
          });
        };

        sock.on("message:new", onNew);
        sock.on("typing", ({ userId }: any) => setTypingUsers((t) => Array.from(new Set([...t, userId]))));
        sock.on("stop_typing", ({ userId }: any) => setTypingUsers((t) => t.filter((x) => x !== userId)));
        sock.on("message:read", ({ messageId, userId }: any) => {
          setMessages((s) => s.map((m) => (m._id === messageId ? { ...m, readBy: [...(m.readBy || []), userId] } : m)));
        });
        sock.on("message:deleted", ({ conversationId: convId, messageIds, scope, userId }: any) => {
          if (!convId || convId !== conversationId) return;
          setMessages((s) => {
            if (scope === "me" && userId && (currentUser?.id || (currentUser as any)?._id)?.toString() === userId.toString()) {
              const next = s.filter((m) => !messageIds.includes(m._id));
              try { if (conversationId) saveMessages(conversationId, next as any); } catch {}
              return next;
            }
            if (scope === "everyone") {
              const next = s.map((m) => (messageIds.includes(m._id) ? { ...m, content: undefined, attachment: undefined, isDeleted: true } as any : m));
              try { if (conversationId) saveMessages(conversationId, next as any); } catch {}
              return next;
            }
            return s;
          });
        });
        sock.on("message:undeleted", ({ conversationId: convId, messageIds, userId }: any) => {
          if (!convId || convId !== conversationId) return;
          const myId = (currentUser as any)?.id || (currentUser as any)?._id;
          if (!userId || myId?.toString?.() !== userId?.toString?.()) return;
          // Re-add messages we have snapshots for
          setMessages((s) => {
            const toRestore = lastDeletedRef.current.filter((m) => messageIds.includes(m._id));
            const merged = [...s, ...toRestore];
            const next = merged.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
            try { if (conversationId) saveMessages(conversationId, next as any); } catch {}
            return next;
          });
          setShowUndo(false);
          setLastDeletedMessages([]);
          lastDeletedRef.current = [];
        });
      } catch (e) {
        console.warn("Socket connect error", e);
      }
    })();

    return () => {
      mounted = false;
      showSub.remove();
      hideSub.remove();
      const sock = socketRef.current;
      if (sock) {
        if (conversationId) sock.emit("leaveConversation", { conversationId });
        // Mark any remaining messages as read on exit
        try {
          if (conversationId) sock.emit("conversation:markRead", { conversationId }, () => {});
        } catch {}
        sock.off("message:new");
        sock.off("typing");
        sock.off("stop_typing");
        sock.off("message:read");
        sock.off("message:deleted");
        sock.off("message:undeleted");
      }
    };
  }, [conversationId]);
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const deleteSelected = (scope: "me" | "everyone" = "me") => {
    if (!socketRef.current || !conversationId || selectedIds.length === 0) return;
    const myId = (currentUser as any)?.id || (currentUser as any)?._id;
    if (scope === "everyone") {
      // ensure all selected are mine
      const allMine = messages.filter((m) => selectedIds.includes(m._id)).every((m) => (m as any).senderId?.toString?.() === myId?.toString?.());
      if (!allMine) {
        Alert.alert("Not allowed", "You can only delete your own messages for everyone.");
        return;
      }
      // enforce 2-minute limit client-side
      const withinLimit = messages
        .filter((m) => selectedIds.includes(m._id))
        .every((m) => {
          const ts = new Date(m.createdAt || 0).getTime();
          return Date.now() - ts <= 2 * 60 * 1000;
        });
      if (!withinLimit) {
        Alert.alert("Time limit exceeded", "You can delete for everyone only within 2 minutes of sending.");
        return;
      }
    }
    socketRef.current.emit("message:delete", { conversationId, messageIds: selectedIds, scope }, (res: any) => {
      if (!res || !res.success) {
        Alert.alert("Delete failed", "Couldn't delete messages. Please try again.");
        return;
      }
      if (scope === "me") {
        // snapshot for undo
        const snap = messages.filter((m) => selectedIds.includes(m._id));
        setLastDeletedMessages(snap);
        lastDeletedRef.current = snap;
        setMessages((s) => s.filter((m) => !selectedIds.includes(m._id)));
        setShowUndo(true);
      } else {
        setMessages((s) => s.map((m) => (selectedIds.includes(m._id) ? { ...m, content: undefined, attachment: undefined, isDeleted: true } as any : m)));
      }
      clearSelection();
    });
  };

  const startReply = () => {
    if (selectedIds.length !== 1) {
      Alert.alert("Select one", "Please select a single message to reply to.");
      return;
    }
    const msg = messages.find((m) => m._id === selectedIds[0]) || null;
    setReplyingTo(msg);
    setShowDeleteSheet(false);
    setSelectionMode(false);
  };

  const openForward = async () => {
    if (selectedIds.length === 0) {
      Alert.alert("Select message", "Select at least one message to forward.");
      return;
    }
    try {
      const res = await import('@/services/conversationService').then(m=>m.getMyConversations());
      const list = (res as any)?.data || [];
      setForwardTargets(list);
      setShowForwardModal(true);
    } catch (e) {
      console.warn('load forward targets', e);
    }
  };

  const forwardTo = async (targetId: string) => {
    try {
      const sock = socketRef.current;
      if (!sock) return;
      for (const mid of selectedIds) {
        await new Promise<void>((resolve) => {
          sock.emit('message:forward', { sourceMessageId: mid, targetConversationId: targetId }, (_res: any)=> resolve());
        });
      }
      setShowForwardModal(false);
      clearSelection();
      Alert.alert('Forwarded', 'Message forwarded');
    } catch (e) {
      console.warn('forward error', e);
      Alert.alert('Error', 'Could not forward');
    }
  };

  const confirmDelete = (scope: "me" | "everyone") => {
    Alert.alert(
      scope === "me" ? "Delete messages" : "Delete for everyone",
      scope === "me" ? "Delete selected messages from your view?" : "Delete selected messages for everyone? (within 2 minutes)",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteSelected(scope) },
      ]
    );
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      // allow multiple selection where supported
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true });
      // handle both new and legacy responses
      // @ts-ignore
      if (Array.isArray((res as any).assets) && (res as any).assets.length > 0) {
        // @ts-ignore
        const uris = (res as any).assets.map((a: any) => a.uri).filter(Boolean) as string[];
        if (uris.length > 0) setSelectedMedia((s) => [...s, ...uris]);
        return;
      }
      // fallback for older SDKs: single `uri` or `cancelled` flag
      // @ts-ignore
      if ((res as any).canceled) return;
      // @ts-ignore
      const single = (res as any).uri || (res as any).asset?.uri;
      if (single) setSelectedMedia((s) => [...s, single]);
    } catch (e) {
      console.warn("pickImage error", e);
    }
  };

  const send = async () => {
    if (!conversationId || !socketRef.current) return;

    // If there are selected images, upload each and send them sequentially.
    if (selectedMedia && selectedMedia.length > 0) {
      const captionText = text.trim();
        // clear the input and preview immediately
        setText("");
        const mediaToSend = selectedMedia.slice();
        setSelectedMedia([]);

        for (let i = 0; i < mediaToSend.length; i++) {
          const uri = mediaToSend[i];
        const clientId = `c_${Date.now()}_${i}`;

        // optimistic insert per image; attach caption only to first
          setMessages((s) => {
            const next = [
              ...s,
              { _id: clientId, clientId, attachment: uri, content: i === 0 ? captionText : "", senderId: currentUser?.id || (currentUser as any)?._id, createdAt: new Date().toISOString() } as any,
            ];
            try { if (conversationId) saveMessages(conversationId, next as any); } catch {}
            return next;
          });

        try {
          const up = await uploadFileToCloudinary({ uri }, "chat_app");
          const attachmentUrl = up && up.success ? (up.data as string) : uri;
          const payload = { conversationId, attachment: attachmentUrl, content: i === 0 ? captionText || undefined : undefined, clientId } as any;
          socketRef.current.emit("sendMessage", payload, () => {});
        } catch (e) {
          console.warn("send media failed", e);
        }
      }

      setSelectedMedia([]);
      return;
    }

    // normal text message
    if (!text.trim()) return;
    const clientId = `c_${Date.now()}`;
    const payload = { conversationId, content: text.trim(), clientId, replyTo: replyingTo?._id || null } as any;
    setText("");
    setReplyingTo(null);
    // optimistic insert for text
    setMessages((s) => {
      const next = [
        ...s,
        { _id: clientId, clientId, content: payload.content, senderId: currentUser?.id || (currentUser as any)?._id, createdAt: new Date().toISOString() } as any,
      ];
      try { if (conversationId) saveMessages(conversationId, next as any); } catch {}
      return next;
    });
    socketRef.current.emit("sendMessage", payload, () => {});
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMine = !!(currentUser && item.senderId && (currentUser.id === item.senderId || currentUser.id === (item as any).senderId));
    const showSender = conversation?.type === "group" && !isMine;
    const isDeleted = !!(item as any).isDeleted;
    const isSelected = selectedIds.includes(item._id);
    return (
      <RAnimated.View entering={FadeInUp.duration(200)} layout={Layout.springify()} exiting={FadeOut.duration(120)}>
      <Pressable
        style={[styles.messageRow, isMine ? styles.messageRight : styles.messageLeft]}
        onLongPress={() => {
          setSelectionMode(true);
          toggleSelect(item._id);
        }}
        onPress={() => {
          if (selectionMode) toggleSelect(item._id);
        }}
      >
        {!isMine && conversation?.type === "group" && <Avatar uri={(item as any).senderAvatar || null} size={36} />}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, isSelected && styles.bubbleSelected]}>
          {/* Reply preview */}
          {(item as any).replyPreview && (
            <View style={styles.replyPreview}>
              <Typo size={12} color={colors.neutral700} fontWeight="700">Reply to {(item as any).replyPreview?.senderName || ""}</Typo>
              {(item as any).replyPreview?.content ? (
                <Typo size={12} color={colors.neutral700}>{(item as any).replyPreview?.content}</Typo>
              ) : (item as any).replyPreview?.attachment ? (
                <Typo size={12} color={colors.neutral700}>Attachment</Typo>
              ) : null}
            </View>
          )}
          {selectionMode && (
            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
              {isSelected ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
            </View>
          )}
          {showSender && <Typo size={13} fontWeight="700">{(item as any).senderName || ""}</Typo>}
          {isDeleted ? (
            <Typo size={14} color={colors.neutral500}>
              Message deleted
            </Typo>
          ) : item.attachment ? (
            <>
              <Image source={{ uri: item.attachment }} style={{ width: 220, height: 220, borderRadius: 12 }} resizeMode="cover" />
              {item.content ? <Typo size={14} style={{ marginTop: 8 }}>{item.content}</Typo> : null}
            </>
          ) : (
            <Typo size={14}>{item.content}</Typo>
          )}
          {(item as any).forwardedFromUserName && (
            <Typo size={12} color={colors.neutral500} style={{ marginTop: 4 }}>Forwarded from {(item as any).forwardedFromUserName}</Typo>
          )}
          <Typo size={12} color={colors.neutral400} style={{ marginTop: 6 }}>{item.createdAt ? moment(item.createdAt).format("hh:mm A") : ""}</Typo>
        </View>
      </Pressable>
      </RAnimated.View>
    );
  };

  const headerName = (() => {
    if (!conversation) return titleParam;
    if (conversation?.type === "group") return conversation?.name || titleParam;
    // direct: pick other participant name if available
    const others = Array.isArray(conversation?.participants)
      ? conversation.participants.filter((p: any) => p && p._id && p._id.toString() !== (currentUser?.id || currentUser?._id))
      : [];
    return others[0]?.name || titleParam;
  })();

  const headerAvatar = (() => {
    if (!conversation) return null;
    if (conversation?.type === "group") return conversation?.avatar || null;
    const others = Array.isArray(conversation?.participants)
      ? conversation.participants.filter((p: any) => p && p._id && p._id.toString() !== (currentUser?.id || currentUser?._id))
      : [];
    return others[0]?.avatar || null;
  })();

  return (
    <ScreenWrapper showPattern={true} bgOpacity={0.5} isModal={false}>
      
        <View style={{ marginBottom: 8 }}>
          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <Pressable onPress={() => router.back()} style={styles.backPress}>
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </Pressable>
                <Pressable
                  style={styles.headerLeftInfo}
                  onPress={() => {
                    if (conversation?.type === "group" && conversation?._id) {
                      router.push(`/(main)/groupInfo?id=${conversation._id}`);
                    }
                  }}
                >
                  <View style={styles.headerAvatarWrap}>
                    <Avatar uri={headerAvatar} size={32} isGroup={conversation?.type === "group"} />
                  </View>
                  {!selectionMode ? (
                    <Typo size={18} fontWeight="700" color="#fff" style={{ marginLeft: 8 }}>{headerName}</Typo>
                  ) : (
                    <Typo size={18} fontWeight="700" color="#fff" style={{ marginLeft: 8 }}>{selectedIds.length} selected</Typo>
                  )}
                </Pressable>
            </View>
            {!selectionMode ? (
              <Pressable onPress={() => { /* future menu */ }} accessibilityRole="button" accessibilityLabel="More options">
                <MaterialIcons name="more-vert" size={24} color="#fff" />
              </Pressable>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Pressable onPress={() => setShowDeleteSheet(true)} style={styles.headerActionBtn} accessibilityRole="button" accessibilityLabel="Delete options">
                  <MaterialIcons name="delete-outline" size={22} color="#fff" />
                </Pressable>
                <Pressable onPress={clearSelection} style={[styles.headerActionBtn, { marginLeft: 8 }]}>
                  <MaterialIcons name="close" size={22} color="#fff" />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.contentArea}>
          <FlatList data={messages} keyExtractor={(i: any) => i._id || i.clientId} renderItem={renderItem} contentContainerStyle={{ padding: 20, paddingBottom: 16 }} style={{ flex: 1 }} />

          {typingUsers.length > 0 && (
            <View style={styles.typingRow}>
              <Typo size={13} color={colors.neutral600}>{typingUsers.join(", ")} typing...</Typo>
            </View>
          )}

          {/* preview moved into input area so it follows composer */}

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 80}>
            <View style={styles.inputContainer}>
              {selectedMedia && selectedMedia.length > 0 && (
                <View style={styles.previewWrap} pointerEvents="box-none">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 6 }}>
                    {selectedMedia.map((uri, idx) => (
                      <RAnimated.View entering={ZoomIn.duration(160)} key={uri} style={{ position: "relative", marginRight: 8 }}>
                        <Image source={{ uri }} style={styles.previewImage} />
                        <Pressable onPress={() => setSelectedMedia((s) => s.filter((x) => x !== uri))} style={styles.previewRemove}><Typo size={14} color="#fff">✕</Typo></Pressable>
                      </RAnimated.View>
                    ))}
                  </ScrollView>
                </View>
              )}
              <Animated.View style={[styles.inputWrap, { marginBottom: keyboardAnim }]}> 
                <Pressable style={styles.plusBtn} onPress={pickImage}>
                  <MaterialIcons name="add" size={24} color={colors.neutral700} />
                </Pressable>
                <Input
                  value={text}
                  onChangeText={(t) => setText(t)}
                  placeholder="Write a message"
                  multiline
                  containerStyle={{ flex: 1, marginRight: 8 }}
                  inputStyle={styles.input}
                />
                <Pressable style={styles.sendBtn} onPress={send}>
                  <MaterialIcons name="send" size={22} color="#fff" />
                </Pressable>
              </Animated.View>
            </View>
          </KeyboardAvoidingView>
          {showUndo && (
            <RAnimated.View entering={SlideInDown.duration(180)} exiting={SlideOutDown.duration(140)} style={styles.undoBar}>
              <Typo size={14} color={colors.neutral900}>Messages deleted</Typo>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Pressable onPress={() => {
                if (!socketRef.current || !conversationId || lastDeletedMessages.length === 0) { setShowUndo(false); return; }
                const ids = lastDeletedMessages.map((m) => m._id);
                socketRef.current.emit("message:undelete", { conversationId, messageIds: ids }, (res: any) => {
                  if (!res || !res.success) {
                    setShowUndo(false);
                    return;
                  }
                  // state restoration handled by message:undeleted
                });
              }} style={styles.undoBtn} accessibilityRole="button" accessibilityLabel="Undo delete">
                <Typo size={14} fontWeight="700" color={colors.primary}>UNDO</Typo>
              </Pressable>
              <Pressable onPress={() => setShowUndo(false)} style={styles.undoCloseBtn} accessibilityRole="button" accessibilityLabel="Dismiss undo">
                <MaterialIcons name="close" size={18} color={colors.neutral700} />
              </Pressable>
              </View>
            </RAnimated.View>
          )}
          {/* Delete action sheet */}
          <Modal visible={showDeleteSheet} transparent animationType="slide" onRequestClose={() => setShowDeleteSheet(false)}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setShowDeleteSheet(false)} />
            <View style={styles.sheet}>
              <Typo size={16} fontWeight="700" style={{ marginBottom: 6 }}>Actions</Typo>
              <Pressable style={styles.sheetItem} onPress={() => { setShowDeleteSheet(false); confirmDelete("me"); }} accessibilityRole="button" accessibilityLabel="Delete for me">
                <MaterialIcons name="person" size={18} color={colors.neutral800} />
                <Typo size={15} style={{ marginLeft: 10 }}>Delete for me</Typo>
              </Pressable>
              <Pressable style={styles.sheetItem} onPress={() => { setShowDeleteSheet(false); confirmDelete("everyone"); }} accessibilityRole="button" accessibilityLabel="Delete for everyone">
                <MaterialIcons name="group" size={18} color={colors.neutral800} />
                <Typo size={15} style={{ marginLeft: 10 }}>Delete for everyone</Typo>
              </Pressable>
              <Pressable style={styles.sheetItem} onPress={() => { startReply(); }} accessibilityRole="button" accessibilityLabel="Reply to message">
                <MaterialIcons name="reply" size={18} color={colors.neutral800} />
                <Typo size={15} style={{ marginLeft: 10 }}>Reply</Typo>
              </Pressable>
              <Pressable style={styles.sheetItem} onPress={() => { openForward(); }} accessibilityRole="button" accessibilityLabel="Forward message">
                <MaterialIcons name="forward" size={18} color={colors.neutral800} />
                <Typo size={15} style={{ marginLeft: 10 }}>Forward</Typo>
              </Pressable>
              <Pressable style={[styles.sheetItem, { justifyContent: "center" }]} onPress={() => setShowDeleteSheet(false)} accessibilityRole="button" accessibilityLabel="Cancel">
                <Typo size={15} color={colors.neutral700}>Cancel</Typo>
              </Pressable>
            </View>
          </Modal>

          {/* Forward modal */}
          <Modal visible={showForwardModal} transparent animationType="slide" onRequestClose={() => setShowForwardModal(false)}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setShowForwardModal(false)} />
            <View style={styles.sheet}>
              <Typo size={16} fontWeight="700" style={{ marginBottom: 6 }}>Forward to</Typo>
              <FlatList data={forwardTargets} keyExtractor={(i:any)=>i._id} renderItem={({item})=> (
                <Pressable style={styles.sheetItem} onPress={()=>forwardTo(item._id)}>
                  <Avatar uri={item.avatar} size={32} />
                  <Typo size={15} style={{ marginLeft: 10 }}>{item.name}</Typo>
                </Pressable>
              )} />
              <Pressable style={[styles.sheetItem, { justifyContent: "center" }]} onPress={() => setShowForwardModal(false)}>
                <Typo size={15} color={colors.neutral700}>Close</Typo>
              </Pressable>
            </View>
          </Modal>
        </View>
     
    </ScreenWrapper>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  headerWrap: { backgroundColor: "#0b1320", paddingTop: 4, paddingBottom: 8 },
  headerInner: { paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerLeftInfo: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
  backPress: { marginRight: 8 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12 },
  messageLeft: { justifyContent: "flex-start" },
  messageRight: { justifyContent: "flex-end", alignSelf: "flex-end" },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 20 },
  bubbleMine: { backgroundColor: "rgba(255,214,201,0.35)", borderTopRightRadius: 20, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "rgba(255,241,184,0.35)", borderTopLeftRadius: 20, borderBottomLeftRadius: 4 },
  bubbleSelected: { borderWidth: 2, borderColor: colors.primary },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "transparent" },
  inputWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 3, paddingVertical: 3, backgroundColor: "transparent", borderRadius: 999, marginHorizontal: 0, shadowColor: "#00000037", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  plusBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.neutral100, alignItems: "center", justifyContent: "center", marginRight: 8 },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  sendBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  typingRow: { paddingHorizontal: 20, paddingBottom: 8 },
  previewWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 8,
    backgroundColor: "transparent",
  },
  previewImage: { width: 120, height: 96, borderRadius: 12, marginBottom: 0, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  contentArea: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  inputContainer: { backgroundColor: "transparent", paddingBottom: 8, paddingHorizontal: 6 },
  
  headerAvatarWrap: { width: 36, height: 36, borderRadius: 20, backgroundColor: '#ffffffff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  captionInput: { width: "90%", borderRadius: 12, padding: 10, backgroundColor: colors.neutral100 },
  previewRemove: { position: "absolute", right: 6, top: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.neutral500, alignItems: "center", justifyContent: "center", marginBottom: 6, backgroundColor: "transparent" },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  headerActionBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff20" },
  undoBar: { position: "absolute", left: 20, right: 20, bottom: 100, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  undoBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  undoCloseBtn: { marginLeft: 8, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.06)" },
  sheetBackdrop: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.backgroundCard || "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  sheetItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  replyPreview: { padding: 8, borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: colors.neutral100, borderRadius: 8, marginBottom: 8 },
});
