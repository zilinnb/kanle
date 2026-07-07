import { DataTypes, Model, Optional, Op } from "sequelize";
import sequelize from "../config/database";

/**
 * 评论点赞模型（WP Ulike 风格）：
 * - status ENUM('like','unlike')：软删，永不物理删除
 * - 4 个互斥 UNIQUE 索引：按 priority userId > visitorId > email > ip 去重
 * - 与 Like.ts 结构一致，区别为 commentId 替代 postId
 */

type CommentLikeStatus = "like" | "unlike";

interface CommentLikeAttributes {
  id: string;
  commentId: string;
  name: string;
  email?: string | null;
  ip?: string | null;
  visitorId?: string | null;
  userId?: string | null;
  status: CommentLikeStatus;
}

interface CommentLikeCreationAttributes extends Optional<CommentLikeAttributes, "id" | "userId" | "email" | "ip" | "visitorId" | "status"> {}

class CommentLike
  extends Model<CommentLikeAttributes, CommentLikeCreationAttributes>
  implements CommentLikeAttributes
{
  declare id: string;
  declare commentId: string;
  declare name: string;
  declare email?: string | null;
  declare ip?: string | null;
  declare visitorId?: string | null;
  declare userId?: string | null;
  declare status: CommentLikeStatus;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

CommentLike.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    commentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "comments",
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
    tableName: "comment_likes",
    indexes: [
      {
        unique: true,
        fields: ["comment_id", "user_id"],
        name: "comment_likes_comment_user_unique",
        where: {
          user_id: { [Op.not]: null },
        },
      },
      {
        unique: true,
        fields: ["comment_id", "visitor_id"],
        name: "comment_likes_comment_visitor_unique",
        where: {
          visitor_id: { [Op.not]: null },
          user_id: null,
        },
      },
      {
        unique: true,
        fields: ["comment_id", "email"],
        name: "comment_likes_comment_email_unique",
        where: {
          email: { [Op.not]: null },
          visitor_id: null,
          user_id: null,
        },
      },
      {
        unique: true,
        fields: ["comment_id", "ip"],
        name: "comment_likes_comment_ip_unique",
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

export default CommentLike;
