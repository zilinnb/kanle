import { DataTypes, Model, Optional, Op } from "sequelize";
import sequelize from "../config/database";

/**
 * WP Ulike 风格点赞模型：
 * - status ENUM('like','unlike')：软删，永不物理删除
 * - 4 个互斥 UNIQUE 索引：按 priority userId > visitorId > email > ip 去重
 * - 每个 where 条件链式 NOT NULL 确保维度互斥（避免跨维度冲突）
 */

type LikeStatus = "like" | "unlike";

interface LikeAttributes {
  id: string;
  postId: string;
  name: string;
  email?: string | null;
  ip?: string | null;
  visitorId?: string | null;
  userId?: string | null;
  status: LikeStatus;
}

interface LikeCreationAttributes extends Optional<LikeAttributes, "id" | "userId" | "email" | "ip" | "visitorId" | "status"> {}

class Like
  extends Model<LikeAttributes, LikeCreationAttributes>
  implements LikeAttributes
{
  declare id: string;
  declare postId: string;
  declare name: string;
  declare email?: string | null;
  declare ip?: string | null;
  declare visitorId?: string | null;
  declare userId?: string | null;
  declare status: LikeStatus;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Like.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    postId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "posts",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
      defaultValue: null,
    },
    visitorId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM("like", "unlike"),
      allowNull: false,
      defaultValue: "like",
    },
  },
  {
    sequelize,
    tableName: "likes",
    indexes: [
      // 维度 1：已登录用户 — userId 非空即匹配
      {
        unique: true,
        fields: ["post_id", "user_id"],
        name: "likes_post_user_unique",
        where: {
          user_id: { [Op.not]: null },
        },
      },
      // 维度 2：cookie 游客 — visitorId 非空、userId 空（防止登录后又匹配到 cookie 维度）
      {
        unique: true,
        fields: ["post_id", "visitor_id"],
        name: "likes_post_visitor_unique",
        where: {
          visitor_id: { [Op.not]: null },
          user_id: null,
        },
      },
      // 维度 3：填邮箱访客 — email 非空、visitorId 和 userId 空
      {
        unique: true,
        fields: ["post_id", "email"],
        name: "likes_post_email_unique",
        where: {
          email: { [Op.not]: null },
          visitor_id: null,
          user_id: null,
        },
      },
      // 维度 4：纯匿名访客 — ip 非空、email/visitorId/userId 空
      {
        unique: true,
        fields: ["post_id", "ip"],
        name: "likes_post_ip_unique",
        where: {
          ip: { [Op.not]: null },
          email: null,
          visitor_id: null,
          user_id: null,
        },
      },
    ],
  }
);

export default Like;
