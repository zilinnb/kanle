import type { Metadata } from "next";
import AdminComments from "./AdminComments";

export const metadata: Metadata = {
  title: "管理后台 - 评论管理",
};

export default function Page() {
  return <AdminComments />;
}
