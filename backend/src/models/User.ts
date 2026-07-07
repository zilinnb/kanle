import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface UserAttributes {
  id: string;
  email: string;
  username: string;
  nickname: string;
  avatar: string;
  cover: string;
  bio: string;
  website: string;
  password: string;
  role: "admin" | "visitor";
}

interface UserCreationAttributes extends Optional<UserAttributes, "id" | "role" | "website" | "username"> {}

class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  declare id: string;
  declare email: string;
  declare username: string;
  declare nickname: string;
  declare avatar: string;
  declare cover: string;
  declare bio: string;
  declare website: string;
  declare password: string;
  declare role: "admin" | "visitor";
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      defaultValue: "",
    },
    nickname: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    avatar: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    cover: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    bio: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin", "visitor"),
      allowNull: false,
      defaultValue: "visitor",
    },
  },
  {
    sequelize,
    tableName: "users",
  }
);

export default User;
