import { Router } from "express";
import { authenticate, authoriseRole } from "../middleware";
import {
  deleteUserById,
  getAllUsers,
  getUserById,
  updateUserById,
} from "../controllers";
import { UserRole } from "../types";

const router = Router();

router.get("/", authenticate, getAllUsers);
router
  .route("/:id")
  .get(authenticate, authoriseRole([UserRole.Admin]), getUserById)
  .put(authenticate, authoriseRole([UserRole.Admin]), updateUserById)
  .delete(authenticate, authoriseRole([UserRole.Admin]), deleteUserById);

export default router;
