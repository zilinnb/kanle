import { Router, Request, Response } from "express";
import { SiteSetting } from "../models";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";
import { getDoubanData } from "../services/douban-service";

const router = Router();

async function getDoubanId(): Promise<string> {
  const setting = await SiteSetting.findByPk(1);
  return setting?.doubanId || "";
}

// GET /api/douban — 获取豆瓣数据（公开接口，有缓存）
router.get("/", async (_req: Request, res: Response) => {
  try {
    const doubanId = await getDoubanId();
    if (!doubanId) {
      res.json({
        movies: [],
        books: [],
        music: [],
        syncedAt: "",
        doubanId: "",
      });
      return;
    }
    const data = await getDoubanData(doubanId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message || "获取豆瓣数据失败" });
  }
});

// POST /api/douban/sync — 手动同步豆瓣数据（仅管理员）
router.post(
  "/sync",
  authenticate,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      const doubanId = await getDoubanId();
      if (!doubanId) {
        res.status(400).json({
          success: false,
          message: "请先在设置中填写豆瓣 ID",
        });
        return;
      }
      const data = await getDoubanData(doubanId, true);
      res.json({
        success: true,
        message: `同步成功：电影 ${data.movies.length} 部，图书 ${data.books.length} 本，音乐 ${data.music.length} 张`,
        data,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || "同步失败",
      });
    }
  }
);

export default router;
