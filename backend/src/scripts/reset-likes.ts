/**
 * 点赞系统 WP Ulike 重构 — DB 重置脚本
 *
 * 执行步骤：
 *   1. 备份现有 likes 表到 likes_backup_YYYYMMDD
 *   2. 删除旧 3 个互斥 unique 索引（容错：若不存在则跳过）
 *   3. TRUNCATE likes 表
 *   4. 添加 status ENUM('like','unlike') 列（容错：若已存在则跳过）
 *   5. 创建新 4 个互斥 unique 索引（含 visitorId 维度）
 *
 * 运行：npm run db:reset-likes
 *
 * 注意：TRUNCATE 不可逆，已备份表保存 30 天后可手动删除。
 */
import dotenv from "dotenv";
import { sequelize } from "../models";

dotenv.config();

const OLD_INDEXES = [
  "likes_post_user_unique",
  "likes_post_email_unique",
  "likes_post_ip_unique",
];

const NEW_INDEXES = [
  // MySQL 不支持 partial index (WHERE)，但 MySQL 的 UNIQUE 索引对 NULL 值不去重：
  // 多个 NULL 在唯一索引中视为不同值，不冲突。
  // 因此 (post_id, user_id) 的 UNIQUE 索引允许同一 post 下多条 user_id=NULL 记录，
  // 仅对 user_id 非空的记录强制唯一——正好是我们想要的互斥行为。
  {
    name: "likes_post_user_unique",
    sql: `CREATE UNIQUE INDEX likes_post_user_unique ON likes(post_id, user_id)`,
  },
  {
    name: "likes_post_visitor_unique",
    sql: `CREATE UNIQUE INDEX likes_post_visitor_unique ON likes(post_id, visitor_id)`,
  },
  {
    name: "likes_post_email_unique",
    sql: `CREATE UNIQUE INDEX likes_post_email_unique ON likes(post_id, email)`,
  },
  {
    name: "likes_post_ip_unique",
    sql: `CREATE UNIQUE INDEX likes_post_ip_unique ON likes(post_id, ip)`,
  },
];

