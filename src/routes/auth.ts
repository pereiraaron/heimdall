import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, register } from "../controllers";
import { validateApiKey } from "../middleware";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 attempts per window
  message: { message: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", validateApiKey, authLimiter, register);
router.post("/login", validateApiKey, authLimiter, login);

export default router;
