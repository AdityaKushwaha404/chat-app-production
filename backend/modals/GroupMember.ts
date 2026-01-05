import { Schema, model, Types } from "mongoose";

export interface GroupMemberDoc {
  _id?: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  joinedAt?: Date;
}

const GroupMemberSchema = new Schema<GroupMemberDoc>({
  conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  joinedAt: { type: Date, default: Date.now },
});

GroupMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

export default model<GroupMemberDoc>("GroupMember", GroupMemberSchema);
