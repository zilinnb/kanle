import type { Metadata } from "next";
import AdminUsers from "./AdminUsers";

export const metadata: Metadata = {
  title: "管理后台 - 个人资料",
};

export default function Page() {
  return <AdminUsers />;
}
