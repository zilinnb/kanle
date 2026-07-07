"use client";

import { useEffect, useState } from "react";
import { Cloud, HardDrive, Server, Zap, Mountain, Flame } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import UpyunConfigSection from "../settings/UpyunConfigSection";

type ProviderKey = "upyun" | "aliyun" | "tencent" | "qiniu" | "volcano";

interface Provider {
  key: ProviderKey;
  name: string;
  shortName: string;
  icon: typeof Cloud;
  color: string;
  desc: string;
  docsUrl: string;
  available: boolean;
}

const PROVIDERS: Provider[] = [
  {
    key: "upyun",
    name: "又拍云",
    shortName: "又拍云",
    icon: Cloud,
    color: "#1b9dec",
    desc: "国内老牌 CDN 与云存储服务商，支持全网加速",
    docsUrl: "https://console.upyun.com/",
    available: true,
  },
  {
    key: "aliyun",
    name: "阿里云 OSS",
    shortName: "阿里云",
    icon: Server,
    color: "#ff6a00",
    desc: "阿里云对象存储 OSS，海量安全低成本高可靠",
    docsUrl: "https://oss.console.aliyun.com/",
    available: false,
  },
  {
    key: "tencent",
    name: "腾讯云 COS",
    shortName: "腾讯云",
    icon: HardDrive,
    color: "#006eff",
    desc: "腾讯云对象存储 COS，稳定安全海量便捷",
    docsUrl: "https://console.cloud.tencent.com/cos",
    available: false,
  },
  {
    key: "qiniu",
    name: "七牛云",
    shortName: "七牛云",
    icon: Mountain,
    color: "#00a4f7",
    desc: "七牛云对象存储 Kodo，国内领先的数据管理服务商",
    docsUrl: "https://portal.qiniu.com/kodo",
    available: false,
  },
  {
    key: "volcano",
    name: "火山引擎 TOS",
    shortName: "火山云",
    icon: Flame,
    color: "#ff5a3c",
    desc: "火山引擎对象存储 TOS，字节跳动旗下云服务",
    docsUrl: "https://console.volcengine.com/tos",
    available: false,
  },
];

function ComingSoon({ provider }: { provider: Provider }) {
  const Icon = provider.icon;
  return (
    <div className="rounded-xl border border-adm-border bg-adm-card p-8">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${provider.color}15` }}
        >
          <Icon className="h-7 w-7" style={{ color: provider.color }} />
        </div>
        <h4 className="mt-4 text-base font-semibold text-adm-text">{provider.name}</h4>
        <p className="mt-1 max-w-md text-sm text-adm-text-secondary">{provider.desc}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-adm-input px-3 py-1 text-xs font-medium text-adm-text-tertiary">
          <Zap className="h-3 w-3" />
          即将支持
        </span>
        <p className="mt-6 text-xs text-adm-text-tertiary">
          该服务商集成正在开发中，敬请期待。如需提前了解可访问
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-adm-primary underline"
          >
            {provider.name}控制台
          </a>
        </p>
      </div>
    </div>
  );
}

export default function AdminStorage() {
  const [activeTab, setActiveTab] = useState<ProviderKey>("upyun");
  const [upyunEnabled, setUpyunEnabled] = useState(false);
  const [upyunConfigured, setUpyunConfigured] = useState(false);

  useEffect(() => {
    apiFetch("/settings/upyun-config")
      .then((res) => res.json())
      .then((data: { upyunEnabled: boolean; upyunBucket: string }) => {
        setUpyunEnabled(data.upyunEnabled);
        setUpyunConfigured(!!data.upyunBucket);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div>
        <h2 className="text-lg font-bold text-adm-text">云端存储</h2>
        <p className="mt-1 text-sm text-adm-text-secondary">
          管理文件存储服务，上传的图片、视频、音频将自动同步到已启用的云存储
        </p>
      </div>

      {/* Tab 栏 */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 rounded-xl border border-adm-border bg-adm-card p-1">
          {PROVIDERS.map((p) => {
            const Icon = p.icon;
            const isActive = activeTab === p.key;
            const showEnabled = p.key === "upyun" && upyunEnabled;
            const showConfigured = p.key === "upyun" && upyunConfigured && !upyunEnabled;
            return (
              <button
                key={p.key}
                onClick={() => setActiveTab(p.key)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-adm-input text-adm-text"
                    : "text-adm-text-tertiary hover:bg-adm-card-hover hover:text-adm-text-secondary"
                }`}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: isActive ? p.color : undefined }}
                />
                {p.shortName}
                {showEnabled && (
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                )}
                {showConfigured && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
                {!p.available && (
                  <span className="rounded bg-adm-text-tertiary/15 px-1 py-0.5 text-[10px] text-adm-text-tertiary">
                    即将
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 内容 */}
      <div>
        {activeTab === "upyun" ? (
          <UpyunConfigSection />
        ) : (
          <ComingSoon provider={PROVIDERS.find((p) => p.key === activeTab)!} />
        )}
      </div>
    </div>
  );
}
