import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

interface SiteSettingAttributes {
  id: number;
  siteName: string;
  description: string;
  keywords: string;
  domain: string;
  beian: string;
  faviconUrl: string;
  ogImage: string;
  musicUrl: string;
  musicId: string;
  musicSource: string;
  playlistId: string;
  backgroundImages: string;
  darkModeEnabled: boolean;
  darkModeStartTime: string;
  darkModeEndTime: string;
  emailNotifyEnabled: boolean;
  notifyEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  emailTemplate: string;
  upyunEnabled: boolean;
  upyunBucket: string;
  upyunOperator: string;
  upyunPassword: string;
  upyunDomain: string;
  upyunPath: string;
  amapJsKey: string;
  amapSecurityJsCode: string;
  amapKey: string;
  beianUrl: string;
  socialLinks: string;
  postCollapseLength: number;
  fontUrl: string;
  adOnArchives: boolean;
  /** 评论防刷（限流 + 黑名单）总开关，默认开启 */
  commentAntiSpamEnabled: boolean;
  /** RSS 订阅总开关，关闭后 /feed 返回 404 */
  rssEnabled: boolean;
  /** RSS 是否包含动态（moment），关闭后只订阅文章（article） */
  rssIncludeMoments: boolean;
  /** 豆瓣用户 ID，用于抓取电影/图书/音乐收藏 */
  doubanId: string;
  /** 评论违禁词列表，JSON 数组字符串 */
  bannedWords: string | null;
}

interface SiteSettingCreationAttributes extends Optional<
  SiteSettingAttributes,
  "id" | "siteName" | "description" | "keywords" | "domain" | "beian" | "faviconUrl" | "ogImage" | "musicUrl" | "musicId" | "musicSource" | "playlistId" | "backgroundImages" | "darkModeEnabled" | "darkModeStartTime" | "darkModeEndTime" | "emailNotifyEnabled" | "notifyEmail" | "smtpHost" | "smtpPort" | "smtpSecure" | "smtpUser" | "smtpPass" | "smtpFrom" | "emailTemplate" | "upyunEnabled" | "upyunBucket" | "upyunOperator" | "upyunPassword" | "upyunDomain" | "upyunPath" | "amapJsKey" | "amapSecurityJsCode" | "amapKey" | "beianUrl" | "socialLinks" | "postCollapseLength" | "fontUrl" | "adOnArchives" | "commentAntiSpamEnabled" | "rssEnabled" | "rssIncludeMoments" | "doubanId" | "bannedWords"
> {}

class SiteSetting
  extends Model<SiteSettingAttributes, SiteSettingCreationAttributes>
  implements SiteSettingAttributes
{
  declare id: number;
  declare siteName: string;
  declare description: string;
  declare keywords: string;
  declare domain: string;
  declare beian: string;
  declare faviconUrl: string;
  declare ogImage: string;
  declare musicUrl: string;
  declare musicId: string;
  declare musicSource: string;
  declare playlistId: string;
  declare backgroundImages: string;
  declare darkModeEnabled: boolean;
  declare darkModeStartTime: string;
  declare darkModeEndTime: string;
  declare emailNotifyEnabled: boolean;
  declare notifyEmail: string;
  declare smtpHost: string;
  declare smtpPort: number;
  declare smtpSecure: boolean;
  declare smtpUser: string;
  declare smtpPass: string;
  declare smtpFrom: string;
  declare emailTemplate: string;
  declare upyunEnabled: boolean;
  declare upyunBucket: string;
  declare upyunOperator: string;
  declare upyunPassword: string;
  declare upyunDomain: string;
  declare upyunPath: string;
  declare amapJsKey: string;
  declare amapSecurityJsCode: string;
  declare amapKey: string;
  declare beianUrl: string;
  declare socialLinks: string;
  declare postCollapseLength: number;
  declare fontUrl: string;
  declare adOnArchives: boolean;
  declare commentAntiSpamEnabled: boolean;
  declare rssEnabled: boolean;
  declare rssIncludeMoments: boolean;
  declare doubanId: string;
  declare bannedWords: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

SiteSetting.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      defaultValue: 1,
    },
    siteName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "朋友圈博客",
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "一个像微信朋友圈一样的个人博客",
    },
    keywords: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    domain: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    beian: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "",
    },
    faviconUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    ogImage: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    musicUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    musicId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "",
    },
    musicSource: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "netease",
    },
    playlistId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "",
      field: "playlistId",
    },
    backgroundImages: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "[]",
    },
    darkModeEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    darkModeStartTime: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "18:00",
    },
    darkModeEndTime: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "06:00",
    },
    emailNotifyEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    notifyEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    smtpHost: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    smtpPort: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 465,
    },
    smtpSecure: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    smtpUser: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    smtpPass: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    smtpFrom: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    emailTemplate: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    upyunEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    upyunBucket: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "",
    },
    upyunOperator: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "",
    },
    upyunPassword: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    upyunDomain: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    upyunPath: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    amapJsKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    amapSecurityJsCode: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    amapKey: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "",
    },
    beianUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    socialLinks: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "[]",
      field: "socialLinks",
    },
    postCollapseLength: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 150,
    },
    fontUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "",
    },
    adOnArchives: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    commentAntiSpamEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    rssEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    rssIncludeMoments: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    doubanId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "",
    },
    bannedWords: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: "site_settings",
  }
);

export default SiteSetting;
