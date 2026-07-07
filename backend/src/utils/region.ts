import axios from "axios";
import { normalizeIp } from "./ip";

const REGION_CACHE = new Map<string, string>();

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "unknown" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.") ||
    ip.startsWith("fc") ||
    ip.startsWith("fe80")
  );
}

const REGION_SHORT_MAP: Record<string, string> = {
  北京市: "北京",
  天津市: "天津",
  上海市: "上海",
  重庆市: "重庆",
  广西壮族自治区: "广西",
  内蒙古自治区: "内蒙古",
  宁夏回族自治区: "宁夏",
  新疆维吾尔自治区: "新疆",
  西藏自治区: "西藏",
  香港特别行政区: "香港",
  澳门特别行政区: "澳门",
};

function cleanRegionName(region: string): string {
  if (!region) return "";
  if (REGION_SHORT_MAP[region]) return REGION_SHORT_MAP[region];
  if (region.endsWith("省")) return region.slice(0, -1);
  return region;
}

let cachedAmapKey: string | null = null;
let amapKeyCachedAt = 0;

async function getAmapKey(): Promise<string> {
  const now = Date.now();
  if (cachedAmapKey !== null && now - amapKeyCachedAt < 5 * 60 * 1000) {
    return cachedAmapKey;
  }
  let key = "";
  try {
    const { SiteSetting } = await import("../models");
    const setting = await SiteSetting.findByPk(1);
    key = (setting as any)?.amapKey || "";
  } catch {
    key = "";
  }
  cachedAmapKey = key;
  amapKeyCachedAt = now;
  return key;
}

export async function getRegionByIp(ip: string): Promise<string> {
  const normalized = normalizeIp(ip);
  if (!normalized || isPrivateIp(normalized)) return "";
  if (REGION_CACHE.has(normalized)) return REGION_CACHE.get(normalized) || "";

  const amapKey = await getAmapKey();
  if (amapKey) {
    try {
      const res = await axios.get("https://restapi.amap.com/v3/ip", {
        params: { ip: normalized, key: amapKey },
        timeout: 3000,
      });
      const province = res.data?.province;
      if (res.data?.status === "1" && typeof province === "string" && province) {
        const region = cleanRegionName(province);
        REGION_CACHE.set(normalized, region);
        return region;
      }
    } catch {
      // 高德失败，尝试 pconline 兜底
    }
  }

  try {
    const res = await axios.get("http://whois.pconline.com.cn/ipJson.jsp", {
      params: { ip: normalized, json: true },
      responseType: "arraybuffer",
      timeout: 3000,
    });
    const text = new TextDecoder("gbk").decode(res.data as Buffer);
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const json = JSON.parse(match[0]);
      const region = cleanRegionName(json.pro || "");
      REGION_CACHE.set(normalized, region);
      return region;
    }
    return "";
  } catch {
    return "";
  }
}
