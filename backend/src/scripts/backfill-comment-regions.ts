import { Op } from "sequelize";
import { sequelize, Comment, Post } from "../models";
import { getRegionByIp } from "../utils/region";

async function backfill() {
  await sequelize.authenticate();
  console.log("Database connected.");

  const comments = await Comment.findAll({
    where: {
      [Op.or]: [{ region: { [Op.eq]: null } }, { region: "" }],
    } as any,
    include: [
      {
        model: Post,
        as: "post",
        attributes: ["id", "type"],
      },
    ],
  });

  const articleComments = comments.filter((c: any) => c.post?.type === "article");
  console.log(`Found ${comments.length} comments without region (${articleComments.length} article comments).`);

  let updated = 0;
  let skipped = 0;
  for (const comment of articleComments) {
    const ip = comment.ip;
    if (!ip) {
      console.log(`  ${comment.id}: no IP, skipped`);
      skipped++;
      continue;
    }
    const region = await getRegionByIp(ip);
    if (region) {
      await comment.update({ region });
      console.log(`  ${comment.id}: ${ip} -> ${region}`);
      updated++;
    } else {
      console.log(`  ${comment.id}: ${ip} -> (unknown)`);
      skipped++;
    }
  }

  console.log(`Done. Updated: ${updated}, Skipped: ${skipped}.`);
  await sequelize.close();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
