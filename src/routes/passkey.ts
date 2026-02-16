import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
  listCredentials,
  updateCredential,
  deleteCredential,
  optOutPasskey,
} from "@controllers";
import { authenticate, validateApiKey } from "@middleware";

const router = Router();

const passkeyRegLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: "Too many passkey registration attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const passkeyAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: "Too many passkey login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Registration (requires Bearer token - user must be logged in)
router.post("/register/options", authenticate, passkeyRegLimiter, generateRegistrationOptions);
router.post("/register/verify", authenticate, passkeyRegLimiter, verifyRegistration);

// Authentication (requires API key - project-scoped login)
router.post("/login/options", validateApiKey, passkeyAuthLimiter, generateAuthenticationOptions);
router.post("/login/verify", validateApiKey, passkeyAuthLimiter, verifyAuthentication);

// Credential management (requires Bearer token)
router.get("/credentials", authenticate, listCredentials);
router.patch("/credentials/:id", authenticate, updateCredential);
router.delete("/credentials/:id", authenticate, deleteCredential);

// Enrollment opt-out (requires Bearer token)
router.post("/opt-out", authenticate, optOutPasskey);

export default router;
