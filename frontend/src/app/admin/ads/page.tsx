import type { Metadata } from "next";
import AdminAds from "./AdminAds";

export const metadata: Metadata = {
  title: "管理后台 - 广告管理",
};

export default function Page() {
  return <AdminAds />;
}
