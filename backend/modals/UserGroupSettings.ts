import { Schema, model, Types } from "mongoose";

export interface UserGroupSettingsDoc {
  _id?: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  muted: boolean;
  muteUntil?: Date | null;
}

const UserGroupSettingsSchema = new Schema<UserGroupSettingsDoc>({
  conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  muted: { type: Boolean, default: false },
  muteUntil: { type: Date, default: null },
}, { timestamps: true });

UserGroupSettingsSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

export default model<UserGroupSettingsDoc>("UserGroupSettings", UserGroupSettingsSchema);
