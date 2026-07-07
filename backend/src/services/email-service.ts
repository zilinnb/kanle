import nodemailer from "nodemailer";
import crypto from "crypto";
import { SiteSetting, User, Post } from "../models";
import { replaceEmojiShortcodes } from "../utils/emoji";

/** 生成 Cravatar 头像 URL */
export function avatarUrl(email: string, size: number = 80): string {
  const hash = crypto
    .createHash("md5")
    .update((email || "").trim().toLowerCase())
    .digest("hex");
  const defaultAvatar = encodeURIComponent("https://kanle.net/default-avatar.jpg");
  return `https://cravatar.com/avatar/${hash}?s=${size}&d=${defaultAvatar}&r=g`;
}

/**
 * 默认邮件模板 — 微信聊天对话样式
 *
 * 支持的变量占位符：
 *   {{siteName}}        网站名称
 *   {{actorNickname}}   评论者昵称
 *   {{actorAvatar}}     评论者头像 URL
 *   {{actionText}}      操作描述（"给你发了新评论" / "回复了你的评论"）
 *   {{commentContent}}  评论内容
 *   {{ownerNickname}}   博主昵称
 *   {{ownerAvatar}}     博主头像 URL
 *   {{ownerMessage}}    博主自动回复语
 *   {{postPreview}}     动态内容预览
 *   {{postUrl}}         动态链接
 */
export const DEFAULT_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{actorNickname}}</title>
</head>
<body style="margin:0;padding:0;background:#ededed;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ededed;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:360px;">

          <!-- 顶栏：微信聊天页风格，只显示昵称 -->
          <tr>
            <td style="background:#f7f7f7;border-bottom:1px solid #d6d6d6;padding:15px 16px;text-align:center;">
              <div style="font-size:17px;font-weight:600;color:#1a1a1a;">{{actorNickname}}</div>
            </td>
          </tr>

          <!-- 聊天区域 -->
          <tr>
            <td style="background:#ededed;padding:26px 14px 18px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">

                <!-- 对方消息气泡 -->
                <tr>
                  <td style="padding-bottom:6px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="40" valign="top" style="vertical-align:top;">
                          <img src="{{actorAvatar}}" width="40" height="40" style="border-radius:4px;display:block;" alt="">
                        </td>
                        <td valign="top" style="vertical-align:top;padding-left:10px;">
                          <table cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background:#ffffff;border-radius:4px;padding:10px 13px;font-size:15px;color:#1a1a1a;line-height:1.5;word-break:break-word;max-width:230px;">
                                {{commentContent}}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- 动态预览卡片 -->
          <tr>
            <td style="padding:0 14px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f7f7f7;border-radius:8px;">
                <tr>
                  <td style="padding:13px 14px;">
                    <div style="font-size:13px;color:#666;line-height:1.5;word-break:break-word;">{{postPreview}}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 查看回复按钮 -->
          <tr>
            <td style="padding:26px 14px 8px;text-align:center;">
              <a href="{{postUrl}}" style="display:inline-block;background:#07c160;color:#ffffff;text-decoration:none;padding:11px 36px;border-radius:4px;font-size:15px;font-weight:500;">查看回复</a>
            </td>
          </tr>

          <!-- 底部提示 -->
          <tr>
            <td style="padding:0 14px 30px;text-align:center;">
              <div style="font-size:11px;color:#b2b2b2;line-height:1.6;">点击上方按钮跳转至动态页面查看并回复</div>
              <div style="font-size:11px;color:#b2b2b2;margin-top:2px;">来自 {{siteName}}</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** 渲染模板：替换所有 {{变量}} 占位符 */
function renderTemplate(templateHtml: string, vars: Record<string, string>): string {
  let html = templateHtml;
  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return html;
}

/** HTML 转义，防止注入 */
function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface CommentNotifyData {
  actorNickname: string;
  actorEmail: string;
  content: string;
  replyTo?: string | null;
  replyToEmail?: string | null;
  postContent: string;
  postId: string;
  commentId: string;
}

/** 创建 nodemailer transporter */
async function createTransporter(): Promise<{
  transporter: nodemailer.Transporter;
  from: string;
  to: string;
} | null> {
  const setting = await SiteSetting.findByPk(1);
  if (!setting || !setting.emailNotifyEnabled) return null;
  if (!setting.smtpHost || !setting.smtpUser || !setting.smtpPass) return null;

  const owner = await User.findOne({ where: { role: "admin" } });
  if (!owner) return null;

  const toEmail = setting.notifyEmail || owner.email;
  if (!toEmail) return null;

  const transporter = nodemailer.createTransport({
    host: setting.smtpHost,
    port: setting.smtpPort,
    secure: setting.smtpSecure,
    auth: { user: setting.smtpUser, pass: setting.smtpPass },
  });

  const from = setting.smtpFrom || setting.smtpUser;
  return { transporter, from, to: toEmail };
}