async function indexExists(indexName: string): Promise<boolean> {
  const [rows]: any = await sequelize.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'likes'
       AND index_name = ?
     LIMIT 1`,
    { replacements: [indexName] }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function columnExists(columnName: string): Promise<boolean> {
  const [rows]: any = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'likes'
       AND column_name = ?
     LIMIT 1`,
    { replacements: [columnName] }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function resetLikes() {
  try {
    await sequelize.authenticate();
    console.log("✓ Database connected.");

    // 1. 备份当前 likes 表（保底，可手动恢复）
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const backupTable = `likes_backup_${today}`;
    console.log(`\n[1/5] 备份 likes 表 → ${backupTable} ...`);
    try {
      await sequelize.query(`DROP TABLE IF EXISTS ${backupTable};`);
      await sequelize.query(`CREATE TABLE ${backupTable} AS SELECT * FROM likes;`);
      const [countRows]: any = await sequelize.query(`SELECT COUNT(*) AS cnt FROM ${backupTable};`);
      const backupCount = countRows?.[0]?.cnt || 0;
      console.log(`  ✓ 备份完成，共 ${backupCount} 条记录`);
    } catch (err: any) {
      console.warn(`  ! 备份失败（继续执行）：${err?.message || err}`);
    }

    // 2. 删除旧 3 个 unique 索引（容错：不存在则跳过）
    // 关键：MySQL 可能使用 (post_id, xxx) 复合 unique 索引作为 FK 约束的索引，
    // 直接 DROP 会报 "needed in a foreign key constraint"。
    // 解决：先建临时普通索引 post_id_temp_idx 让 FK 切换过去，再 DROP unique 索引。
    console.log("\n[2/5] 删除旧 unique 索引 ...");

    // 2.1 先建临时普通索引（如果还没有 post_id 单独索引）
    const hasPostIdIndex = await indexExists("likes_post_id_temp_idx");
    if (!hasPostIdIndex) {
      try {
        await sequelize.query("CREATE INDEX likes_post_id_temp_idx ON likes(post_id);");
        console.log("  ✓ CREATE TEMP INDEX likes_post_id_temp_idx (供 FK 使用)");
      } catch (err: any) {
        console.warn(`  ! 创建临时索引失败（可能已存在）：${err?.message || err}`);
      }
    }

    // 2.2 现在可以安全 DROP 旧 unique 索引
    for (const idxName of OLD_INDEXES) {
      if (await indexExists(idxName)) {
        try {
          await sequelize.query(`ALTER TABLE likes DROP INDEX ${idxName};`);
          console.log(`  ✓ DROP INDEX ${idxName}`);
        } catch (err: any) {
          console.warn(`  ! DROP ${idxName} 失败：${err?.message || err}`);
          console.warn(`     尝试 SET FOREIGN_KEY_CHECKS=0 后重试 ...`);
          await sequelize.query("SET FOREIGN_KEY_CHECKS=0;");
          try {
            await sequelize.query(`ALTER TABLE likes DROP INDEX ${idxName};`);
            console.log(`  ✓ DROP INDEX ${idxName} (FK_CHECKS=0)`);
          } finally {
            await sequelize.query("SET FOREIGN_KEY_CHECKS=1;");
          }
        }
      } else {
        console.log(`  - SKIP ${idxName} (not exists)`);
      }
    }

    // 3. TRUNCATE likes 表（清空所有旧数据）
    console.log("\n[3/5] TRUNCATE likes 表 ...");
    await sequelize.query("TRUNCATE TABLE likes;");
    console.log("  ✓ likes 表已清空");

    // 4. 添加 status 列（容错：已存在则跳过）
    console.log("\n[4/5] 添加 status 列 ...");
    if (!(await columnExists("status"))) {
      await sequelize.query(
        "ALTER TABLE likes ADD COLUMN status ENUM('like','unlike') NOT NULL DEFAULT 'like' AFTER user_id;"
      );
      console.log("  ✓ ADD COLUMN status ENUM('like','unlike')");
    } else {
      console.log("  - SKIP status column (already exists)");
    }

    // 5. 创建新 4 个互斥 unique 索引
    console.log("\n[5/5] 创建新 4 个互斥 unique 索引 ...");
    for (const idx of NEW_INDEXES) {
      if (await indexExists(idx.name)) {
        await sequelize.query(`ALTER TABLE likes DROP INDEX ${idx.name};`);
        console.log(`  - 重建 ${idx.name}（先 DROP 旧版）`);
      }
      await sequelize.query(idx.sql + ";");
      console.log(`  ✓ CREATE INDEX ${idx.name}`);
    }

    // 5.1 删除临时索引（FK 现在可以用新创建的 unique 索引了）
    if (await indexExists("likes_post_id_temp_idx")) {
      try {
        await sequelize.query("DROP INDEX likes_post_id_temp_idx ON likes;");
        console.log("  ✓ DROP TEMP INDEX likes_post_id_temp_idx");
      } catch (err: any) {
        console.warn(`  ! 删除临时索引失败（不影响功能）：${err?.message || err}`);
      }
    }

    // 验证最终状态
    const [finalRows]: any = await sequelize.query(
      `SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols
       FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'likes'
       GROUP BY index_name
       ORDER BY index_name;`
    );
    console.log("\n========== 最终 likes 表索引状态 ==========");
    for (const row of finalRows || []) {
      console.log(`  ${row.index_name}  →  (${row.cols})`);
    }

    const [colRows]: any = await sequelize.query(
      `SELECT column_name, column_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'likes'
       ORDER BY ordinal_position;`
    );
    console.log("\n========== 最终 likes 表列结构 ==========");
    for (const row of colRows || []) {
      console.log(`  ${row.column_name}  ${row.column_type}  nullable=${row.is_nullable}  default=${row.column_default || "NULL"}`);
    }

    console.log("\n✅ 点赞系统重置完成。可启动后端验证。");
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ 重置失败：", error?.message || error);
    if (error?.sql) console.error("SQL:", error.sql);
    process.exit(1);
  }
}

resetLikes();
