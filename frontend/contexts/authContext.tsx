import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as jwtDecode from "jwt-decode";
import * as authService from "@/services/authService";
import { useRouter } from "expo-router";
import { AuthContextProps, DecodedTokenProps, UserProps } from "@/types";
import * as Notifications from 'expo-notifications';

const TOKEN_KEY = "AUTH_TOKEN";

const defaultContext: AuthContextProps = {
	token: null,
	user: null,
	signIn: async () => {},
	signUp: async () => {},
	signOut: async () => {},
	updateToken: async () => {},
};

const AuthContext = createContext<AuthContextProps>(defaultContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const [token, setToken] = useState<string | null>(null);
	const [user, setUser] = useState<UserProps | null>(null);
	const router = useRouter();

	useEffect(() => {
		(async () => {
			try {
				const t = await AsyncStorage.getItem(TOKEN_KEY);
				if (t) {
					// verify token with backend to ensure it's valid
					const res = await authService.verify(t);
					if (res.success && res.data?.user) {
						setToken(t);
						setUser(res.data.user);
						// go to home
						router.replace("/(main)/home");
						return;
					} else {
						// invalid token -> remove
						await AsyncStorage.removeItem(TOKEN_KEY);
						setToken(null);
						setUser(null);
					}
				}
			} catch (e) {
				console.warn("Failed to load token", e);
			}
		})();
	}, []);

	  const updateToken = async (t: string) => {
		if (!t) {
			await AsyncStorage.removeItem(TOKEN_KEY);
			setToken(null);
			setUser(null);
			return;
		}
		await AsyncStorage.setItem(TOKEN_KEY, t);
		// verify and set user
		const res = await authService.verify(t);
		if (res.success && res.data?.user) {
			setToken(t);
			setUser(res.data.user);
		} else {
			await AsyncStorage.removeItem(TOKEN_KEY);
			setToken(null);
			setUser(null);
			throw new Error(res.msg || "Invalid token");
		}
	  };

	const gotoHomePage = () => router.replace("/(main)/home");
	const gotoWelcomePage = () => router.replace("/(auth)/welcome");

		const signIn = async (email: string, password: string) => {
			const res = await authService.login(email, password);
			if (!res.success) throw new Error(res.msg || "Login failed");
			const token = res.data?.token;
			if (!token) throw new Error("No token returned from server");
			await updateToken(token);
			try {
				// Register device for FCM and send token to backend
				const perm = await Notifications.requestPermissionsAsync();
				if (perm.status === 'granted') {
					const devToken = await Notifications.getDevicePushTokenAsync();
					const fcm = (devToken as any)?.data || (devToken as any)?.token;
					if (fcm) {
						await fetch(`${(await import('@/constants')).default}/api/users/fcm-token`, {
							method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
							body: JSON.stringify({ token: fcm })
						});
					}
				}
			} catch (e) {
				console.warn('FCM register failed', e);
			}
			router.replace("/(main)/home");
		};

		const signUp = async (name: string, email: string, password: string, avatar?: string) => {
			const res = await authService.register(name, email, password, avatar);
			if (!res.success) throw new Error(res.msg || "Registration failed");
			const token = res.data?.token;
			if (!token) throw new Error("No token returned from server");
			await updateToken(token);
			try {
				const perm = await Notifications.requestPermissionsAsync();
				if (perm.status === 'granted') {
					const devToken = await Notifications.getDevicePushTokenAsync();
					const fcm = (devToken as any)?.data || (devToken as any)?.token;
					if (fcm) {
						await fetch(`${(await import('@/constants')).default}/api/users/fcm-token`, {
							method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
							body: JSON.stringify({ token: fcm })
						});
					}
				}
			} catch (e) {
				console.warn('FCM register failed', e);
			}
			router.replace("/(main)/home");
		};

	const signOut = async () => {
		await AsyncStorage.removeItem(TOKEN_KEY);
		setToken(null);
		setUser(null);
		// disconnect socket on signout
		try {
			const { disconnectSocket } = await import("@/socket/socket");
			disconnectSocket();
		} catch (e) {
			// ignore
		}
		router.replace("/(auth)/welcome");
	};

	const connectSocket = async () => {
		try {
			const { connectSocket } = await import("@/socket/socket");
			await connectSocket();
		} catch (e) {
			console.warn("Socket connect failed", e);
		}
	};

	return (
		<AuthContext.Provider value={{ token, user, signIn, signUp, signOut, updateToken }}>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
