"use client";

import { useEffect } from "react";
import { useSiteSettings } from "@/lib/site-settings-store";
import AdminRss from "./AdminRss";

export default function Page() {
  const siteName = useSiteSettings((s) => s.siteName);

  useEffect(() => {
    document.title = `订阅友圈 - ${siteName}`;
  }, [siteName]);

  return <AdminRss />;
}
