import type { Metadata } from "next";
import AdminPlugins from "./AdminPlugins";

export const metadata: Metadata = {
  title: "管理后台 - 音乐管理",
};

export default function Page() {
  return <AdminPlugins />;
}