/** 构建邮件变量 */
async function buildEmailVars(data: CommentNotifyData): Promise<{
  vars: Record<string, string>;
  subject: string;
}> {
  const setting = await SiteSetting.findByPk(1);
  const owner = await User.findOne({ where: { role: "admin" } });

  const siteName = setting?.siteName || "朋友圈博客";
  const domain = setting?.domain || "";
  // 查找动态的 shortId 和 type 用于构造链接（文章用 /articles/{id}，动态用 /moments/{shortId}）
  const post = await Post.findByPk(data.postId, { attributes: ["shortId", "type", "id", "title"] });
  const postIdForUrl = post?.shortId || data.postId;
  const postPath = post?.type === "article"
    ? `/articles/${post.id}`
    : `/moments/${postIdForUrl}`;
  const postUrl = domain ? `${domain}${postPath}#comment-${data.commentId}` : "#";

  const isReply = !!data.replyTo;
  const actionText = isReply ? "回复了你的评论" : "给你发了新评论";
  const ownerMessage = isReply
    ? `收到啦，已查看 ${data.actorNickname} 的回复 ✓`
    : `感谢 ${data.actorNickname} 的评论，我会尽快回复～`;

  const ownerAvatar = owner?.avatar
    ? owner.avatar.startsWith("http")
      ? owner.avatar
      : `${domain}${owner.avatar}`
    : avatarUrl(owner?.email || "", 80);

  const vars: Record<string, string> = {
    siteName: escapeHtml(siteName),
    actorNickname: escapeHtml(data.actorNickname),
    actorAvatar: avatarUrl(data.actorEmail, 80),
    actionText,
    commentContent: replaceEmojiShortcodes(escapeHtml(data.content), domain),
    ownerNickname: escapeHtml(owner?.nickname || "博主"),
    ownerAvatar,
    ownerMessage: escapeHtml(ownerMessage),
    postPreview: escapeHtml(
      (post?.type === "article" && post?.title
        ? post.title
        : data.postContent
      ).replace(/\s+/g, " ").trim().slice(0, 120)
    ),
    postUrl,
  };

  const subject = `${data.actorNickname} ${actionText} - ${siteName}`;
  return { vars, subject };
}

/**
 * 发送评论/回复邮件通知
 * 通知规则：
 *   1. 博主：评论者不是博主本人时通知（博主评论自己的文章不发给自己）
 *   2. 被回复者：回复场景下，通知被回复的人（排除自己回复自己、排除博主避免重复）
 * 例：A(博主) 发文章 → B 评论 → A 收通知；C 回复 B → A 和 B 都收通知
 */
export async function sendCommentNotification(data: CommentNotifyData): Promise<void> {
  try {
    const ctx = await createTransporter();
    if (!ctx) return;

    const { vars, subject } = await buildEmailVars(data);
    const setting = await SiteSetting.findByPk(1);
    const templateHtml = setting?.emailTemplate || DEFAULT_EMAIL_TEMPLATE;
    const html = renderTemplate(templateHtml, vars);

    const owner = await User.findOne({ where: { role: "admin" } });
    const ownerEmail = owner?.email?.toLowerCase() || "";
    const actorEmail = data.actorEmail?.toLowerCase() || "";
    const replyToEmail = data.replyToEmail?.toLowerCase() || "";

    // 1. 通知博主（评论者自己是博主时跳过，避免自己通知自己）
    if (actorEmail && actorEmail !== ownerEmail) {
      await ctx.transporter.sendMail({
        from: ctx.from,
        to: ctx.to,
        subject,
        html,
      });
      console.log(`[email] 博主通知已发送至 ${ctx.to}: ${subject}`);
    }

    // 2. 通知被回复者（回复场景）：排除自己回复自己、排除博主（已在上面通知过）
    if (replyToEmail && replyToEmail !== actorEmail && replyToEmail !== ownerEmail) {
      await ctx.transporter.sendMail({
        from: ctx.from,
        to: data.replyToEmail!,
        subject,
        html,
      });
      console.log(`[email] 被回复者通知已发送至 ${data.replyToEmail}: ${subject}`);
    }
  } catch (err) {
    console.error("[email] 发送评论通知失败:", err);
  }
}

/**
 * 发送测试邮件
 * @returns 发送结果
 */
export async function sendTestEmail(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const ctx = await createTransporter();
    if (!ctx) {
      return { success: false, message: "SMTP 配置不完整或邮件通知未开启" };
    }

    const setting = await SiteSetting.findByPk(1);
    const owner = await User.findOne({ where: { role: "admin" } });
    const siteName = setting?.siteName || "朋友圈博客";
    const domain = setting?.domain || "";

    const vars: Record<string, string> = {
      siteName: escapeHtml(siteName),
      actorNickname: "测试用户",
      actorAvatar: avatarUrl("test@example.com", 80),
      actionText: "这是一封测试邮件",
      commentContent: "你好！这是一封测试邮件，用于验证 SMTP 配置是否正确。",
      ownerNickname: escapeHtml(owner?.nickname || "博主"),
      ownerAvatar: owner?.avatar
        ? owner.avatar.startsWith("http")
          ? owner.avatar
          : `${domain}${owner.avatar}`
        : avatarUrl(owner?.email || "", 80),
      ownerMessage: "测试邮件发送成功，SMTP 配置正常 ✓",
      postPreview: "测试动态内容预览",
      postUrl: domain || "#",
    };

    const templateHtml = setting?.emailTemplate || DEFAULT_EMAIL_TEMPLATE;
    const html = renderTemplate(templateHtml, vars);
    const subject = `测试邮件 - ${siteName}`;

    await ctx.transporter.sendMail({ from: ctx.from, to: ctx.to, subject, html });
    return { success: true, message: `测试邮件已发送至 ${ctx.to}` };
  } catch (err) {
    console.error("[email] 测试邮件发送失败:", err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "发送失败",
    };
  }
}
