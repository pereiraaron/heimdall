import { Router } from "express";
import { register, login, getProfile } from "../controllers/authControllers";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", getProfile);

export default router;
