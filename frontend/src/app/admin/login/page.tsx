import type { Metadata } from "next";
import AdminLogin from "./AdminLogin";

export const metadata: Metadata = {
  title: "管理后台 - 登录",
};

export default function Page() {
  return <AdminLogin />;
}
