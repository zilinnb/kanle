import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import type User from "./User";

interface PostMusic {
  name: string;
  artist: string;
  cover: string;
  url: string;
  source: "netease" | "upload" | "musicfree";
  neteaseId?: string;
  platform?: string;
  musicId?: string;
  /** @deprecated 已并入 extra，保留以兼容旧数据。QQ 音乐系插件的 mid */
  songmid?: string;
  /**
   * 插件特定字段对象（songmid/hash/bvid/cid 等），透传给插件 getMediaSource/getLyric。
   * 对齐洛水 IMusicItem 全字段方案：search→store→play 全程保留插件字段。
   */
  extra?: Record<string, any>;
  /** LRC 歌词文本（上传歌曲专用，客户端解析） */
  lrc?: string;
}

interface LinkCard {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

interface PostVideo {
  url?: string;
  cover?: string;
  title?: string;
  author?: string;
  avatar?: string;
  like?: number;
  time?: number;
  platform?: string;
  sourceUrl?: string;
  embedCode?: string;
  source: "parse" | "upload" | "url" | "embed";
}

interface PostLocation {
  name: string;
  city: string;
  address?: string;
  lng?: number;
  lat?: number;
}

interface PostDouban {
  title: string;
  cover: string;
  link: string;
  rating: number;
  intro: string;
  status: string;
  statusLabel: string;
}

interface PostAttributes {
  id: string;
  shortId: string;
  userId: string;
  /** moment=朋友圈动态（默认），article=长文章（带标题/封面/摘要） */
  type: "moment" | "article";
  title: string;
  excerpt: string;
  cover: string;
  category: string;
  content: string;
  images: string[];
  location: PostLocation | null;
  music: PostMusic | null;
  linkCard: LinkCard | null;
  video: PostVideo | null;
  douban: PostDouban | null;
  pinned: boolean;
  isAd: boolean;
  adAvatar: string;
  adNickname: string;
  likesDisabled: boolean;
  commentsDisabled: boolean;
  /** 发帖者 IP（用于解析省份） */
  ip: string;
  /** IP 解析出的省份简称（如"湖北"） */
  region: string;
  /** 文章类型标记：original=原创，repost=转载，ai=AI生成 */
  articleType: "original" | "repost" | "ai";
  /** 阅读量（文章详情页 GET /:id?view=1 时原子递增） */
  viewCount: number;
  /** 发布状态：published=已发布（默认），draft=草稿（不在前端显示） */
  status: "published" | "draft";
}

interface PostCreationAttributes extends Optional<PostAttributes, "id" | "shortId" | "type" | "title" | "excerpt" | "cover" | "category" | "images" | "pinned" | "isAd" | "adAvatar" | "adNickname" | "likesDisabled" | "commentsDisabled" | "ip" | "region" | "articleType" | "viewCount" | "status"> {}

class Post
  extends Model<PostAttributes, PostCreationAttributes>
  implements PostAttributes
{
  declare id: string;
  declare shortId: string;
  declare userId: string;
  declare type: "moment" | "article";
  declare title: string;
  declare excerpt: string;
  declare cover: string;
  declare category: string;
  declare content: string;
  declare images: string[];
  declare location: PostLocation | null;
  declare music: PostMusic | null;
  declare linkCard: LinkCard | null;
  declare video: PostVideo | null;
  declare douban: PostDouban | null;
  declare pinned: boolean;
  declare isAd: boolean;
  declare adAvatar: string;
  declare adNickname: string;
  declare likesDisabled: boolean;
  declare commentsDisabled: boolean;
  declare ip: string;
  declare region: string;
  declare articleType: "original" | "repost" | "ai";
  declare viewCount: number;
  declare status: "published" | "draft";
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
  // Association
  declare author?: User;
}

Post.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    shortId: {
      type: DataTypes.STRING(8),
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    type: {
      type: DataTypes.ENUM("moment", "article"),
      allowNull: false,
      defaultValue: "moment",
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      defaultValue: "",
    },
    excerpt: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    cover: {
      type: DataTypes.STRING(512),
      allowNull: false,
      defaultValue: "",
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    images: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    location: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    music: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    linkCard: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    video: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    douban: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    pinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isAd: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    adAvatar: {
      type: DataTypes.STRING(512),
      allowNull: false,
      defaultValue: "",
    },
    adNickname: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "",
    },
    likesDisabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    commentsDisabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    ip: {
      type: DataTypes.STRING(45),
      allowNull: false,
      defaultValue: "",
    },
    region: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "",
    },
    articleType: {
      type: DataTypes.ENUM("original", "repost", "ai"),
      allowNull: false,
      defaultValue: "original",
    },
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("published", "draft"),
      allowNull: false,
      defaultValue: "published",
    },
  },
  {
    sequelize,
    tableName: "posts",
  }
);

export default Post;
