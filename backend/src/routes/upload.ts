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
import { migrateLocalToUpyun } from "../services/migrate-service";
import { extractMotionPhoto } from "../services/motion-photo";

const router = Router();

// 本地上传目录
const uploadDir = path.join(__dirname, "../../public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// memoryStorage：由路由处理器决定存储位置
const storage = multer.memoryStorage();

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg"];
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const VIDEO_MIMES = ["video/quicktime", "video/mp4", "video/webm", "video/3gpp", "video/3gp", "video/x-m4v"];
const VIDEO_EXTS = [".mp4", ".mov", ".webm", ".3gp", ".m4v"];

const imageUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (IMAGE_MIMES.includes(file.mimetype) || IMAGE_EXTS.includes(ext)) {
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
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (VIDEO_MIMES.includes(file.mimetype) || VIDEO_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("仅支持 mov/mp4/webm 视频"));
    }
  },
});

// 动态照片（Motion Photo）：单个 JPEG 内嵌 MP4，文件可能较大
const motionPhotoUpload = multer({
  storage,
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const isImage =
      IMAGE_MIMES.includes(file.mimetype) || IMAGE_EXTS.includes(ext);
    if (isImage) {
      cb(null, true);
    } else {
      cb(new Error("动态照片需为 JPEG 格式"));
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

// POST /api/upload/motion-photo - upload a motion photo (single JPEG with embedded MP4)
// 自动拆分为图片+视频，返回配对 URL。如果文件不含嵌入视频则降级为普通图片。
router.post(
  "/motion-photo",
  authenticate,
  requireAdmin,
  motionPhotoUpload.single("file"),
  async (req: AuthRequest, res) => {
    if (!req.file) {
      res.status(400).json({ message: "没有上传文件" });
      return;
    }
    try {
      const extracted = extractMotionPhoto(req.file.buffer);

      if (extracted) {
        // 成功提取：分别存储图片和视频
        const imageName = `${path.basename(
          req.file.originalname,
          path.extname(req.file.originalname)
        )}.jpg`;
        const videoName = `${path.basename(
          req.file.originalname,
          path.extname(req.file.originalname)
        )}.mp4`;

        const [imageResult, videoResult] = await Promise.all([
          storeFile(extracted.image, imageName, extracted.imageMime, req.user!.id),
          storeFile(extracted.video, videoName, extracted.videoMime, req.user!.id),
        ]);

        res.json({
          image: imageResult.url,
          video: videoResult.url,
          isLivePhoto: true,
        });
      } else {
        // 无嵌入视频：降级为普通图片
        const { url } = await storeFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          req.user!.id
        );
        res.json({
          image: url,
          video: null,
          isLivePhoto: false,
        });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message || "动态照片处理失败" });
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

// POST /api/upload/migrate-to-upyun - 迁移本地文件到又拍云（管理员）
router.post(
  "/migrate-to-upyun",
  authenticate,
  requireAdmin,
  async (_req: AuthRequest, res) => {
    try {
      const result = await migrateLocalToUpyun();
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || "迁移失败",
      });
    }
  }
);

export default router;
