import type { Metadata } from "next";
import ArticleEditorPage from "@/components/admin/ArticleEditorPage";

export const metadata: Metadata = {
  title: "写文章 - 管理后台",
};

export default function NewArticlePage() {
  return <ArticleEditorPage />;
}
