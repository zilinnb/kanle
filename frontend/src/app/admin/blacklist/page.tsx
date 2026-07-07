import type { Metadata } from "next";
import AdminBlacklist from "./AdminBlacklist";

export const metadata: Metadata = {
  title: "管理后台 - 黑名单管理",
};

export default function Page() {
  return <AdminBlacklist />;
}
