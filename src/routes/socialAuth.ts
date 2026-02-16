import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  socialLogin,
  linkSocialAccount,
  unlinkSocialAccount,
  listSocialAccounts,
} from "../controllers";
import { validateApiKey, authenticate } from "../middleware";

const router = Router();

const socialAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: "Too many social auth attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", validateApiKey, socialAuthLimiter, socialLogin);
router.post("/link", authenticate, linkSocialAccount);
router.delete("/unlink/:provider", authenticate, unlinkSocialAccount);
router.get("/accounts", authenticate, listSocialAccounts);

export default router;
