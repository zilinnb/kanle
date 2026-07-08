/**
 * 上传路由
 * 图片/音频/视频上传，自动根据又拍云配置选择存储方式。
 * 所有上传的文件都会记录到 Media 表（媒体库）。
 * 又拍云启用时返回 CDN 绝对 URL，未启用时返回本地相对路径。
 */
import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";
import { Media, User } from "../models";
import {
  isUpyunReady,
  uploadToUpyun,
  getUpyunConfig,
} from "../services/upyun-service";

const router = Router();

// 本地上传目录
const uploadDir = path.join(__dirname, "../../public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// memoryStorage：由路由处理器决定存储位置
const storage = multer.memoryStorage();

const imageUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("仅支持 jpg/png/gif/webp 图片"));
    }
  },
});

const audioUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/ogg",
      "audio/aac",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("仅支持 mp3/wav/ogg/aac 音频"));
    }
  },
});

const videoUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["video/quicktime", "video/mp4", "video/webm"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("仅支持 mov/mp4/webm 视频"));
    }
  },
});

/** 生成本地存储路径 */
function buildLocalPath(originalName: string): { url: string; fullPath: string } {
  const ext = path.extname(originalName) || "";
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const subdir = path.join(uploadDir, year, month);
  if (!fs.existsSync(subdir)) {
    fs.mkdirSync(subdir, { recursive: true });
  }
  const filename = `${uuidv4()}${ext}`;
  return {
    url: `/uploads/${year}/${month}/${filename}`,
    fullPath: path.join(subdir, filename),
  };
}

/** 生成又拍云远程路径 */
function buildRemotePath(pathPrefix: string, originalName: string): string {
  const ext = path.extname(originalName) || "";
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const cleanPrefix = pathPrefix.replace(/^\/+|\/+$/g, "");
  const fileName = `${uuidv4()}${ext}`;
  return cleanPrefix
    ? `${cleanPrefix}/${year}/${month}/${fileName}`
    : `${year}/${month}/${fileName}`;
}

/** 统一的文件存储处理：又拍云优先，本地回退 */
async function storeFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  uploaderId: string
): Promise<{ url: string; storageType: "upyun" | "local"; mediaId: string }> {
  let url: string;
  let storageType: "upyun" | "local";

  const upyunReady = await isUpyunReady();

  if (upyunReady) {
    try {
      const cfg = await getUpyunConfig();
      const remotePath = buildRemotePath(cfg.path, originalName);
      url = await uploadToUpyun(buffer, remotePath, mimeType);
      storageType = "upyun";
    } catch (err: any) {
      // 又拍云上传失败，回退到本地
      console.error(`[upload] 又拍云上传失败，回退本地: ${err.message}`);
      const local = buildLocalPath(originalName);
      fs.writeFileSync(local.fullPath, buffer);
      url = local.url;
      storageType = "local";
    }
  } else {
    const local = buildLocalPath(originalName);
    fs.writeFileSync(local.fullPath, buffer);
    url = local.url;
    storageType = "local";
  }

  // 记录到媒体库
  const media = await Media.create({
    filename: originalName,
    url,
    storageType,
    mimeType,
    size: buffer.length,
    uploaderId,
  });

  return { url, storageType, mediaId: media.id };
}

// POST /api/upload - upload an image (admin only)
router.post(
  "/",
  authenticate,
  requireAdmin,
  imageUpload.single("image"),
  async (req: AuthRequest, res) => {
    if (!req.file) {
      res.status(400).json({ message: "没有上传文件" });
      return;
    }
    try {
      const { url } = await storeFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.id
      );
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "上传失败" });
    }
  }
);

// POST /api/upload/audio - upload an audio file (admin only)
router.post(
  "/audio",
  authenticate,
  requireAdmin,
  audioUpload.single("audio"),
  async (req: AuthRequest, res) => {
    if (!req.file) {
      res.status(400).json({ message: "没有上传文件" });
      return;
    }
    try {
      const { url } = await storeFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.id
      );
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "上传失败" });
    }
  }
);

// POST /api/upload/video - upload a video file (admin only)
router.post(
  "/video",
  authenticate,
  requireAdmin,
  videoUpload.single("video"),
  async (req: AuthRequest, res) => {
    if (!req.file) {
      res.status(400).json({ message: "没有上传文件" });
      return;
    }
    try {
      const { url } = await storeFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.id
      );
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "上传失败" });
    }
  }
);

// POST /api/upload/test-upyun - test Upyun connection (admin only)
router.post(
  "/test-upyun",
  authenticate,
  requireAdmin,
  async (_req: AuthRequest, res) => {
    try {
      const ready = await isUpyunReady();
      if (!ready) {
        res.status(400).json({
          success: false,
          message: "又拍云未启用或配置不完整（需要启用 + bucket + 操作员 + 密码 + 域名）",
        });
        return;
      }
      const cfg = await getUpyunConfig();
      const testBuffer = Buffer.from("upyun-connection-test");
      const testPath = `test/conn-${Date.now()}.txt`;
      const url = await uploadToUpyun(testBuffer, testPath, "text/plain");
      res.json({
        success: true,
        message: "连接成功，文件已上传到又拍云",
        url,
        https: url.startsWith("https://"),
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message || "又拍云连接失败",
      });
    }
  }
);

export default router;
