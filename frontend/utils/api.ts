import axios, { AxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const expoExtra = (Constants.expoConfig && (Constants.expoConfig as any).extra) || (Constants.manifest && (Constants.manifest as any).extra) || {};
const EXPO_PUBLIC_API_URL = expoExtra.EXPO_PUBLIC_API_URL || (process.env && (process.env as any).EXPO_PUBLIC_API_URL) || undefined;
const ENV_API = (process.env && (process.env as any).API_BASE_URL) || undefined;
const LOCAL_API = "http://192.168.1.40:3001";

const baseURL = EXPO_PUBLIC_API_URL || ENV_API || LOCAL_API;

const DEFAULT_TIMEOUT = 10000; // 10s

const client = axios.create({ baseURL, timeout: DEFAULT_TIMEOUT });

// Attach token automatically from AsyncStorage
client.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("AUTH_TOKEN");
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

function normalizeError(err: any): Error & { status?: number; raw?: any } {
  const message = err?.response?.data?.msg || err?.response?.data?.message || err?.message || "Request failed";
  const e: any = new Error(message);
  if (err?.response?.status) e.status = err.response.status;
  e.raw = err;
  return e;
}

export async function get<T = any>(path: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await client.get(path, config);
    return res.data && res.data.data ? res.data.data : res.data;
  } catch (err: any) {
    throw normalizeError(err);
  }
}

export async function post<T = any>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await client.post(path, data, config);
    return res.data && res.data.data ? res.data.data : res.data;
  } catch (err: any) {
    throw normalizeError(err);
  }
}

export async function put<T = any>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await client.put(path, data, config);
    return res.data && res.data.data ? res.data.data : res.data;
  } catch (err: any) {
    throw normalizeError(err);
  }
}

export async function del<T = any>(path: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const res = await client.delete(path, config);
    return res.data && res.data.data ? res.data.data : res.data;
  } catch (err: any) {
    throw normalizeError(err);
  }
}

export function setBaseURL(url: string) {
  client.defaults.baseURL = url;
}

export default { get, post, put, del, setBaseURL };
