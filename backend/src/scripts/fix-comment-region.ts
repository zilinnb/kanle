import { sequelize, Comment } from "../models";

async function fix() {
  await sequelize.authenticate();
  const updated = await Comment.update(
    { region: "贵州" },
    { where: { ip: "39.144.231.119" } }
  );
  console.log(`Updated ${updated[0]} comment(s) with IP 39.144.231.119 -> 贵州`);
  await sequelize.close();
}

fix().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
