/**
 * 插件管理路由（admin only）
 *
 * 基于 MusicFree 插件系统：
 * - GET    /api/admin/plugins          列出已安装插件
 * - POST   /api/admin/plugins/upload   上传 .js 插件文件（multipart/form-data）
 * - POST   /api/admin/plugins/import   在线导入单个 .js：body { url }
 * - POST   /api/admin/plugins/subscribe 订阅 .json 插件集：body { url }
 * - DELETE /api/admin/plugins/:id      删除插件（id = fileName）
 *
 * 响应字段对齐 mf-manager.listPlugins()：
 * { id, platform, version, author, description?, srcUrl?,
 *   primaryKey?, supportedSearchType?, methods, fileName }
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";
import {
  listPlugins,
  installPluginFromFile,
  installPluginFromUrl,
  subscribePlugins,
  removePlugin,
} from "../music-sources/mf-manager";

const router = Router();

// 临时目录用于 multer 上传
const tmpDir = path.join(os.tmpdir(), "kanle-plugins");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const pluginUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpDir),
    filename: (_req, file, cb) => {
      const safe = path.basename(file.originalname).replace(/[^\w.\-]/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".js")) {
      cb(null, true);
    } else {
      cb(new Error("仅支持 .js 插件文件"));
    }
  },
});

// GET /api/admin/plugins — 列出已安装插件
router.get(
  "/",
  authenticate,
  requireAdmin,
  (_req: Request, res: Response) => {
    res.json(listPlugins());
  }
);

// POST /api/admin/plugins/upload — 上传 .js 文件
router.post(
  "/upload",
  authenticate,
  requireAdmin,
  pluginUpload.single("file"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ message: "未上传文件" });
      return;
    }
    try {
      const record = await installPluginFromFile({
        originalname: req.file.originalname,
        path: req.file.path,
      });
      res.json({
        message: "插件安装成功",
        id: record.fileName,
        platform: record.platform,
        name: record.platform,
        version: record.instance.version || "0.0.0",
        author: record.instance.author || "",
      });
    } catch (err: any) {
      // 清理临时文件
      try {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch {
        // ignore
      }
      res.status(400).json({ message: err?.message || "插件安装失败" });
    }
  }
);

// POST /api/admin/plugins/import — 在线导入单个 .js：body { url }
router.post(
  "/import",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      res.status(400).json({ message: "缺少 url 参数" });
      return;
    }
    try {
      const record = await installPluginFromUrl(url);
      res.json({
        message: "插件导入成功",
        id: record.fileName,
        platform: record.platform,
        name: record.platform,
        version: record.instance.version || "0.0.0",
        author: record.instance.author || "",
      });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "在线导入失败" });
    }
  }
);

// POST /api/admin/plugins/subscribe — 订阅 .json 插件集：body { url }
// JSON 格式：{ plugins: [{ name, url, version? }] }
router.post(
  "/subscribe",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      res.status(400).json({ message: "缺少 url 参数" });
      return;
    }
    try {
      const result = await subscribePlugins(url);
      const ok = result.failed.length === 0;
      res.status(ok ? 200 : 207).json({
        message: `订阅完成：成功 ${result.installed}，跳过 ${result.skipped}，失败 ${result.failed.length}`,
        ...result,
      });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "订阅失败" });
    }
  }
);

// DELETE /api/admin/plugins/:id — 删除插件
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  (req: Request, res: Response) => {
    const id = decodeURIComponent(String(req.params.id));
    if (!id) {
      res.status(400).json({ message: "缺少插件 id" });
      return;
    }
    const ok = removePlugin(id);
    if (!ok) {
      res.status(404).json({ message: "插件不存在" });
      return;
    }
    res.json({ message: "插件已删除" });
  }
);

export default router;
