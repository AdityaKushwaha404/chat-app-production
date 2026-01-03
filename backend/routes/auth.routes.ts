import { Router } from "express";
import { registerUser, loginUser, verifyTokenHandler } from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify", verifyTokenHandler);
// Health endpoint for simple liveness checks
router.get("/health", async (req, res) => {
	try {
		return res.json({ status: "ok", service: "auth" });
	} catch (err) {
		return res.status(500).json({ status: "error" });
	}
});

export default router;
