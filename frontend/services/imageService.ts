import axios from "axios";
import { ResponseProps } from "@/types";

export const getAvatarPath = (file: any, isGroup = false) => {
  if (file && typeof file === "string") return file;
  if (file && typeof file === "object") return file.uri;
  if (isGroup) return require("../assets/images/defaultGroupAvatar.png");
  return require("../assets/images/defaultAvatar.png");
};

// Cloudinary config
const CLOUDINARY_CLOUD_NAME = "dmr1jrpth";
const CLOUDINARY_UPLOAD_PRESET = "chat_app_images";
const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

/**
 * Upload a file (local uri or already-uploaded URL) to Cloudinary.
 * Returns ResponseProps: { success, data: secure_url }
 */
export const uploadFileToCloudinary = async (
  file: { uri?: string } | string | null | undefined,
  folderName = "chat_app"
): Promise<ResponseProps> => {
  try {
    if (!file) return { success: false, msg: "No file provided" };

    // If file is already a hosted URL, return it directly
    if (typeof file === "string") {
      if (file.startsWith("http://") || file.startsWith("https://")) {
        return { success: true, data: file };
      }
      // string but not a URL -> treat as failure
      return { success: false, msg: "Invalid file string provided" };
    }

    // file is an object with uri (React Native image picker)
    const uri = (file as any).uri;
    if (!uri) return { success: false, msg: "File object missing uri" };

    const formData = new FormData();
    const filename = uri.split("/").pop() || "file.jpg";
    const match = /\.([0-9a-z]+)(?:\?|$)/i.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";

    // @ts-ignore - FormData with file for React Native
    formData.append("file", { uri, name: filename, type } as any);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", folderName);

    const response = await axios.post(CLOUDINARY_API_URL, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    });

    if (response && response.data && (response.data.secure_url || response.data.url)) {
      const url = response.data.secure_url || response.data.url;
      return { success: true, data: url };
    }

    return { success: false, msg: "No url returned from Cloudinary" };
  } catch (error: any) {
    console.warn("Cloudinary upload error", error?.message || error);
    const msg = (error && error.response && error.response.data && error.response.data.error && error.response.data.error.message) || error?.message || "Upload failed";
    return { success: false, msg };
  }
};

export default { getAvatarPath, uploadFileToCloudinary };
