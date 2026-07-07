import type { Metadata } from "next";
import AdminPosts from "./AdminPosts";

export const metadata: Metadata = {
  title: "管理后台 - 动态管理",
};

export default function Page() {
  return <AdminPosts />;
}
