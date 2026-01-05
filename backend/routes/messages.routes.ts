import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { deleteMessage, forwardMessage } from "../controllers/message.controller.js";

const router = Router();

router.delete('/:id', requireAuth, deleteMessage);
router.post('/forward', requireAuth, forwardMessage);

export default router;
