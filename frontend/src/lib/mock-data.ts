export interface User {
  id: string;
  email?: string;
  nickname: string;
  avatar: string;
  cover: string;
  bio: string;
}

export interface Comment {
  id: string;
  author: string;
  email?: string;
  website?: string;
  replyTo?: string;
  content: string;
  createdAt: string;
  /** 该评论的点赞数（文章详情页用） */
  likeCount?: number;
  /** 当前访客是否已点赞该评论 */
  meLiked?: boolean;
  /** 服务端标记：该评论是否由文章作者发布 */
  isAuthor?: boolean;
  /** 评论发布者的省份（IP 反查得到，仅显示用） */
  region?: string;
}

export interface PostMusic {
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
   * 插件特定字段对象（songmid/hash/bvid/cid 等），透传给后端插件 getMediaSource/getLyric。
   * 对齐洛水 IMusicItem 全字段方案：搜索→存储→播放全程保留插件字段。
   */
  extra?: Record<string, any>;
  /** LRC 歌词文本（上传歌曲时由用户编辑/标记，播放时客户端解析） */
  lrc?: string;
  /** 进入文章详情页时是否自动播放此音乐 */
  autoplay?: boolean;
}

export interface LinkCard {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export interface PostVideo {
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

export interface PostLocation {
  name: string;
  city: string;
  province?: string;
  address?: string;
  lng?: number;
  lat?: number;
}

// PostImage = 普通图片(string) 或 实况图对象 { src, video? }
// 旧数据 images: string[] 仍兼容；新数据可含实况图对象
export type PostImage = string | { src: string; video?: string };

export interface Post {
  id: string;
  shortId?: string;
  /** moment=朋友圈动态（默认），article=长文章 */
  type?: "moment" | "article";
  /** 文章标题 */
  title?: string;
  /** 文章摘要 */
  excerpt?: string;
  /** 文章封面图 URL */
  cover?: string;
  /** 文章分类 */
  category?: string;
  /** 发帖省份（IP 解析简称，如"湖北"） */
  region?: string;
  /** 文章类型：original=原创，repost=转载，ai=AI生成 */
  articleType?: "original" | "repost" | "ai";
  author: User;
  content: string;
  images: PostImage[];
  location?: PostLocation | null;
  music?: PostMusic | null;
  linkCard?: LinkCard | null;
  video?: PostVideo | null;
  pinned?: boolean;
  isAd?: boolean;
  adAvatar?: string;
  adNickname?: string;
  likesDisabled?: boolean;
  commentsDisabled?: boolean;
  createdAt: string;
  likes: Array<{ name: string; email?: string }>;
  comments: Comment[];
  /** 当前访客是否已点赞（基于 IP/email/userId 判断，跨浏览器同 IP 一致） */
  meLiked?: boolean;
  /** 阅读量（文章详情页客户端 fetch ?view=1 时递增） */
  viewCount?: number;
}

// Cravatar avatar URL. Each nickname gets a stable MD5 hash so Cravatar returns
// a unique built-in "wavatar" face when the email is not registered.
// Docs: https://cravatar.com/developer/api
function cravatar(nickname: string): string {
  const hashMap: Record<string, string> = {
    "锦的朋友圈": "3f388dfc60fb7380e503e661615be197",
    Kam: "d968a18370429ceee4e7fb0268ec50bf",
    CC: "e0323a9039add2978bf5b49550572c7c",
    DD: "1aabac6d068eef6a7bad3fdf50a05cc8",
    雁七: "5da2f59100950c8f5238d8f95f7c96a3",
    本牛千智: "152fd4f64a869c8875207d0ee9b69f6f",
    lcc: "d18f6736f3e3f8a57f06409359a4cdd6",
    FF: "633de4b0c14ca52ea2432a3c8a5c4c31",
    "30位访客": "93ae5cbc1da09380961b88c147630d81",
  };
  const hash =
    hashMap[nickname] ??
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  // Use Cravatar's built-in "wavatar" default so every hash produces a unique
  // cartoon face without query-string limitations on custom fallback URLs.
  return `https://cravatar.cn/avatar/${hash}?s=200&d=wavatar`;
}

export const owner: User = {
  id: "u1",
  nickname: "小予",
  avatar: "/avatar-owner.svg",
  cover: "https://picsum.photos/seed/momentscover/1200/600",
  bio: "这是一个朋友圈博客程序",
};

export const posts: Post[] = [
  {
    id: "p1",
    author: {
      id: "u2",
      nickname: "Kam",
      avatar: cravatar("Kam"),
      cover: "",
      bio: "",
    },
    content: "",
    images: [
      "https://picsum.photos/seed/temple1/400/400",
      "https://picsum.photos/seed/temple2/400/400",
      "https://picsum.photos/seed/temple3/400/400",
    ],
    createdAt: minutesAgo(4),
    likes: [{ name: "DD" }, { name: "30位访客" }],
    comments: [
      {
        id: "c1",
        author: "CC",
        content:
          "你好博主，我想知道这个主题如果写长文章，会以怎样的样式呈现？是依旧朋友圈状态长文收缩，还是类似公众号文章分享卡片，又或者有其他自定义方式？",
        createdAt: minutesAgo(3),
      },
      {
        id: "c2",
        author: "雁七",
        content:
          "想购买主题，想咨询一下是不是wordpress的，微信号一直没找着啊",
        createdAt: minutesAgo(3),
      },
      {
        id: "c3",
        author: "本牛千智",
        content: "主题介绍在哪",
        createdAt: minutesAgo(2),
      },
      {
        id: "c4",
        author: "Kam",
        replyTo: "本牛千智",
        content: "往下翻",
        createdAt: minutesAgo(2),
      },
      {
        id: "c5",
        author: "lcc",
        replyTo: "Kam",
        content:
          "想问问能不能和普通wp一样设置回复可见，以及其他人登录后也可以发朋友圈。",
        createdAt: minutesAgo(1),
      },
      {
        id: "c6",
        author: "本牛千智",
        content: "这个可以像朋友圈那样发视频不？",
        createdAt: minutesAgo(1),
      },
      {
        id: "c7",
        author: "Kam",
        replyTo: "本牛千智",
        content: "可以的",
        createdAt: minutesAgo(1),
      },
      {
        id: "c8",
        author: "FF",
        content: "你怎么跑清水寺 Happy 了。",
        createdAt: minutesAgo(1),
      },
      {
        id: "c9",
        author: "Kam",
        replyTo: "FF",
        content: "哈哈，京都特种兵。",
        createdAt: minutesAgo(1),
      },
    ],
  },
  {
    id: "p2",
    author: owner,
    content:
      "做了一款“朋友圈风格”的个人博客主题，支持图片、视频、长文、评论、点赞，手机电脑都能看。欢迎来逛。",
    images: ["https://picsum.photos/seed/blogtheme/600/400"],
    createdAt: "2025-11-10T09:12:00+08:00",
    likes: [{ name: "Kam" }, { name: "雁七" }, { name: "CC" }],
    comments: [
      {
        id: "c10",
        author: "Kam",
        content: "整体风格很干净，期待上线。",
        createdAt: "2025-11-10T09:30:00+08:00",
      },
    ],
  },
  {
    id: "p3",
    author: owner,
    content: "周末去了趟海边，风很大，但天很蓝。",
    images: [
      "https://picsum.photos/seed/sea1/400/400",
      "https://picsum.photos/seed/sea2/400/400",
      "https://picsum.photos/seed/sea3/400/400",
      "https://picsum.photos/seed/sea4/400/400",
    ],
    createdAt: "2025-11-05T18:45:00+08:00",
    likes: [{ name: "DD" }, { name: "lcc" }],
    comments: [],
  },
  {
    id: "p4",
    author: {
      id: "u3",
      nickname: "CC",
      avatar: cravatar("CC"),
      cover: "",
      bio: "",
    },
    content:
      "长文测试：有时候，我们总想用一段文字记录当下的情绪。朋友圈的仪式感在于，它不像公众号那样正式，也不像微博那样喧嚣。它是一份只给在乎的人看的日记。愿这个主题能帮你把生活过得更像生活。",
    images: [],
    createdAt: "2025-10-28T21:00:00+08:00",
    likes: [{ name: "锦的朋友圈" }, { name: "Kam" }],
    comments: [
      {
        id: "c11",
        author: "雁七",
        content: "写得太好了。",
        createdAt: "2025-10-28T21:10:00+08:00",
      },
    ],
  },
];

function minutesAgo(n: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - n);
  return d.toISOString();
}

export function formatWeChatDate(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "刚刚";
  if (diffHour < 1) return `${diffMin}分钟前`;
  if (diffDay < 1) return `${diffHour}小时前`;
  if (diffDay === 1) return "昨天";
  if (diffDay < 3) return `${diffDay}天前`;

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 详情页动态时间格式（微信朋友圈风格）
 * - 今天 → "今天 20:53"
 * - 昨天 → "昨天 20:53"
 * - 更早（同年）→ "4月27日 17:07"
 * - 更早（不同年）→ "2026年4月27日 17:07"
 */
export function formatDetailTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hhmm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((todayStart.getTime() - dateStart.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return `今天 ${hhmm}`;
  if (diffDays === 1) return `昨天 ${hhmm}`;

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hhmm}`;
}

/** 文章详情页时间格式：始终完整日期 "2026年2月11日 15:13"（不显示今天/昨天） */
export function formatArticleTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const VIDEO_PLATFORM_LABELS: Record<string, string> = {
  douyin: "抖音",
  kuaishou: "快手",
  xhs: "小红书",
  weibo: "微博",
  bilibili: "哔哩哔哩",
  upload: "本地上传",
  url: "链接",
  embed: "嵌入视频",
};

const MUSIC_PLATFORM_LABELS: Record<string, string> = {
  netease: "网易云音乐",
  qq: "QQ音乐",
  musicfree: "MusicFree",
  upload: "本地上传",
  migu: "咪咕音乐",
  kuwo: "酷我音乐",
  kugou: "酷狗音乐",
};

/**
 * MusicFree 插件 platform 名（如"小秋音乐"）→ 真实音乐平台中文名。
 * 与 TopBar.tsx 共享，保证发布与展示口径一致。
 */
export const MUSIC_PLUGIN_LABELS: Record<string, string> = {
  小秋音乐: "QQ音乐",
  小蜗音乐: "酷我音乐",
  小枸音乐: "酷狗音乐",
  小蜜音乐: "咪咕音乐",
  小芸音乐: "网易云音乐",
};

/** 根据动态的媒体内容返回"来自XXX"的平台标签 */
export function getPostSourceLabel(post: Post): string | null {
  if (post.type === "article") return "文章";
  if (post.video) {
    const p = post.video.platform;
    if (p && VIDEO_PLATFORM_LABELS[p]) return VIDEO_PLATFORM_LABELS[p];
    if (post.video.source === "upload") return "本地上传";
    if (post.video.source === "parse") return "视频平台";
    return "视频";
  }
  if (post.music) {
    // 本地上传不显示来源标签
    if (post.music.source === "upload") return null;
    // MusicFree 插件：platform 存的是插件名（如"小秋音乐"），映射为平台中文名
    const p = post.music.platform;
    if (p) {
      if (MUSIC_PLUGIN_LABELS[p]) return MUSIC_PLUGIN_LABELS[p];
      if (MUSIC_PLATFORM_LABELS[p]) return MUSIC_PLATFORM_LABELS[p];
      // 已是可读平台名（如旧数据 netease 已被上面 MUSIC_PLATFORM_LABELS 覆盖）
      return p;
    }
    // 旧数据兼容：仅有 source 无 platform
    if (post.music.source === "netease") return "网易云音乐";
    // 无法判断具体平台时不显示无意义的"音乐"标签
    return null;
  }
  return null;
}

/**
 * 评论时间格式：月日 + 时分（不带今天/昨天，不带年份）
 * 例："1月9日 01:33"
 */
export function formatCommentTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
