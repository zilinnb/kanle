import type { Metadata } from "next";
import AdminMedia from "./AdminMedia";

export const metadata: Metadata = {
  title: "管理后台 - 媒体库",
};

export default function Page() {
  return <AdminMedia />;
}
