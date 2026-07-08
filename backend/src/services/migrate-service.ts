/**
 * 本地文件迁移到又拍云服务
 * 扫描本地 uploads 目录，上传到又拍云，并更新数据库中所有引用了本地 URL 的记录。
 */
import path from "path";
import fs from "fs";
import { Media, Post, Comment, FriendLink, User, SiteSetting } from "../models";
import { isUpyunReady, uploadToUpyun, getUpyunConfig } from "./upyun-service";

interface MigrationResult {
  totalFiles: number;
  uploaded: number;
  skipped: number;
  failed: number;
  recordsUpdated: {
    media: number;
    posts: number;
    comments: number;
    friendLinks: number;
    users: number;
    settings: number;
  };
  errors: string[];
}

/** 递归替换对象/数组中所有字符串里的 URL */
function replaceUrlsInObject(obj: any, replacements: Array<[string, string]>): any {
  if (typeof obj === "string") {
    let result = obj;
    for (const [search, replace] of replacements) {
      result = result.split(search).join(replace);
    }
    return result;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => replaceUrlsInObject(item, replacements));
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceUrlsInObject(value, replacements);
    }
    return result;
  }
  return obj;
}

/** 替换 HTML 内容中的 URL，包括 base64 编码的 embed payload */
function replaceInContent(content: string, replacements: Array<[string, string]>): string {
  let result = content;

  // 1. 处理 base64 编码的 data-payload（音乐/视频嵌入块）
  result = result.replace(/data-payload="([^"]*)"/g, (match, payload) => {
    try {
      const decoded = JSON.parse(
        decodeURIComponent(Buffer.from(payload, "base64").toString())
      );
      const updated = replaceUrlsInObject(decoded, replacements);
      const reencoded = Buffer.from(
        encodeURIComponent(JSON.stringify(updated))
      ).toString("base64");
      return `data-payload="${reencoded}"`;
    } catch {
      return match;
    }
  });

  // 2. 处理普通 URL 出现（img src、a href 等）
  for (const [search, replace] of replacements) {
    result = result.split(search).join(replace);
  }

  return result;
}

/** 对单个字符串值执行 URL 替换 */
function replaceInString(str: string, replacements: Array<[string, string]>): string {
  let result = str;
  for (const [search, replace] of replacements) {
    result = result.split(search).join(replace);
  }
  return result;
}

/** 递归扫描目录，返回所有文件的相对路径列表 */
function scanFiles(dir: string, base: string = dir): Array<{ relPath: string; fullPath: string }> {
  const results: Array<{ relPath: string; fullPath: string }> = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanFiles(fullPath, base));
    } else if (entry.isFile()) {
      const relPath = path.relative(base, fullPath).replace(/\\/g, "/");
      results.push({ relPath, fullPath });
    }
  }
  return results;
}

/** 推断文件的 MIME 类型 */
function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * 执行本地文件到又拍云的迁移
 */
