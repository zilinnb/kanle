import type { Metadata } from "next";
import AdminFriends from "./AdminFriends";

export const metadata: Metadata = {
  title: "管理后台 - 友链管理",
};

export default function Page() {
  return <AdminFriends />;
}
