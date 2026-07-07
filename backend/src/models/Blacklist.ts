import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export type BlacklistType = "email" | "ip";

export interface BlacklistAttributes {
  id: string;
  type: BlacklistType;
  value: string;
  reason?: string | null;
  /** 封禁截止时间；null 表示永久封禁 */
  expiresAt?: Date | null;
}

interface BlacklistCreationAttributes
  extends Optional<BlacklistAttributes, "id" | "reason" | "expiresAt"> {}

class Blacklist
  extends Model<BlacklistAttributes, BlacklistCreationAttributes>
  implements BlacklistAttributes
{
  declare id: string;
  declare type: BlacklistType;
  declare value: string;
  declare reason?: string;
  declare expiresAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Blacklist.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM("email", "ip"),
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "blacklists",
    indexes: [
      // 单值查询主索引（type + value 唯一，避免重复添加同一封禁对象）
      { unique: true, fields: ["type", "value"] },
    ],
  }
);

export default Blacklist;
