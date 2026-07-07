import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface MusicSourceAttributes {
  id: string;
  name: string;
  platform: string;
  url: string;
  version: string;
  author: string;
  category: string;
  enabled: boolean;
  userVariables: string;
  filePath: string;
  supportedSearchType: string;
  srcUrl: string;
  sortOrder: number;
  description: string;
  primaryKey: string;
  hints: string;
  cacheControl: string;
  userVariableDefinitions: string;
  defaultSearchType: string;
}

interface MusicSourceCreationAttributes extends Optional<
  MusicSourceAttributes,
  "id" | "version" | "author" | "category" | "enabled" | "userVariables" | "filePath" | "supportedSearchType" | "srcUrl" | "sortOrder" | "description" | "primaryKey" | "hints" | "cacheControl" | "userVariableDefinitions" | "defaultSearchType"
> {}

class MusicSource
  extends Model<MusicSourceAttributes, MusicSourceCreationAttributes>
  implements MusicSourceAttributes
{
  declare id: string;
  declare name: string;
  declare platform: string;
  declare url: string;
  declare version: string;
  declare author: string;
  declare category: string;
  declare enabled: boolean;
  declare userVariables: string;
  declare filePath: string;
  declare supportedSearchType: string;
  declare srcUrl: string;
  declare sortOrder: number;
  declare description: string;
  declare primaryKey: string;
  declare hints: string;
  declare cacheControl: string;
  declare userVariableDefinitions: string;
  declare defaultSearchType: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

MusicSource.init(
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
    platform: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    version: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "",
    },
    author: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "",
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "custom",
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    userVariables: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "{}",
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    supportedSearchType: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: '["music"]',
    },
    srcUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    primaryKey: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: '["id"]',
    },
    hints: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "{}",
    },
    cacheControl: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "cache",
    },
    userVariableDefinitions: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "[]",
    },
    defaultSearchType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "music",
    },
  },
  {
    sequelize,
    tableName: "music_sources",
  }
);

export default MusicSource;
