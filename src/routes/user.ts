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

router.get("/users", authenticate, getAllUsers);
router
  .route("/users/:id")
  .get(authenticate, authoriseRole([UserRole.Admin]), getUserById)
  .put(authenticate, updateUserById)
  .delete(authenticate, deleteUserById);

export default router;
