import type { Metadata } from "next";
import AdminDouban from "./AdminDouban";

export const metadata: Metadata = {
  title: "管理后台 - 豆瓣设置",
};

export default function Page() {
  return <AdminDouban />;
}
