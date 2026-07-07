import type { Metadata } from "next";
import ArticleEditorPage from "@/components/admin/ArticleEditorPage";

export const metadata: Metadata = {
  title: "编辑文章 - 管理后台",
};

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ArticleEditorPage articleId={id} />;
}
