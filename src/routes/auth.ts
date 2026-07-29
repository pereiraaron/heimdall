import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, register, refresh, logout } from "../controllers";
import { validateApiKey, authenticate } from "../middleware";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 attempts per window
  message: { message: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { message: "Too many refresh attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, validateApiKey, register);
router.post("/login", authLimiter, validateApiKey, login);
router.post("/refresh", refreshLimiter, validateApiKey, refresh);
router.post("/logout", authenticate, logout);

export default router;
