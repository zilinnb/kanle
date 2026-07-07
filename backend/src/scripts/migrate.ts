import { sequelize, User, Post, Comment, Like, SiteSetting, FriendLink } from "../models";

async function migrate() {
  await sequelize.authenticate();
  console.log("Database connected.");
  await sequelize.sync({ alter: true });
  console.log("Tables synchronized (alter mode).");
  await sequelize.close();
  console.log("Done.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
