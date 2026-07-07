import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { Sequelize } from "sequelize";
import { FriendLink } from "../models";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/friends - public list (random order, refresh-shuffled)
// 不带分页参数时返回全部并随机排序；带 ?page=&limit= 时按创建时间分页（管理后台用）
router.get("/", async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || "0")) || 0;
  const limit = page > 0 ? Math.max(1, Math.min(100, parseInt(String(req.query.limit || "10")) || 10)) : 0;

  if (page > 0) {
    const { rows, count } = await FriendLink.findAndCountAll({
      order: [["createdAt", "ASC"], ["id", "ASC"]],
      offset: (page - 1) * limit,
      limit,
    });
    res.json({
      data: rows,
      pagination: { page, limit, total: count, hasMore: page * limit < count },
    });
    return;
  }

  const links = await FriendLink.findAll({
    order: [Sequelize.literal("RAND()")],
  });
  res.json({
    data: links,
    pagination: { page: 1, limit: links.length, total: links.length, hasMore: false },
  });
});

// POST /api/friends - create (admin only)
router.post(
  "/",
  authenticate,
  requireAdmin,
  [
    body("name").trim().isLength({ min: 1, max: 100 }),
    body("url").trim().isLength({ min: 1, max: 500 }),
    body("desc").optional().trim().isLength({ max: 255 }),
    body("email").optional().trim().isLength({ max: 255 }),
    body("avatar").optional().trim().isLength({ max: 512 }),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const link = await FriendLink.create({
      name: req.body.name,
      url: req.body.url,
      desc: req.body.desc || "",
      email: req.body.email || "",
      avatar: req.body.avatar || "",
    });
    res.status(201).json(link);
  }
);

// PUT /api/friends/:id - update (admin only)
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  [
    body("name").optional().trim().isLength({ min: 1, max: 100 }),
    body("url").optional().trim().isLength({ min: 1, max: 500 }),
    body("desc").optional().trim().isLength({ max: 255 }),
    body("email").optional().trim().isLength({ max: 255 }),
    body("avatar").optional().trim().isLength({ max: 512 }),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const link = await FriendLink.findByPk(String(req.params.id));
    if (!link) {
      res.status(404).json({ message: "友链不存在" });
      return;
    }
    await link.update({
      name: req.body.name ?? link.name,
      url: req.body.url ?? link.url,
      desc: req.body.desc ?? link.desc,
      email: req.body.email ?? link.email,
      avatar: req.body.avatar ?? link.avatar,
    });
    res.json(link);
  }
);

// DELETE /api/friends/:id - delete (admin only)
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const link = await FriendLink.findByPk(String(req.params.id));
    if (!link) {
      res.status(404).json({ message: "友链不存在" });
      return;
    }
    await link.destroy();
    res.json({ message: "已删除" });
  }
);

export default router;
