import type { Metadata } from "next";
import AdminDashboard from "./AdminDashboard";

export const metadata: Metadata = {
  title: "管理后台 - 仪表盘",
};

export default function Page() {
  return <AdminDashboard />;
}
