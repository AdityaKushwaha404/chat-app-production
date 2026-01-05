import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Alert, TouchableOpacity, Animated, ScrollView, Modal, Pressable } from "react-native";
import RAnimated, { FadeInDown, FadeIn, FadeOut, ZoomIn, ZoomOut, Layout } from "react-native-reanimated";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { colors } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
// UI-only home screen — no buttons here
import { useRouter, useFocusEffect } from "expo-router";
import ConversationItem from "@/components/ConversationItem";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { verticalScale } from "@/utils/styling";
import { MaterialIcons } from "@expo/vector-icons";
import { getMyConversations } from "@/services/conversationService";
import { Image } from "expo-image";
import { connectSocket, getSocket } from "@/socket/socket";
import { loadConversations, saveConversations } from "@/utils/storage";

const Home = () => {
  const { user: currentUser, signOut } = useAuth();
  const router = useRouter();

  const cardAnim = useRef(new Animated.Value(0)).current;
  // tabIndex: 0 = All, 1 = Direct, 2 = Group
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [plusMenuOpen, setPlusMenuOpen] = useState<boolean>(false);
  const [avatarPreview, setAvatarPreview] = useState<{ uri: string; name: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { connectSocket } = await import("@/socket/socket");
        await connectSocket();
      } catch (e) {
        console.warn("Socket connect error", e);
      }
    })();

    Animated.timing(cardAnim, { toValue: 1, duration: 420, useNativeDriver: true }).start();

    return () => {
      mounted = false;
    };
  }, []);

  const [loading, setLoading] = useState<boolean>(false);
  const [conversations, setConversations] = useState<any[]>([]);

  const fetchConversations = async () => {
    // guard against overlapping fetches
    if (loading) return;
    try{
      setLoading(true);
      const res = await getMyConversations();
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setConversations(list);
      saveConversations(list);
      // Subscribe to conversation rooms for realtime badge updates
      try {
        const sock = await connectSocket();
        list.forEach((c: any) => {
          if (c && c._id) sock.emit("conversation:subscribe", { conversationId: c._id });
        });
        // listen for new messages to bump unread count
        const currentUserId = (currentUser as any)?.id || (currentUser as any)?._id;
        sock.off("message:new");
        sock.on("message:new", (msg: any) => {
          const convId = msg?.conversationId?.toString?.() || msg?.conversationId;
          if (!convId) return;
          setConversations((prev) => {
            const next = prev.map((c: any) => {
              if ((c._id || c.id) === convId) {
                const fromMe = msg?.senderId && currentUserId && msg.senderId.toString() === currentUserId.toString();
                const nextUnread = fromMe ? (c.unreadCount || 0) : (c.unreadCount || 0) + 1;
                const last = {
                  content: msg?.content || (msg?.attachment ? "Photo" : c?.lastMessage?.content || ""),
                  createdAt: msg?.createdAt || new Date().toISOString(),
                };
                return { ...c, unreadCount: nextUnread, lastMessage: last };
              }
              return c;
            });
            saveConversations(next);
            return next;
          });
        });
        // listen for mark-read to clear unread
        sock.off("conversation:read");
        sock.on("conversation:read", (payload: any) => {
          const convId = payload?.conversationId?.toString?.() || payload?.conversationId;
          if (!convId) return;
          setConversations((prev) => {
            const next = prev.map((c: any) => ((c._id || c.id) === convId ? { ...c, unreadCount: 0 } : c));
            saveConversations(next);
            return next;
          });
        });
      } catch {}
    }catch(e){
      console.warn('Failed to fetch conversations', e);
    }finally{
      setLoading(false);
    }
  };

  // Avoid double fetch on initial mount; rely on useFocusEffect below

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const cached = await loadConversations();
        if (Array.isArray(cached) && cached.length > 0) {
          setConversations(cached);
        }
        fetchConversations();
      })();
      return () => {
        try {
          const sock = getSocket();
          if (sock) {
            sock.off("message:new");
            sock.off("conversation:read");
          }
        } catch {}
      };
    }, [loading])
  );

  // be defensive: normalize type to lower-case so 'Group'/'GROUP' also match
  let directConversations = conversations.filter((item: any) => (item.type || "").toString().toLowerCase() === "direct");
  let groupConversations = conversations.filter((item: any) => (item.type || "").toString().toLowerCase() === "group");

  // debug: log counts and distinct types when conversations update
  useEffect(() => {
    try {
      const types = Array.from(new Set(conversations.map((c: any) => ((c.type || "").toString()))));
      console.log("[Home] conversations:", conversations.length, "types:", types, "direct:", directConversations.length, "group:", groupConversations.length);
    } catch (e) {
      // ignore
    }
  }, [conversations]);

  const filteredAll = conversations.filter((c: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (c.name || "").toLowerCase().includes(q) || (c.lastMessageText || "").toLowerCase().includes(q);
  });

  const filteredDirect = directConversations.filter((c: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (c.name || "").toLowerCase().includes(q) || (c.lastMessageText || "").toLowerCase().includes(q);
  });

  const filteredGroup = groupConversations.filter((c: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (c.name || "").toLowerCase().includes(q) || (c.lastMessageText || "").toLowerCase().includes(q);
  });

  return (
    <ScreenWrapper showPattern={true} bgOpacity={0.5}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.searchWrap}>
            <Input
              icon={<MaterialIcons name="search" size={20} color={colors.neutral400} />}
              placeholder="Search chats, people, or groups"
              value={searchQuery}
              onChangeText={setSearchQuery}
              containerStyle={styles.searchInput}
              inputStyle={styles.searchInputText}
            />
          </View>

          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={() => router.push("/profileModel")}
            accessibilityLabel="Open profile"
          >
            <MaterialIcons name="menu" size={26} color={colors.neutral100} opacity={0.7} />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.card, { opacity: cardAnim, transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}> 
          <View style={styles.navBar}>
            <View style={styles.tabs}>
              <TouchableOpacity onPress={() => setSelectedTab(0)} style={[styles.tabStyle, selectedTab == 0 && styles.activeTabStyle]}>
                <Typo size={15} fontWeight={selectedTab == 0 ? "700" : "500"} color={selectedTab == 0 ? colors.black : colors.neutral800}>All</Typo>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setSelectedTab(1)} style={[styles.tabStyle, selectedTab == 1 && styles.activeTabStyle, { marginLeft: 12 }]}>
                <Typo size={15} fontWeight={selectedTab == 1 ? "700" : "500"} color={selectedTab == 1 ? colors.black : colors.neutral800}>Direct Messages</Typo>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setSelectedTab(2)} style={[styles.tabStyle, selectedTab == 2 && styles.activeTabStyle, { marginLeft: 12 }]}>
                <Typo size={15} fontWeight={selectedTab == 2 ? "700" : "500"} color={selectedTab == 2 ? colors.black : colors.neutral800}>Groups</Typo>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
            <View style={styles.conversationList}>
              {selectedTab == 0 && filteredAll.map((item: any, index: number) => (
                <ConversationItem
                  item={item}
                  key={item?._id || index}
                  onAvatarPress={() => setAvatarPreview({ uri: item.avatar || "", name: item.name || "" })}
                  onPress={() => {
                    router.push({ pathname: "/(main)/chat", params: { id: item._id, name: item.name } });
                  }}
                />
              ))}

              {selectedTab == 1 && filteredDirect.map((item: any, index: number) => (
                <ConversationItem
                  item={item}
                  key={item?._id || index}
                  onAvatarPress={() => setAvatarPreview({ uri: item.avatar || "", name: item.name || "" })}
                  onPress={() => {
                    router.push({ pathname: "/(main)/chat", params: { id: item._id, name: item.name } });
                  }}
                />
              ))}

              {selectedTab == 2 && filteredGroup.map((item: any, index: number) => (
                <ConversationItem
                  item={item}
                  key={item?._id || index}
                  onAvatarPress={() => setAvatarPreview({ uri: item.avatar || "", name: item.name || "" })}
                  onPress={() => {
                    router.push({ pathname: "/(main)/chat", params: { id: item._id, name: item.name } });
                  }}
                />
              ))}

              {selectedTab == 0 && conversations.length == 0 && !loading && (
                <Typo style={{ textAlign: "center" }}>You don't have any messages</Typo>
              )}

              {selectedTab == 1 && directConversations.length == 0 && !loading && (
                <Typo style={{ textAlign: "center" }}>You don't have any messages</Typo>
              )}

              {selectedTab == 2 && groupConversations.length == 0 && !loading && (
                <Typo style={{ textAlign: "center" }}>You haven't joined any groups yet</Typo>
              )}
              {loading && (
                <Typo style={{ textAlign: "center" }}>Loading conversations…</Typo>
              )}
            </View>
          </ScrollView>

          <View style={{ position: "absolute", right: 20, bottom: 24 }}>
            <Button
              style={styles.floatingButton}
              onPress={() => setPlusMenuOpen(true)}
            >
              <MaterialIcons name="add" color={colors.black} size={verticalScale(24)} />
            </Button>

            {plusMenuOpen && (
              <TouchableOpacity style={styles.plusOverlay} activeOpacity={1} onPress={() => setPlusMenuOpen(false)}>
                <RAnimated.View
                  entering={FadeInDown.duration(180)}
                  exiting={FadeOut.duration(140)}
                  style={styles.plusMenu}
                >
                  <TouchableOpacity
                    style={styles.plusMenuItem}
                    onPress={() => {
                      setPlusMenuOpen(false);
                      router.push({ pathname: "/(main)/newConversationModal", params: { isGroup: 0 } });
                    }}
                  >
                    <MaterialIcons name="person-add" size={18} color={colors.primary} />
                    <Typo style={styles.plusMenuLabel}>New Contact</Typo>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.plusMenuItem}
                    onPress={() => {
                      setPlusMenuOpen(false);
                      router.push({ pathname: "/(main)/newConversationModal", params: { isGroup: 1 } });
                    }}
                  >
                    <MaterialIcons name="group-add" size={18} color={colors.primary} />
                    <Typo style={styles.plusMenuLabel}>Create Group</Typo>
                  </TouchableOpacity>
                </RAnimated.View>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Avatar Preview Modal */}
        <Modal visible={!!avatarPreview} transparent animationType="fade" onRequestClose={() => setAvatarPreview(null)}>
          <View style={styles.viewerOverlay}>
            {/* tap outside to close */}
            <Pressable style={styles.viewerBackdrop} onPress={() => setAvatarPreview(null)} />
            <RAnimated.View entering={ZoomIn.duration(180)} exiting={ZoomOut.duration(140)} style={styles.viewerBox}>
              <View style={styles.viewerHeader}>
                <Typo size={16} fontWeight="700" style={{ color: colors.black }}>{avatarPreview?.name || "Profile"}</Typo>
                <TouchableOpacity onPress={() => setAvatarPreview(null)} style={styles.viewerCloseBtn}>
                  <MaterialIcons name="close" size={18} color={colors.black} />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                {avatarPreview?.uri ? (
                  <Image source={{ uri: avatarPreview.uri }} style={styles.viewerImage} contentFit="cover" />
                ) : (
                  <View style={[styles.viewerImage, { alignItems: "center", justifyContent: "center", backgroundColor: colors.neutral100 }]}>
                    <MaterialIcons name="person" size={64} color={colors.neutral500} />
                  </View>
                )}
              </View>
            </RAnimated.View>
          </View>
        </Modal>
      </View>
    </ScreenWrapper>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 0,
    marginBottom: 12,
  },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 84,
    bottom: 0,
    backgroundColor: colors.backgroundCard || "#fff",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingTop: 12,
    // create large inset look
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  navBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  searchWrap: {
    flex: 1,
    marginRight: 12,
  },
  searchInput: {
    height: verticalScale(46),
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  searchInputText: {
    color: colors.neutral100,
  },
  hamburgerBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  plusOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  plusMenu: {
    position: "absolute",
    right: 20,
    bottom: 96,
    backgroundColor: colors.backgroundCard || "#fff",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    width: 180,
    alignItems: "flex-start",
  },
  plusMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    width: "100%",
  },
  plusMenuLabel: {
    marginLeft: 12,
    color: colors.neutral900 || colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabStyle: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  activeTabStyle: {
    backgroundColor: colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  floatingButton: {
    width: verticalScale(56),
    height: verticalScale(56),
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  viewerBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  viewerBox: {
    width: "100%",
    maxWidth: 520,
    height: 520,
    borderRadius: 16,
    backgroundColor: colors.backgroundCard || "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 2,
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  viewerImage: {
    width: "90%",
    height: "80%",
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  viewerCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
});
