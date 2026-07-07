import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import type Post from "./Post";

interface CommentAttributes {
  id: string;
  postId: string;
  authorName: string;
  email: string;
  website?: string;
  replyTo?: string;
  replyToEmail?: string;
  content: string;
  ip?: string;
  region?: string;
}

interface CommentCreationAttributes
  extends Optional<CommentAttributes, "id" | "replyTo" | "replyToEmail" | "website" | "ip" | "region"> {}

class Comment
  extends Model<CommentAttributes, CommentCreationAttributes>
  implements CommentAttributes
{
  declare id: string;
  declare postId: string;
  declare authorName: string;
  declare email: string;
  declare website?: string;
  declare replyTo?: string;
  declare replyToEmail?: string;
  declare content: string;
  declare ip?: string;
  declare region?: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
  // Association
  declare post?: Post;
}

Comment.init(
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
    authorName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    replyTo: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    replyToEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    region: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "comments",
  }
);

export default Comment;
