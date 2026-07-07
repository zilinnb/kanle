import sequelize from "../config/database";

/**
 * 迁移 likes 表：
 * 1. 删除旧的 (post_id, name) 唯一索引
 * 2. 添加 visitor_id 列
 * 3. 添加新的 (post_id, visitor_id) 唯一索引
 */
async function migrateLikes() {
  await sequelize.authenticate();
  const qi = sequelize.getQueryInterface();

  // 1. 添加 visitor_id 列（如果不存在）
  try {
    const tableDesc = await qi.describeTable("likes");
    if (!(tableDesc as any).visitorId) {
      await qi.addColumn("likes", "visitorId", {
        type: "VARCHAR(100)",
        allowNull: true,
      });
      console.log("✓ Added visitor_id column");
    } else {
      console.log("✓ visitor_id column already exists");
    }
  } catch (err) {
    console.error("Error adding visitor_id:", err);
  }

  // 2. 删除旧的 (post_id, name) 唯一索引
  try {
    // 查找并删除所有包含 name 的唯一索引
    const [indexes] = await sequelize.query("SHOW INDEX FROM likes");
    const indexRows = indexes as any[];
    const indexesToDrop = new Set<string>();
    for (const row of indexRows) {
      // 找到包含 name 列的唯一索引
      if (row.Column_name === "name" && row.Non_unique === 0) {
        indexesToDrop.add(row.Key_name);
      }
    }
    for (const indexName of indexesToDrop) {
      await sequelize.query(`DROP INDEX \`${indexName}\` ON likes`);
      console.log(`✓ Dropped old index: ${indexName}`);
    }
    if (indexesToDrop.size === 0) {
      console.log("✓ No old (post_id, name) unique index found");
    }
  } catch (err) {
    console.error("Error dropping old index:", err);
  }

  // 3. 添加新的 (post_id, visitor_id) 唯一索引
  try {
    const [indexes] = await sequelize.query("SHOW INDEX FROM likes");
    const indexRows = indexes as any[];
    const hasNewIndex = indexRows.some(
      (row) => row.Key_name === "likes_post_visitor_unique"
    );
    if (!hasNewIndex) {
      await sequelize.query(
        "CREATE UNIQUE INDEX likes_post_visitor_unique ON likes (post_id, visitor_id)"
      );
      console.log("✓ Added new unique index (post_id, visitor_id)");
    } else {
      console.log("✓ New unique index already exists");
    }
  } catch (err) {
    console.error("Error adding new index:", err);
  }

  // 4. 为已有的 "访客"/"游客" 点赞生成随机 visitorId（避免旧数据冲突）
  try {
    await sequelize.query(`
      UPDATE likes SET visitorId = UUID() WHERE visitorId IS NULL
    `);
    console.log("✓ Backfilled visitorId for existing likes");
  } catch (err) {
    console.error("Error backfilling visitorId:", err);
  }

  console.log("\nMigration complete!");
  await sequelize.close();
}

migrateLikes().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
