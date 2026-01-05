import { Request, Response } from "express";
import Message from "../modals/Message.js";
import Conversation from "../modals/Conversation.js";
import User from "../modals/User.js";
import { getIO } from "../socket.js";

export async function deleteMessage(req: Request & { user?: any }, res: Response) {
  try {
    const id = (req.params as any).id;
    const scope = ((req.query.scope as string) || 'me') as 'me'|'everyone';
    const userId = req.user?.id;
    const msg = await Message.findById(id).lean();
    if (!msg) return res.status(404).json({ success: false, msg: 'Message not found' });
    const conv: any = await Conversation.findById(msg.conversationId).lean();
    if (!conv) return res.status(404).json({ success: false, msg: 'Conversation not found' });
    const isAdmin = (conv.admins || []).map((a:any)=>a.toString()).includes(userId.toString()) || (conv.createdBy && conv.createdBy.toString()===userId.toString());

    if (scope === 'me') {
      await Message.updateOne({ _id: id }, { $addToSet: { deletedFor: userId } });
      const io = getIO();
      if (io) io.to(`conversation:${msg.conversationId}`).emit('message:deleted', { conversationId: msg.conversationId.toString(), messageIds: [id], scope: 'me', userId });
      return res.json({ success: true });
    }

    // everyone
    if (msg.senderId.toString() !== userId.toString() && !isAdmin) {
      return res.status(403).json({ success: false, msg: 'Not allowed' });
    }
    await Message.updateOne({ _id: id }, { $set: { isDeleted: true, content: null, attachment: null, deletedAt: new Date() } });
    const io = getIO();
    if (io) io.to(`conversation:${msg.conversationId}`).emit('message:deleted', { conversationId: msg.conversationId.toString(), messageIds: [id], scope: 'everyone', userId });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, msg: 'Server error' });
  }
}

export async function forwardMessage(req: Request & { user?: any }, res: Response) {
  try {
    const { sourceMessageId, targetConversationId } = req.body || {};
    const userId = req.user?.id;
    const src = await Message.findById(sourceMessageId).lean();
    if (!src) return res.status(404).json({ success: false, msg: 'Source not found' });
    const fwd = await Message.create({ conversationId: targetConversationId, senderId: userId, content: src.content, attachment: src.attachment, forwardedFromUser: src.senderId, forwardedFromChatId: src.conversationId } as any);
    await Conversation.findByIdAndUpdate(targetConversationId, { lastMessage: fwd._id, updatedAt: new Date() });
    const sender = await User.findById(userId, { name: 1, avatar: 1 }).lean();
    const orig = await User.findById(src.senderId, { name: 1 }).lean();
    const populated = { ...fwd.toObject(), senderId: userId, senderName: sender?.name || null, senderAvatar: sender?.avatar || null, forwardedFromUserName: orig?.name || null } as any;
    const io = getIO();
    if (io) io.to(`conversation:${targetConversationId}`).emit('message:new', populated);
    return res.json({ success: true, data: populated });
  } catch (e) {
    return res.status(500).json({ success: false, msg: 'Server error' });
  }
}

export default { deleteMessage, forwardMessage };
