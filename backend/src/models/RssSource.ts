import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface RssSourceAttributes {
  id: string;
  name: string;
  url: string;
  avatar: string;
  desc: string;
  sort: number;
}

interface RssSourceCreationAttributes extends Optional<RssSourceAttributes, "id" | "avatar" | "desc" | "sort"> {}

class RssSource
  extends Model<RssSourceAttributes, RssSourceCreationAttributes>
  implements RssSourceAttributes
{
  declare id: string;
  declare name: string;
  declare url: string;
  declare avatar: string;
  declare desc: string;
  declare sort: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RssSource.init(
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
    avatar: {
      type: DataTypes.STRING(512),
      allowNull: false,
      defaultValue: "",
    },
    desc: {
      type: DataTypes.STRING(255),
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
    tableName: "rss_sources",
  }
);

export default RssSource;
