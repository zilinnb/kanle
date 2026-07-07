import { Router, Request, Response } from "express";
import { User } from "../models";

const router = Router();

// GET /api/users/owner - public owner profile for the blog cover
router.get("/owner", async (_req: Request, res: Response) => {
  const owner = await User.findOne({
    where: { role: "admin" },
    order: [["createdAt", "ASC"]],
    attributes: ["id", "email", "username", "nickname", "avatar", "cover", "bio", "website"],
  });

  if (!owner) {
    res.status(404).json({ message: "未找到博主资料" });
    return;
  }

  res.json(owner);
});

export default router;
