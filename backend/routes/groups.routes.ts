import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireGroupAdmin, requireGroupEditPermission } from "../middleware/admin.middleware.js";
import { getGroupInfo, updateGroup, addMembers, removeMembers, updateSettings, muteGroup, unmuteGroup, leaveGroup, setAvatar } from "../controllers/group.controller.js";

const router = Router();

// Read
router.get('/:groupId', requireAuth, getGroupInfo);

// Admin-only modifications
router.put('/:groupId', requireAuth, requireGroupEditPermission, updateGroup);
router.post('/:groupId/add', requireAuth, requireGroupEditPermission, addMembers);
router.post('/:groupId/remove', requireAuth, requireGroupEditPermission, removeMembers);
router.put('/:groupId/settings', requireAuth, requireGroupAdmin, updateSettings);
router.post('/:groupId/avatar', requireAuth, requireGroupEditPermission, setAvatar);

// User settings
router.put('/:groupId/mute', requireAuth, muteGroup);
router.put('/:groupId/unmute', requireAuth, unmuteGroup);
router.post('/:groupId/leave', requireAuth, leaveGroup);

export default router;
