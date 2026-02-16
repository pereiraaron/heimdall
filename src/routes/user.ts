import { Router } from "express";
import { authenticate, authoriseRole } from "@middleware";
import { deleteUserById, getAllUsers, getUserById, updateUserById } from "@controllers";
import { MembershipRole } from "@types";

const router = Router();

router.get("/", authenticate, getAllUsers);
router
  .route("/:id")
  .get(authenticate, authoriseRole([MembershipRole.Admin]), getUserById)
  .put(authenticate, authoriseRole([MembershipRole.Admin]), updateUserById)
  .delete(authenticate, authoriseRole([MembershipRole.Admin]), deleteUserById);

export default router;
