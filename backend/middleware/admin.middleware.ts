import Conversation from "../modals/Conversation.js";
import { Request, Response, NextFunction } from "express";

// Requires requireAuth to have populated req.user
export async function requireGroupAdmin(req: Request & { user?: any }, res: Response, next: NextFunction) {
  try {
    const groupId = (req.params as any).groupId || (req.params as any).id;
    const userId = req.user?.id;
    if (!groupId || !userId) return res.status(401).json({ success: false, msg: "Unauthorized" });
    const conv: any = await Conversation.findById(groupId).lean();
    if (!conv || conv.type !== "group") return res.status(404).json({ success: false, msg: "Group not found" });
    const isAdmin = (conv.admins || []).map((a: any) => a.toString()).includes(userId.toString()) || (conv.createdBy && conv.createdBy.toString() === userId.toString());
    if (!isAdmin) return res.status(403).json({ success: false, msg: "Admin only" });
    (req as any).group = conv;
    return next();
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

// Allows edits by any participant when onlyAdminCanEdit is false; otherwise restricts to admins/creator
export async function requireGroupEditPermission(req: Request & { user?: any }, res: Response, next: NextFunction) {
  try {
    const groupId = (req.params as any).groupId || (req.params as any).id;
    const userId = req.user?.id;
    if (!groupId || !userId) return res.status(401).json({ success: false, msg: "Unauthorized" });
    const conv: any = await Conversation.findById(groupId).lean();
    if (!conv || conv.type !== "group") return res.status(404).json({ success: false, msg: "Group not found" });
    const isParticipant = (conv.participants || []).map((p: any) => p.toString()).includes(userId.toString());
    const isAdmin = (conv.admins || []).map((a: any) => a.toString()).includes(userId.toString()) || (conv.createdBy && conv.createdBy.toString() === userId.toString());
    const onlyAdmin = !!conv.settings?.onlyAdminCanEdit;
    if (onlyAdmin) {
      if (!isAdmin) return res.status(403).json({ success: false, msg: "Admin only" });
    } else {
      if (!isParticipant) return res.status(403).json({ success: false, msg: "Participants only" });
    }
    (req as any).group = conv;
    return next();
  } catch (e) {
    return res.status(500).json({ success: false, msg: "Server error" });
  }
}

export default { requireGroupAdmin };
