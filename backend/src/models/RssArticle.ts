import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface RssArticleAttributes {
  id: string;
  sourceId: string;
  title: string;
  link: string;
  desc: string;
  author: string;
  thumbnail: string;
  pubDate: Date;
  guid: string;
}

interface RssArticleCreationAttributes extends Optional<RssArticleAttributes, "id" | "desc" | "author" | "thumbnail" | "pubDate"> {}

class RssArticle
  extends Model<RssArticleAttributes, RssArticleCreationAttributes>
  implements RssArticleAttributes
{
  declare id: string;
  declare sourceId: string;
  declare title: string;
  declare link: string;
  declare desc: string;
  declare author: string;
  declare thumbnail: string;
  declare pubDate: Date;
  declare guid: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

RssArticle.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sourceId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    link: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    desc: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    author: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "",
    },
    thumbnail: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    pubDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    guid: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "rss_articles",
    indexes: [
      { fields: ["sourceId"] },
      { fields: ["pubDate"] },
      { unique: true, fields: ["sourceId", "guid"] },
    ],
  }
);

export default RssArticle;
