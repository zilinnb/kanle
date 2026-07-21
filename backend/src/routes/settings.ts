import { Router, Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { SiteSetting, User } from "../models";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";
import { sendTestEmail } from "../services/email-service";

const router = Router();

/** Ensure a single row (id=1) exists; create with defaults if missing. */
async function ensureSetting() {
  const [setting, created] = await SiteSetting.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1 },
  });
  return setting;
}

// GET /api/settings - public site settings (for SEO/metadata, no sensitive data)
router.get("/", async (_req: Request, res: Response) => {
  const setting = await ensureSetting();
  const admin = await User.findOne({ where: { role: "admin" }, attributes: ["cover"] });
  res.json({
    siteName: setting.siteName,
    description: setting.description,
    keywords: setting.keywords,
    domain: setting.domain,
    beian: setting.beian,
    beianUrl: setting.beianUrl,
    faviconUrl: setting.faviconUrl,
    ogImage: setting.ogImage,
    musicUrl: setting.musicUrl,
    musicId: setting.musicId,
    musicSource: setting.musicSource,
    playlistId: setting.playlistId,
    backgroundImages: setting.backgroundImages,
    socialLinks: setting.socialLinks,
    postCollapseLength: setting.postCollapseLength,
    fontUrl: setting.fontUrl,
    darkModeEnabled: setting.darkModeEnabled,
    darkModeStartTime: setting.darkModeStartTime,
    darkModeEndTime: setting.darkModeEndTime,
    adOnArchives: setting.adOnArchives,
    rssEnabled: setting.rssEnabled,
    rssIncludeMoments: setting.rssIncludeMoments,
    doubanId: setting.doubanId,
    musicAutoplay: setting.musicAutoplay,
    cdnProxyUrl: setting.cdnProxyUrl,
    analyticsCode: setting.analyticsCode,
    defaultCover: admin?.cover || "",
  });
});

