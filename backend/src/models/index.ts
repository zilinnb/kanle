import sequelize from "../config/database";
import User from "./User";
import Post from "./Post";
import Comment from "./Comment";
import Like from "./Like";
import CommentLike from "./CommentLike";
import SiteSetting from "./SiteSetting";
import FriendLink from "./FriendLink";
import Blacklist from "./Blacklist";
import Media from "./Media";
import RssSource from "./RssSource";
import RssArticle from "./RssArticle";

// Associations
User.hasMany(Post, { foreignKey: "userId", as: "posts" });
Post.belongsTo(User, { foreignKey: "userId", as: "author" });

Post.hasMany(Comment, { foreignKey: "postId", as: "comments" });
Comment.belongsTo(Post, { foreignKey: "postId", as: "post" });

Post.hasMany(Like, { foreignKey: "postId", as: "likes" });
Like.belongsTo(Post, { foreignKey: "postId", as: "post" });

Like.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(Like, { foreignKey: "userId", as: "userLikes" });

Comment.hasMany(CommentLike, { foreignKey: "commentId", as: "commentLikes" });
CommentLike.belongsTo(Comment, { foreignKey: "commentId", as: "comment" });
CommentLike.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(CommentLike, { foreignKey: "userId", as: "userCommentLikes" });

Media.belongsTo(User, { foreignKey: "uploaderId", as: "uploader" });
User.hasMany(Media, { foreignKey: "uploaderId", as: "uploadedMedia" });

RssSource.hasMany(RssArticle, { foreignKey: "sourceId", as: "articles" });
RssArticle.belongsTo(RssSource, { foreignKey: "sourceId", as: "source" });

export { sequelize, User, Post, Comment, Like, CommentLike, SiteSetting, FriendLink, Blacklist, Media, RssSource, RssArticle };
export { getMediaCategory } from "./Media";
