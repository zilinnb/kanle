import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { sequelize, User } from "../models";

dotenv.config();

async function seed() {
  try {
    // 注意：不要用 sync({ alter: true })，会重复创建索引导致 MySQL 64 索引上限错误
    await sequelize.sync();

    const adminEmail = process.env.ADMIN_EMAIL || "admin@kanle.net";
    const adminPassword = process.env.ADMIN_PASSWORD || "123456";
    const adminUsername = process.env.ADMIN_USERNAME || "admin";

    // 如果旧版 admin 用户存在（username 为空），先删除让新版重新创建
    const existing = await User.findOne({ where: { role: "admin" } });
    if (existing && !existing.username) {
      await existing.destroy();
      console.log("Removed legacy admin user (no username).");
    }

    const [admin, created] = await User.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        email: adminEmail,
        username: adminUsername,
        password: await bcrypt.hash(adminPassword, 10),
        nickname: "小予",
        // avatar 留空，前端 resolveAvatar() 会自动用 Cravatar 根据邮箱生成
        avatar: "",
        cover: "https://picsum.photos/seed/momentscover/1200/600",
        bio: "这是一个朋友圈博客程序",
        role: "admin",
      },
    });

    // 如果用户已存在但 username 为空或昵称是旧版，更新一下
    if (!created) {
      await admin.update({
        username: admin.username || adminUsername,
        nickname: admin.nickname === "锦的朋友圈" ? "小予" : admin.nickname,
      });
    }

    console.log(created ? "Admin created." : "Admin already exists.", {
      email: admin.email,
      username: admin.username,
      nickname: admin.nickname,
    });
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
