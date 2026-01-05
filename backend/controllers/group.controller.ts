import { Request, Response } from "express";
import Conversation from "../modals/Conversation.js";
import GroupMember from "../modals/GroupMember.js";
import UserGroupSettings from "../modals/UserGroupSettings.js";
import User from "../modals/User.js";
import { getIO } from "../socket.js";

export async function getGroupInfo(req: Request & { user?: any }, res: Response) {
  try {
    const id = (req.params as any).groupId || (req.params as any).id;
    const conv = await Conversation.findById(id)
      .populate({ path: "participants", select: "name avatar email" })
      .populate({ path: "createdBy", select: "name _id" })
      .lean();
    if (!conv) return res.status(404).json({ success: false, msg: "Group not found" });
    return res.json({ success: true, data: conv });
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

export async function updateGroup(req: Request & { user?: any }, res: Response) {
  try {
    const id = (req.params as any).groupId || (req.params as any).id;
    const { name, description, photo, avatar } = req.body || {};
    const update: any = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (photo !== undefined || avatar !== undefined) update.avatar = photo || avatar;
    const updated = await Conversation.findByIdAndUpdate(id, update, { new: true })
      .populate({ path: "participants", select: "name avatar email" })
      .populate({ path: "createdBy", select: "name _id" })
      .lean();
    const io = getIO();
    if (io) io.to(`conversation:${id}`).emit("conversation:updated", { conversationId: id, conversation: updated });
    return res.json({ success: true, data: updated });
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

export async function addMembers(req: Request & { user?: any }, res: Response) {
  try {
    const id = (req.params as any).groupId || (req.params as any).id;
    const { members = [], emails = [] } = (req.body || {}) as any;
    const addUserIds: string[] = Array.isArray(members) ? members.slice() : [];
    if (Array.isArray(emails) && emails.length > 0) {
      const users = await User.find({ email: { $in: emails.map((e: string) => (e || "").toLowerCase().trim()) } }).lean();
      users.forEach((u: any) => addUserIds.push(u._id.toString()));
    }
    const unique = Array.from(new Set(addUserIds));
    const conv: any = await Conversation.findById(id).lean();
    if (!conv) return res.status(404).json({ success: false, msg: "Group not found" });
    const merged = Array.from(new Set([...(conv.participants || []).map((p: any) => p.toString()), ...unique]));
    await Conversation.findByIdAndUpdate(id, { participants: merged });
    // upsert GroupMember entries
    await Promise.all(
      unique.map((uid) => GroupMember.updateOne({ conversationId: id, userId: uid }, { $setOnInsert: { conversationId: id, userId: uid } }, { upsert: true }))
    );
    const updated = await Conversation.findById(id).populate({ path: "participants", select: "name avatar email" }).populate({ path: "createdBy", select: "name _id" }).lean();
    const io = getIO();
    if (io) io.to(`conversation:${id}`).emit("conversation:members:added", { conversationId: id, added: unique });
    return res.json({ success: true, data: updated });
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

export async function removeMembers(req: Request & { user?: any }, res: Response) {
  try {
    const id = (req.params as any).groupId || (req.params as any).id;
    const { members = [] } = (req.body || {}) as any;
    const toRemove = Array.isArray(members) ? members.map((m) => m.toString()) : [];
    const conv: any = await Conversation.findById(id).lean();
    if (!conv) return res.status(404).json({ success: false, msg: "Group not found" });
    // prevent removing creator
    const creatorId = conv.createdBy?.toString?.();
    const filtered = (conv.participants || [])
      .map((p: any) => p.toString())
      .filter((uid: string) => !toRemove.includes(uid) && uid !== creatorId);
    await Conversation.findByIdAndUpdate(id, { participants: filtered });
    await GroupMember.deleteMany({ conversationId: id, userId: { $in: toRemove } });
    const updated = await Conversation.findById(id).populate({ path: "participants", select: "name avatar email" }).populate({ path: "createdBy", select: "name _id" }).lean();
    const io = getIO();
    if (io) io.to(`conversation:${id}`).emit("conversation:members:removed", { conversationId: id, removed: toRemove });
    return res.json({ success: true, data: updated });
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

export async function updateSettings(req: Request & { user?: any }, res: Response) {
  try {
    const id = (req.params as any).groupId || (req.params as any).id;
    const { onlyAdminCanSend, onlyAdminCanEdit } = req.body || {};
    const update: any = {};
    if (onlyAdminCanSend !== undefined) update["settings.onlyAdminCanSend"] = !!onlyAdminCanSend;
    if (onlyAdminCanEdit !== undefined) update["settings.onlyAdminCanEdit"] = !!onlyAdminCanEdit;
    const updated = await Conversation.findByIdAndUpdate(id, update, { new: true })
      .populate({ path: "participants", select: "name avatar email" })
      .populate({ path: "createdBy", select: "name _id" })
      .lean();
    const io = getIO();
    if (io) io.to(`conversation:${id}`).emit("conversation:settings:updated", { conversationId: id, conversation: updated });
    return res.json({ success: true, data: updated });
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

export async function muteGroup(req: Request & { user?: any }, res: Response) {
  try {
    const id = (req.params as any).groupId || (req.params as any).id;
    const userId = req.user?.id;
    const { until } = req.body || {};
    const doc = await UserGroupSettings.findOneAndUpdate(
      { conversationId: id, userId },
      { $set: { muted: true, muteUntil: until ? new Date(until) : null } },
      { upsert: true, new: true }
    ).lean();
    return res.json({ success: true, data: doc });
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

export async function unmuteGroup(req: Request & { user?: any }, res: Response) {
  try {
    const id = (req.params as any).groupId || (req.params as any).id;
    const userId = req.user?.id;
    const doc = await UserGroupSettings.findOneAndUpdate(
      { conversationId: id, userId },
      { $set: { muted: false, muteUntil: null } },
      { upsert: true, new: true }
    ).lean();
    return res.json({ success: true, data: doc });
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

export async function leaveGroup(req: Request & { user?: any }, res: Response) {
  try {
    const id = (req.params as any).groupId || (req.params as any).id;
    const userId = req.user?.id;
    const conv: any = await Conversation.findById(id).lean();
    if (!conv) return res.status(404).json({ success: false, msg: "Group not found" });
    const creatorId = conv.createdBy?.toString?.();
    if (creatorId && creatorId === userId.toString()) {
      return res.status(400).json({ success: false, msg: "Creator cannot leave the group" });
    }
    const filtered = (conv.participants || []).map((p: any) => p.toString()).filter((uid: string) => uid !== userId.toString());
    await Conversation.findByIdAndUpdate(id, { participants: filtered });
    await GroupMember.deleteOne({ conversationId: id, userId });
    const io = getIO();
    if (io) io.to(`conversation:${id}`).emit("conversation:members:removed", { conversationId: id, removed: [userId] });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

export async function setAvatar(req: Request & { user?: any }, res: Response) {
  try {
    const id = (req.params as any).groupId || (req.params as any).id;
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ success: false, msg: "Missing url" });
    const updated = await Conversation.findByIdAndUpdate(id, { avatar: url }, { new: true })
      .populate({ path: "participants", select: "name avatar email" })
      .populate({ path: "createdBy", select: "name _id" })
      .lean();
    const io = getIO();
    if (io) io.to(`conversation:${id}`).emit("conversation:updated", { conversationId: id, conversation: updated });
    return res.json({ success: true, data: updated });
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

export default { getGroupInfo, updateGroup, addMembers, removeMembers, updateSettings, muteGroup, unmuteGroup, leaveGroup, setAvatar };
