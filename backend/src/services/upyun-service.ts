/**
 * 又拍云存储服务
 * 使用 REST API + Basic Auth 进行文件上传/删除操作
 * 文档：https://help.upyun.com/knowledge-base/rest_api/
 */
import axios from "axios";
import { SiteSetting } from "../models";

export interface UpyunConfig {
  enabled: boolean;
  bucket: string;
  operator: string;
  password: string;
  domain: string;
  path: string;
}

/** 从数据库读取又拍云配置 */
export async function getUpyunConfig(): Promise<UpyunConfig> {
  const setting = await SiteSetting.findByPk(1);
  if (!setting) {
    return { enabled: false, bucket: "", operator: "", password: "", domain: "", path: "" };
  }
  return {
    enabled: !!setting.upyunEnabled,
    bucket: setting.upyunBucket || "",
    operator: setting.upyunOperator || "",
    password: setting.upyunPassword || "",
    domain: (setting.upyunDomain || "").replace(/\/+$/, ""),
    path: (setting.upyunPath || "").replace(/^\/+|\/+$/g, ""),
  };
}

/** 判断又拍云是否已正确配置（启用 + 必填字段齐全） */
export async function isUpyunReady(): Promise<boolean> {
  const cfg = await getUpyunConfig();
  return cfg.enabled && !!cfg.bucket && !!cfg.operator && !!cfg.password && !!cfg.domain;
}

/** 生成又拍云 REST API 的完整 URL */
function buildApiUrl(bucket: string, filePath: string): string {
  const cleanPath = filePath.replace(/^\/+/, "");
  return `https://v0.api.upyun.com/${bucket}/${cleanPath}`;
}

/** 生成 Basic Auth header 值 */
function buildAuth(operator: string, password: string): string {
  return `Basic ${Buffer.from(`${operator}:${password}`).toString("base64")}`;
}

/** 构建文件的访问 URL（CDN 域名 + 路径） */
export function buildAccessUrl(domain: string, pathPrefix: string, filename: string): string {
  const cleanDomain = domain.replace(/\/+$/, "");
  const cleanPath = pathPrefix.replace(/^\/+|\/+$/g, "");
  const cleanFile = filename.replace(/^\/+/, "");
  return cleanPath
    ? `${cleanDomain}/${cleanPath}/${cleanFile}`
    : `${cleanDomain}/${cleanFile}`;
}

/**
 * 上传文件到又拍云
 * @param buffer 文件内容
 * @param remotePath 远程路径（不含 bucket，如 media/2024/01/xxx.jpg）
 * @param mimeType 文件 MIME 类型
 * @returns 访问 URL
 */
export async function uploadToUpyun(
  buffer: Buffer,
  remotePath: string,
  mimeType: string
): Promise<string> {
  const cfg = await getUpyunConfig();
  if (!cfg.enabled) {
    throw new Error("又拍云存储未启用");
  }
  if (!cfg.bucket || !cfg.operator || !cfg.password || !cfg.domain) {
    throw new Error("又拍云配置不完整");
  }

  const apiUrl = buildApiUrl(cfg.bucket, remotePath);
  const auth = buildAuth(cfg.operator, cfg.password);

  try {
    const resp = await axios.put(apiUrl, buffer, {
      headers: {
        Authorization: auth,
        "Content-Type": mimeType || "application/octet-stream",
      },
      timeout: 180000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (resp.status !== 200) {
      const msg = resp.data?.msg || resp.data?.message || `HTTP ${resp.status}`;
      throw new Error(`又拍云上传失败: ${msg}`);
    }

    return buildAccessUrl(cfg.domain, cfg.path, remotePath);
  } catch (err: any) {
    if (err.message?.startsWith("又拍云")) throw err;
    if (err.code === "ECONNABORTED") {
      throw new Error("又拍云上传超时，请稍后重试");
    }
    throw new Error(`又拍云上传失败: ${err.message || "网络错误"}`);
  }
}

/**
 * 从又拍云删除文件
 * @param remotePath 远程路径（不含 bucket）
 */
export async function deleteFromUpyun(remotePath: string): Promise<boolean> {
  const cfg = await getUpyunConfig();
  if (!cfg.enabled || !cfg.bucket || !cfg.operator || !cfg.password) {
    return false;
  }

  const apiUrl = buildApiUrl(cfg.bucket, remotePath);
  const auth = buildAuth(cfg.operator, cfg.password);

  try {
    const resp = await axios.delete(apiUrl, {
      headers: { Authorization: auth },
      timeout: 15000,
      validateStatus: () => true,
    });
    return resp.status === 200 || resp.status === 404;
  } catch {
    return false;
  }
}

/**
 * 从又拍云访问 URL 中提取远程路径（用于删除）
 * 例：https://cdn.example.com/media/xxx.jpg → media/xxx.jpg
 */
export function extractRemotePath(url: string, domain: string, pathPrefix: string): string {
  const cleanDomain = domain.replace(/\/+$/, "");
  const cleanPath = pathPrefix.replace(/^\/+|\/+$/g, "");
  const prefix = cleanPath ? `${cleanDomain}/${cleanPath}/` : `${cleanDomain}/`;
  if (url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }
  // 回退：尝试从完整 URL 中提取路径部分
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return "";
  }
}