// PUT /api/admin/settings - update site settings (admin only)
router.put(
  "/",
  authenticate,
  requireAdmin,
  [
    body("siteName").optional().trim().isLength({ max: 100 }),
    body("description").optional().trim().isLength({ max: 500 }),
    body("keywords").optional().trim().isLength({ max: 255 }),
    body("domain").optional().trim().isLength({ max: 255 }),
    body("beian").optional().trim().isLength({ max: 100 }),
    body("beianUrl").optional().trim().isLength({ max: 500 }),
    body("faviconUrl").optional().trim().isLength({ max: 500 }),
    body("ogImage").optional().trim().isLength({ max: 500 }),
    body("musicUrl").optional().trim().isLength({ max: 500 }),
    body("musicId").optional().trim().isLength({ max: 50 }),
    body("musicSource").optional().trim().isLength({ max: 20 }),
    body("playlistId").optional().trim().isLength({ max: 50 }),
    body("backgroundImages").optional().isString(),
    body("socialLinks").optional().isString(),
    body("postCollapseLength").optional().isInt({ min: 0, max: 100000 }),
    body("fontUrl").optional().trim().isLength({ max: 500 }),
    body("darkModeEnabled").optional().isBoolean(),
    body("darkModeStartTime").optional().matches(/^\d{2}:\d{2}$/),
    body("darkModeEndTime").optional().matches(/^\d{2}:\d{2}$/),
    body("adOnArchives").optional().isBoolean(),
    body("rssEnabled").optional().isBoolean(),
    body("rssIncludeMoments").optional().isBoolean(),
    body("doubanId").optional().trim().isLength({ max: 100 }),
    body("musicAutoplay").optional().isBoolean(),
    body("cdnProxyUrl").optional().trim().isLength({ max: 500 }),
    body("analyticsCode").optional().isString(),
    // 51.la OpenAPI config
    body("laAccessKey").optional().trim().isLength({ max: 255 }),
    body("laSecretKey").optional().trim().isLength({ max: 255 }),
    body("laMaskId").optional().trim().isLength({ max: 100 }),
    // Email config
    body("emailNotifyEnabled").optional().isBoolean(),
    body("notifyEmail").optional().trim().isLength({ max: 255 }),
    body("smtpHost").optional().trim().isLength({ max: 255 }),
    body("smtpPort").optional().isInt({ min: 1, max: 65535 }),
    body("smtpSecure").optional().isBoolean(),
    body("smtpUser").optional().trim().isLength({ max: 255 }),
    body("smtpPass").optional().trim().isLength({ max: 255 }),
    body("smtpFrom").optional().trim().isLength({ max: 255 }),
    body("emailTemplate").optional().isString(),
    // Upyun config
    body("upyunEnabled").optional().isBoolean(),
    body("upyunBucket").optional().trim().isLength({ max: 100 }),
    body("upyunOperator").optional().trim().isLength({ max: 100 }),
    body("upyunPassword").optional().trim().isLength({ max: 255 }),
    body("upyunDomain").optional().trim().isLength({ max: 255 }),
    body("upyunPath").optional().trim().isLength({ max: 255 }),
    // Amap config
    body("amapKey").optional().trim().isLength({ max: 255 }),
    body("amapJsKey").optional().trim().isLength({ max: 255 }),
    body("amapSecurityJsCode").optional().trim().isLength({ max: 255 }),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const setting = await ensureSetting();
    await setting.update({
      siteName: req.body.siteName ?? setting.siteName,
      description: req.body.description ?? setting.description,
      keywords: req.body.keywords ?? setting.keywords,
      domain: req.body.domain ?? setting.domain,
      beian: req.body.beian ?? setting.beian,
      beianUrl: req.body.beianUrl ?? setting.beianUrl,
      faviconUrl: req.body.faviconUrl ?? setting.faviconUrl,
      ogImage: req.body.ogImage ?? setting.ogImage,
      musicUrl: req.body.musicUrl ?? setting.musicUrl,
      musicId: req.body.musicId ?? setting.musicId,
      musicSource: req.body.musicSource ?? setting.musicSource,
      playlistId: req.body.playlistId ?? setting.playlistId,
      backgroundImages: req.body.backgroundImages ?? setting.backgroundImages,
      socialLinks: req.body.socialLinks ?? setting.socialLinks,
      postCollapseLength: req.body.postCollapseLength ?? setting.postCollapseLength,
      fontUrl: req.body.fontUrl ?? setting.fontUrl,
      darkModeEnabled: req.body.darkModeEnabled ?? setting.darkModeEnabled,
      darkModeStartTime: req.body.darkModeStartTime ?? setting.darkModeStartTime,
      darkModeEndTime: req.body.darkModeEndTime ?? setting.darkModeEndTime,
      adOnArchives: req.body.adOnArchives ?? setting.adOnArchives,
      rssEnabled: req.body.rssEnabled ?? setting.rssEnabled,
      rssIncludeMoments: req.body.rssIncludeMoments ?? setting.rssIncludeMoments,
      doubanId: req.body.doubanId ?? setting.doubanId,
      musicAutoplay: req.body.musicAutoplay ?? setting.musicAutoplay,
      cdnProxyUrl: req.body.cdnProxyUrl ?? setting.cdnProxyUrl,
      analyticsCode: req.body.analyticsCode ?? setting.analyticsCode,
      laAccessKey: req.body.laAccessKey ?? setting.laAccessKey,
      laSecretKey: req.body.laSecretKey ?? setting.laSecretKey,
      laMaskId: req.body.laMaskId ?? setting.laMaskId,
      emailNotifyEnabled: req.body.emailNotifyEnabled ?? setting.emailNotifyEnabled,
      notifyEmail: req.body.notifyEmail ?? setting.notifyEmail,
      smtpHost: req.body.smtpHost ?? setting.smtpHost,
      smtpPort: req.body.smtpPort ?? setting.smtpPort,
      smtpSecure: req.body.smtpSecure ?? setting.smtpSecure,
      smtpUser: req.body.smtpUser ?? setting.smtpUser,
      smtpPass: req.body.smtpPass ?? setting.smtpPass,
      smtpFrom: req.body.smtpFrom ?? setting.smtpFrom,
      emailTemplate: req.body.emailTemplate ?? setting.emailTemplate,
      upyunEnabled: req.body.upyunEnabled ?? setting.upyunEnabled,
      upyunBucket: req.body.upyunBucket ?? setting.upyunBucket,
      upyunOperator: req.body.upyunOperator ?? setting.upyunOperator,
      upyunPassword: req.body.upyunPassword ?? setting.upyunPassword,
      upyunDomain: req.body.upyunDomain ?? setting.upyunDomain,
      upyunPath: req.body.upyunPath ?? setting.upyunPath,
      amapKey: req.body.amapKey ?? setting.amapKey,
      amapJsKey: req.body.amapJsKey ?? setting.amapJsKey,
      amapSecurityJsCode: req.body.amapSecurityJsCode ?? setting.amapSecurityJsCode,
    });

    res.json({
      siteName: setting.siteName,
      description: setting.description,
      keywords: setting.keywords,
      domain: setting.domain,
      beian: setting.beian,
      beianUrl: setting.beianUrl,
      faviconUrl: setting.faviconUrl,
      ogImage: setting.ogImage,
      musicUrl: setting.musicUrl,
      musicId: setting.musicId,
      musicSource: setting.musicSource,
      playlistId: setting.playlistId,
      backgroundImages: setting.backgroundImages,
      socialLinks: setting.socialLinks,
      postCollapseLength: setting.postCollapseLength,
      fontUrl: setting.fontUrl,
      darkModeEnabled: setting.darkModeEnabled,
      darkModeStartTime: setting.darkModeStartTime,
      darkModeEndTime: setting.darkModeEndTime,
      adOnArchives: setting.adOnArchives,
      rssEnabled: setting.rssEnabled,
      rssIncludeMoments: setting.rssIncludeMoments,
      doubanId: setting.doubanId,
      musicAutoplay: setting.musicAutoplay,
      cdnProxyUrl: setting.cdnProxyUrl,
      analyticsCode: setting.analyticsCode,
      laAccessKey: setting.laAccessKey,
      laSecretKey: setting.laSecretKey,
      laMaskId: setting.laMaskId,
    });
  }
);

