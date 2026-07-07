import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface FriendLinkAttributes {
  id: string;
  name: string;
  url: string;
  desc: string;
  email: string;
  avatar: string;
  sort: number;
}

interface FriendLinkCreationAttributes extends Optional<FriendLinkAttributes, "id" | "desc" | "email" | "avatar" | "sort"> {}

class FriendLink
  extends Model<FriendLinkAttributes, FriendLinkCreationAttributes>
  implements FriendLinkAttributes
{
  declare id: string;
  declare name: string;
  declare url: string;
  declare desc: string;
  declare email: string;
  declare avatar: string;
  declare sort: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

FriendLink.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    desc: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    avatar: {
      type: DataTypes.STRING(512),
      allowNull: false,
      defaultValue: "",
    },
    sort: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: "friend_links",
  }
);

export default FriendLink;
