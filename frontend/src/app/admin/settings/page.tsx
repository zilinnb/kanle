import type { Metadata } from "next";
import AdminSettings from "./AdminSettings";

export const metadata: Metadata = {
  title: "管理后台 - 网站设置",
};

export default function Page() {
  return <AdminSettings />;
}