// GET /api/settings/email-config - email config (admin only, includes smtpPass)
router.get("/email-config", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const setting = await ensureSetting();
  res.json({
    emailNotifyEnabled: setting.emailNotifyEnabled,
    smtpHost: setting.smtpHost,
    smtpPort: setting.smtpPort,
    smtpSecure: setting.smtpSecure,
    smtpUser: setting.smtpUser,
    smtpPass: setting.smtpPass,
    smtpFrom: setting.smtpFrom,
    notifyEmail: setting.notifyEmail,
    emailTemplate: setting.emailTemplate,
  });
});

// GET /api/settings/upyun-config - upyun config (admin only, includes upyunPassword)
router.get("/upyun-config", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const setting = await ensureSetting();
  res.json({
    upyunEnabled: setting.upyunEnabled,
    upyunBucket: setting.upyunBucket,
    upyunOperator: setting.upyunOperator,
    upyunPassword: setting.upyunPassword,
    upyunDomain: setting.upyunDomain,
    upyunPath: setting.upyunPath,
  });
});

// GET /api/settings/amap-config - amap config (admin only)
router.get("/amap-config", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const setting = await ensureSetting();
  res.json({
    amapKey: setting.amapKey,
    amapJsKey: setting.amapJsKey,
    amapSecurityJsCode: setting.amapSecurityJsCode,
  });
});

// GET /api/settings/la-config - 51.la OpenAPI config (admin only, includes secretKey)
router.get("/la-config", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const setting = await ensureSetting();
  res.json({
    laAccessKey: setting.laAccessKey,
    laSecretKey: setting.laSecretKey,
    laMaskId: setting.laMaskId,
  });
});

// POST /api/settings/email-test - send a test email (admin only)
router.post("/email-test", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await sendTestEmail();
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "测试邮件发送失败",
    });
  }
});

export default router;
