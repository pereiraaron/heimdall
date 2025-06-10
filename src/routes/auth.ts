import { Router, Request, Response } from "express";
import { login, register } from "../controllers";
import passport from "../config/passport";
import { AuthProvider } from "../types";
import { generateToken } from "../controllers/auth";
import { User } from "../models/User";

const router = Router();

// Regular authentication routes
router.post("/register", register);
router.post("/login", login);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/api/auth/login" }),
  (req: Request, res: Response) => {
    // Generate JWT token for the authenticated user
    const token = generateToken(req.user);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/auth/success?token=${token}`
    );
  }
);

// Facebook OAuth routes
router.get(
  "/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

router.get(
  "/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/api/auth/login" }),
  (req: Request, res: Response) => {
    // Generate JWT token for the authenticated user
    const token = generateToken(req.user);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/auth/success?token=${token}`
    );
  }
);

// Twitter OAuth routes
router.get("/twitter", passport.authenticate("twitter"));

router.get(
  "/twitter/callback",
  passport.authenticate("twitter", { failureRedirect: "/api/auth/login" }),
  (req: Request, res: Response) => {
    // Generate JWT token for the authenticated user
    const token = generateToken(req.user);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/auth/success?token=${token}`
    );
  }
);

// Check if a user exists with a specific social provider
router.get("/check/:provider/:id", (req: Request, res: Response) => {
  const { provider, id } = req.params;

  User.findOne({
    provider: provider as AuthProvider,
    providerId: id,
  })
    .then((user) => res.status(200).json({ exists: !!user }))
    .catch((error) => res.status(500).json({ message: "Server error", error }));
});

export default router;
