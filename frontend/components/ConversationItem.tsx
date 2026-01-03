import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import Animated, { FadeInUp, FadeOut, Layout, ZoomIn, ZoomOut } from "react-native-reanimated";
import moment from "moment";
import Typo from "@/components/Typo";
import { TextStyle } from "react-native";
import Avatar from "@/components/Avatar";
import { spacingX, spacingY } from "@/constants/theme";
import { colors } from "@/constants/theme";

type Conversation = {
  _id: string;
  name: string;
  type: "direct" | "group";
  avatar?: string;
  lastMessage?: { senderName?: string; content?: string; createdAt?: string } | null;
  unreadCount?: number;
};

type Props = {
  item: Conversation;
  onPress?: () => void;
  onAvatarPress?: () => void;
};

const ConversationItem: React.FC<Props> = ({ item, onPress, onAvatarPress }) => {
  const openConversation = () => {
    if (onPress) onPress();
  };

  // debug: log item shape to catch invalid fields that cause RN text errors
  try {
    // eslint-disable-next-line no-console
    console.log("[ConversationItem] render", {
      id: item?._id,
      name: item?.name,
      unread: item?.unreadCount,
      lastMessageType: typeof item?.lastMessage?.content,
    });
  } catch (e) {
    // ignore
  }

  if (!item) return null;

  // Defensive coercions: ensure we never render raw objects/arrays directly
  const displayName = typeof item.name === "string" ? item.name : JSON.stringify(item.name || "");
  const lastMessageText = typeof item?.lastMessage?.content === "string" ? item.lastMessage.content : JSON.stringify(item?.lastMessage?.content || "");
  const unreadLabel = typeof item.unreadCount === "number" ? (item.unreadCount > 99 ? "99+" : String(item.unreadCount)) : "";

  return (
    <Animated.View entering={FadeInUp.duration(280)} exiting={FadeOut.duration(160)} layout={Layout.springify()}>
      <TouchableOpacity style={styles.conversationItem} onPress={openConversation} activeOpacity={0.8}>
        <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8}>
          <Avatar uri={item.avatar || null} size={54} isGroup={item.type === "group"} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text style={styles.nameText}>{displayName}</Text>

            <View style={styles.rightRow}>
              {item?.lastMessage?.createdAt && (
                <Text style={[styles.timeText, { marginLeft: 8 }]}> 
                  {moment().diff(moment(item.lastMessage.createdAt), "hours") < 12
                    ? moment(item.lastMessage.createdAt).format("hh:mm A")
                    : moment(item.lastMessage.createdAt).format("MMM D")}
                </Text>
              )}

              {(item?.unreadCount ?? 0) > 0 && (
                <Animated.View
                  entering={ZoomIn.duration(180)}
                  exiting={ZoomOut.duration(140)}
                  style={styles.unreadBadge}
                >
                  <Text style={styles.unreadText}>{unreadLabel}</Text>
                </Animated.View>
              )}
            </View>
          </View>

          {item.lastMessage && (
            <Text style={styles.messageText}>{lastMessageText}</Text>
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.divider} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  conversationItem: {
    gap: spacingX._10,
    marginVertical: spacingY._12,
    flexDirection: "row",
    alignItems: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  rightRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  unreadBadge: {
    marginLeft: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },

  timeText: {
    color: colors.neutral400,
    fontSize: 13,
  },

  unreadText: {
    color: "#fff",
    fontSize: 12,
  },

  divider: {
    height: 1,
    width: "95%",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.07)",
  },
  nameText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  messageText: {
    fontSize: 15,
    color: colors.neutral600,
    marginTop: 2,
  },
});

export default ConversationItem;
