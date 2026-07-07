import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export type StorageType = "upyun" | "local";

export type MediaCategory = "image" | "video" | "audio" | "file";

interface MediaAttributes {
  id: string;
  filename: string;
  url: string;
  storageType: StorageType;
  mimeType: string;
  size: number;
  uploaderId: string;
  /**
   * 实况图配对字段（仅对 image 类型有意义）。
   * 当此图片是实况图的图片组件时，记录其配对视频的 URL。
   * 媒体库网格中将以"实况图"形式整体展示，点击后分开显示图与视频。
   */
  livePhotoVideo: string | null;
  /**
   * 实况图配对字段（仅对 video 类型有意义）。
   * 当此视频是实况图的视频组件时，记录其配对图片的 URL。
   * 此字段不为 null 的记录会在媒体库网格中隐藏（已被合并到对应图片条目中）。
   */
  livePhotoImage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MediaCreationAttributes extends Optional<
  MediaAttributes,
  "id" | "createdAt" | "updatedAt" | "livePhotoVideo" | "livePhotoImage"
> {}

class Media
  extends Model<MediaAttributes, MediaCreationAttributes>
  implements MediaAttributes
{
  declare id: string;
  declare filename: string;
  declare url: string;
  declare storageType: StorageType;
  declare mimeType: string;
  declare size: number;
  declare uploaderId: string;
  declare livePhotoVideo: string | null;
  declare livePhotoImage: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Media.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    storageType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "local",
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "application/octet-stream",
    },
    size: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    uploaderId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    livePhotoVideo: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },
    livePhotoImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: null,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "media",
    underscored: true,
  }
);

export function getMediaCategory(mimeType: string): MediaCategory {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

export default Media;
