import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Alert, Pressable, ScrollView, TextInput, Animated, ActivityIndicator } from "react-native";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Avatar from "@/components/Avatar";
import Header from "@/components/Header";
import { colors, spacingY } from "@/constants/theme";
import * as ImagePicker from "expo-image-picker";
import { connectSocket, getSocket } from "@/socket/socket";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/authContext";
import { uploadFileToCloudinary } from "@/services/imageService";

const ProfileModal = () => {
	const { user, updateToken, signOut } = useAuth();
	const router = require("expo-router").useRouter();
	const [loading, setLoading] = useState(false);
	const scaleAnim = useRef(new Animated.Value(1)).current;
	const [name, setName] = useState(user?.name || "");
	const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);

	useEffect(() => {
		setName(user?.name || "");
		setAvatar(user?.avatar || null);
	}, [user]);

	const pickImage = async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			Alert.alert("Permission required", "Permission to access gallery is required");
			return;
		}
		const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: false, allowsEditing: true });
		// expo-image-picker returns { canceled, assets } with newest API
		// ensure we use assets[0].uri
		// @ts-ignore
		if (!res.canceled && Array.isArray((res as any).assets) && (res as any).assets.length > 0) {
			// @ts-ignore
			setAvatar((res as any).assets[0].uri);
		}
	};

	const processUpdateProfile = async () => {
		setLoading(true);
		try {
			await connectSocket();
		} catch (e) {
			// ignore
		}

		// If avatar is a local uri, upload it to Cloudinary first
		let avatarToSend = avatar;
		if (avatar && !(avatar.startsWith("http://") || avatar.startsWith("https://"))) {
			const up = await uploadFileToCloudinary({ uri: avatar }, "chat_app");
			if (!up || !up.success) {
				setLoading(false);
				Alert.alert("Upload failed", up?.msg || "Unable to upload avatar");
				return;
			}
			avatarToSend = up.data as string;
		}

		const socket = getSocket();
		if (!socket) {
			setLoading(false);
			Alert.alert("Error", "Socket not connected");
			return;
		}

		socket.emit("updateProfile", { name, avatar: avatarToSend }, async (resp: any) => {
			setLoading(false);
			if (!resp) {
				Alert.alert("Error", "No response from server");
				return;
			}
			if (!resp.success) {
				Alert.alert("Update failed", resp.msg || "Unable to update profile");
				return;
			}
			if (resp.token) {
				try {
					await updateToken(resp.token);
				} catch (e) {
					console.warn("updateToken failed", e);
				}
			}

			// animate success then navigate to main Home
			Animated.sequence([
				Animated.timing(scaleAnim, { toValue: 1.06, duration: 160, useNativeDriver: true }),
				Animated.timing(scaleAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
			]).start(() => {
				router.replace("/(main)/home");
			});
		});
	};

	return (
		<ScreenWrapper showPattern={false} bgOpacity={0} isModal={true}>
			<View style={styles.container}>
				<View style={styles.modalCard}>
					<Header title={"Update Profile"} />

					<ScrollView contentContainerStyle={styles.form}>
					<View style={styles.avatarWrap}>
						<Pressable onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start()} onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()} onPress={pickImage} style={styles.avatarContainer}>
							<Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
								<Avatar uri={avatar || null} size={170} />
							</Animated.View>
						</Pressable>
						<Pressable style={styles.editBtn} onPress={pickImage} accessibilityLabel="Edit avatar">
							<MaterialIcons name="edit" size={18} color={colors.neutral900} />
						</Pressable>
					</View>

					<Typo size={14} style={{ marginTop: spacingY._15 }}>Email</Typo>
					<TextInput value={user?.email || ""} editable={false} style={styles.disabledInput} />

					<Typo size={14} style={{ marginTop: spacingY._15 }}>Name</Typo>
					<TextInput value={name} onChangeText={setName} style={styles.input} />

					</ScrollView>
				</View>

				<View style={styles.footer}> 
					<Pressable style={styles.logoutBtn} onPress={() => signOut()}>
						<MaterialIcons name="logout" size={20} color="#fff" />
					</Pressable>

					<Pressable onPress={processUpdateProfile} style={[styles.updateBtn, loading ? styles.updateBtnDisabled : null]} disabled={loading}>
						{loading ? (
							<ActivityIndicator color={colors.white} />
						) : (
							<Typo size={16} color={colors.white} fontWeight={"800"}>Update</Typo>
						)}
					</Pressable>
				</View>
			</View>
		</ScreenWrapper>
	);
};

export default ProfileModal;

const styles = StyleSheet.create({
	container: { flex: 1 },
	modalCard: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, overflow: "hidden" },
	form: { padding: 20, paddingBottom: 120 },
	avatarWrap: { alignSelf: "center", marginTop: 8, width: 180, height: 180, alignItems: "center", justifyContent: "center" },
	avatarContainer: { alignSelf: "center" },
	editBtn: { position: "absolute", right: 6, bottom: 6, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.neutral100, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
	disabledInput: { backgroundColor: colors.neutral100, padding: 12, borderRadius: 30, marginTop: 6 },
	input: { backgroundColor: colors.white, padding: 12, borderRadius: 30, marginTop: 6, borderWidth: 1, borderColor: colors.neutral200 },
	footer: { position: "absolute", left: 20, right: 20, bottom: 24, flexDirection: "row", alignItems: "center" },
	logoutBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center", marginRight: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
	updateBtn: { flex: 1, backgroundColor: colors.primary, padding: 14, borderRadius: 28, alignItems: "center" },
	updateBtnDisabled: { opacity: 0.7 },
});
