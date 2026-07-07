import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { sequelize } from "./models";
import authRoutes from "./routes/auth";
import postsRoutes from "./routes/posts";
import usersRoutes from "./routes/users";
import adminRoutes from "./routes/admin";
import uploadRoutes from "./routes/upload";
import friendsRoutes from "./routes/friends";
import settingsRoutes from "./routes/settings";
import musicRoutes from "./routes/music";
import notificationsRoutes from "./routes/notifications";
import adsRoutes from "./routes/ads";
import mediaRoutes from "./routes/media";
import locationRoutes from "./routes/location";
import urlPreviewRoutes from "./routes/url-preview";
import videoParseRoutes from "./routes/video-parse";
import pluginsRoutes from "./routes/plugins";
import { visitorCookieMiddleware } from "./middleware/visitor-cookie";
import { loadAllPlugins, watchPluginsDir } from "./music-sources/mf-manager";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL || "http://localhost:3000"
        : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(visitorCookieMiddleware);
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/ads", adsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/url-preview", urlPreviewRoutes);
app.use("/api/video", videoParseRoutes);
app.use("/api/admin/plugins", pluginsRoutes);

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || "服务器内部错误" });
});

async function bootstrap() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");
    // sync() only creates missing tables — does NOT alter existing tables.
    // Schema changes are managed manually via SQL to avoid duplicate-index
    // accumulation and ENUM leading-space bugs caused by sync({alter:true}).
    await sequelize.sync();
    console.log("Models synchronized.");

    // 启动时清理已过期的黑名单记录
    try {
      const { blacklistService } = await import("./services/blacklist-service");
      const cleaned = await blacklistService.cleanupExpired();
      if (cleaned > 0) console.log(`Cleaned ${cleaned} expired blacklist entries.`);
    } catch (e) {
      console.warn("Blacklist cleanup skipped:", (e as Error).message);
    }

    // 加载 MusicFree 音源插件（酷狗/QQ/网易云/酷我/咪咕等）
    try {
      const result = await loadAllPlugins();
      console.log(`[plugins] loaded ${result.loaded} music source plugin(s)`);
      if (result.failed.length > 0) {
        console.warn("[plugins] failed:", result.failed);
      }
      watchPluginsDir();
    } catch (e) {
      console.warn("[plugins] load failed:", (e as Error).message);
    }

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Unable to bootstrap backend:", error);
    process.exit(1);
  }
}

bootstrap();
