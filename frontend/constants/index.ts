import { Platform } from "react-native";
import Constants from "expo-constants";

// Resolution order for base URL:
// 1. Expo public env: `EXPO_PUBLIC_API_URL` (from expo extra or process.env)
// 2. process.env.API_BASE_URL
// 3. Platform-aware local default (development LAN IP)

const expoExtra = (Constants.expoConfig && (Constants.expoConfig as any).extra) || (Constants.manifest && (Constants.manifest as any).extra) || {};
const EXPO_PUBLIC_API_URL = expoExtra.EXPO_PUBLIC_API_URL || (process.env && (process.env as any).EXPO_PUBLIC_API_URL) || undefined;
const ENV_API = (process.env && (process.env as any).API_BASE_URL) || undefined;

// Local development default (your local machine IP and backend port)
const LOCAL_API = "http://192.168.1.40:3001";

let API_BASE_URL: string;
if (EXPO_PUBLIC_API_URL) {
  API_BASE_URL = EXPO_PUBLIC_API_URL as string;
} else {
  const defaultEnv = (Platform.select({
    android: "http://10.0.2.2:3001",
    ios: LOCAL_API,
    default: LOCAL_API,
  }) || LOCAL_API) as string;
  API_BASE_URL = ENV_API || defaultEnv;
}

export { API_BASE_URL };
export default API_BASE_URL;
 