export async function migrateLocalToUpyun(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalFiles: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    recordsUpdated: { media: 0, posts: 0, comments: 0, friendLinks: 0, users: 0, settings: 0 },
    errors: [],
  };

  // 1. 检查又拍云是否就绪
  const ready = await isUpyunReady();
  if (!ready) {
    result.errors.push("又拍云未启用或配置不完整");
    return result;
  }

  const cfg = await getUpyunConfig();

  // 2. 获取站点域名（用于构建绝对 URL 的搜索串）
  const setting = await SiteSetting.findByPk(1);
  const siteDomain = (setting?.domain || "").replace(/\/+$/, "");

  // 3. 扫描本地文件
  const uploadDir = path.join(__dirname, "../../public/uploads");
  if (!fs.existsSync(uploadDir)) {
    result.errors.push("本地上传目录不存在");
    return result;
  }

  const files = scanFiles(uploadDir);
  result.totalFiles = files.length;

  if (files.length === 0) {
    return result;
  }

  // 4. 上传每个文件到又拍云，构建 URL 映射
  // replacements: [搜索串, 替换串] 列表
  const replacements: Array<[string, string]> = [];

  for (const file of files) {
    const { relPath, fullPath } = file;
    try {
      const buffer = fs.readFileSync(fullPath);
      const mimeType = guessMimeType(fullPath);
      const cdnUrl = await uploadToUpyun(buffer, relPath, mimeType);

      // 构建搜索串：相对路径 + 绝对路径（https 和 http）
      const relUrl = `/uploads/${relPath}`;
      replacements.push([relUrl, cdnUrl]);
      if (siteDomain) {
        replacements.push([`${siteDomain}${relUrl}`, cdnUrl]);
        replacements.push([`${siteDomain.replace(/^https:/, "http:")}${relUrl}`, cdnUrl]);
      }

      result.uploaded++;
    } catch (err: any) {
      result.failed++;
      result.errors.push(`上传失败 ${relPath}: ${err.message}`);
    }
  }

  if (replacements.length === 0) {
    return result;
  }

  // 5. 更新 media 表
  const mediaRecords = await Media.findAll();
  for (const media of mediaRecords) {
    let changed = false;
    const newUrl = replaceInString(media.url, replacements);
    if (newUrl !== media.url) {
      media.url = newUrl;
      media.storageType = "upyun";
      changed = true;
    }
    if (media.livePhotoVideo) {
      const newVal = replaceInString(media.livePhotoVideo, replacements);
      if (newVal !== media.livePhotoVideo) {
        media.livePhotoVideo = newVal;
        changed = true;
      }
    }
    if (media.livePhotoImage) {
      const newVal = replaceInString(media.livePhotoImage, replacements);
      if (newVal !== media.livePhotoImage) {
        media.livePhotoImage = newVal;
        changed = true;
      }
    }
    // 如果 URL 已是又拍云但 storage_type 还是 local，也更新
    if (!changed && media.url.includes(cfg.domain) && media.storageType === "local") {
      media.storageType = "upyun";
      changed = true;
    }
    if (changed) {
      await media.save();
      result.recordsUpdated.media++;
    }
  }

  // 6. 更新 posts 表
  const posts = await Post.findAll();
  for (const post of posts) {
    let changed = false;
    const updates: Record<string, any> = {};

    // cover (string)
    const newCover = replaceInString(post.cover, replacements);
    if (newCover !== post.cover) {
      updates.cover = newCover;
      changed = true;
    }

    // adAvatar (string)
    const newAvatar = replaceInString(post.adAvatar, replacements);
    if (newAvatar !== post.adAvatar) {
      updates.adAvatar = newAvatar;
      changed = true;
    }

    // content (HTML with possible base64 payloads)
    const newContent = replaceInContent(post.content, replacements);
    if (newContent !== post.content) {
      updates.content = newContent;
      changed = true;
    }

    // images (JSON array)
    if (post.images && Array.isArray(post.images) && post.images.length > 0) {
      const newImages = replaceUrlsInObject(post.images, replacements);
      if (JSON.stringify(newImages) !== JSON.stringify(post.images)) {
        updates.images = newImages;
        changed = true;
      }
    }

    // music (JSON)
    if (post.music) {
      const newMusic = replaceUrlsInObject(post.music, replacements);
      if (JSON.stringify(newMusic) !== JSON.stringify(post.music)) {
        updates.music = newMusic;
        changed = true;
      }
    }

    // linkCard (JSON)
    if (post.linkCard) {
      const newLinkCard = replaceUrlsInObject(post.linkCard, replacements);
      if (JSON.stringify(newLinkCard) !== JSON.stringify(post.linkCard)) {
        updates.linkCard = newLinkCard;
        changed = true;
      }
    }

    // video (JSON)
    if (post.video) {
      const newVideo = replaceUrlsInObject(post.video, replacements);
      if (JSON.stringify(newVideo) !== JSON.stringify(post.video)) {
        updates.video = newVideo;
        changed = true;
      }
    }

    if (changed) {
      await post.update(updates);
      result.recordsUpdated.posts++;
    }
  }

  // 7. 更新 comments 表
  const comments = await Comment.findAll();
  for (const comment of comments) {
    const newContent = replaceInString(comment.content, replacements);
    if (newContent !== comment.content) {
      await comment.update({ content: newContent });
      result.recordsUpdated.comments++;
    }
  }

  // 7b. 更新 friend_links 表
  const friendLinks = await FriendLink.findAll();
  for (const link of friendLinks) {
    const newAvatar = replaceInString(link.avatar, replacements);
    if (newAvatar !== link.avatar) {
      await link.update({ avatar: newAvatar });
      result.recordsUpdated.friendLinks++;
    }
  }

  // 8. 更新 users 表
  const users = await User.findAll();
  for (const user of users) {
    let changed = false;
    const updates: Record<string, any> = {};

    const newAvatar = replaceInString(user.avatar, replacements);
    if (newAvatar !== user.avatar) {
      updates.avatar = newAvatar;
      changed = true;
    }

    const newCover = replaceInString(user.cover, replacements);
    if (newCover !== user.cover) {
      updates.cover = newCover;
      changed = true;
    }

    if (changed) {
      await user.update(updates);
      result.recordsUpdated.users++;
    }
  }

  // 9. 更新 site_settings 表
  if (setting) {
    let changed = false;
    const updates: Record<string, any> = {};

    const newFavicon = replaceInString(setting.faviconUrl, replacements);
    if (newFavicon !== setting.faviconUrl) {
      updates.faviconUrl = newFavicon;
      changed = true;
    }

    const newOgImage = replaceInString(setting.ogImage, replacements);
    if (newOgImage !== setting.ogImage) {
      updates.ogImage = newOgImage;
      changed = true;
    }

    // background_images (JSON array stored as text)
    if (setting.backgroundImages) {
      try {
        const bgImages = JSON.parse(setting.backgroundImages);
        const newBgImages = replaceUrlsInObject(bgImages, replacements);
        const newBgStr = JSON.stringify(newBgImages);
        if (newBgStr !== setting.backgroundImages) {
          updates.backgroundImages = newBgStr;
          changed = true;
        }
      } catch {
        // ignore parse errors
      }
    }

    if (changed) {
      await setting.update(updates);
      result.recordsUpdated.settings++;
    }
  }

  result.skipped = result.totalFiles - result.uploaded - result.failed;
  return result;
}
