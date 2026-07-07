import { Router, Request, Response } from "express";
import { SiteSetting } from "../models";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

/** 将高德 API 错误码翻译为用户可操作的中文提示 */
function amapErrorMessage(data: any): string {
  const infocode = String(data.infocode || "");
  switch (infocode) {
    case "10003":
    case "10005":
      return "INVALID_USER_IP：服务器 IP 未加入白名单。请到高德控制台 → 应用管理 → 找到「Web服务」类型的 Key → 编辑 IP 白名单 → 添加服务器 IP（纯 IP，如 38.55.198.185，不要加 http://）或设为「不绑定」";
    case "10009":
      return "Key 平台类型不匹配：请使用「Web服务」类型的 Key，而非「Web端(JS API)」类型";
    case "10010":
      return "INVALID_USER_KEY：Key 无效或已删除，请检查高德控制台中的 Key";
    case "10044":
      return "USER_DAILY_QUERY_OVER_LIMIT：今日调用量已超限，请明天再试或升级配额";
    case "10004":
      return "USERKEY_NO_PERMISSION：该 Key 无此服务权限，请检查高德控制台是否开通对应服务";
    default:
      return data.info || "高德地图服务异常";
  }
}

/**
 * GET /api/location/key
 * 返回高德 JS API Key + 安全密钥（admin only）
 * 前端动态加载高德 JS API 时需要这两个值
 * amapJsKey 用于前端 JS API 加载（Web端 JS API 类型）
 * amapKey 是后端 REST API 用的 Web服务 Key，不返回给前端
 */
router.get(
  "/key",
  authenticate,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    const setting = await SiteSetting.findByPk(1);
    res.json({
      amapJsKey: setting?.amapJsKey || "",
      amapSecurityJsCode: setting?.amapSecurityJsCode || "",
    });
  }
);

/**
 * GET /api/location/regeo?lng=114.40&lat=30.50
 * 逆地理编码：根据经纬度获取地址和附近 POI 列表（admin only）
 * 返回 { formattedAddress, city, address, pois: [{ name, address, lng, lat }] }
 */
router.get(
  "/regeo",
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    const lng = parseFloat(String(req.query.lng || ""));
    const lat = parseFloat(String(req.query.lat || ""));
    if (isNaN(lng) || isNaN(lat)) {
      res.status(400).json({ message: "缺少有效的经纬度参数" });
      return;
    }
    const setting = await SiteSetting.findByPk(1);
    const amapKey = setting?.amapKey || "";
    if (!amapKey) {
      res.status(500).json({ message: "未配置高德地图 Web服务 Key，请在后台设置中配置" });
      return;
    }

    const params = new URLSearchParams({
      location: `${lng},${lat}`,
      key: amapKey,
      extensions: "all",
      output: "json",
      radius: "500",
      // poitype: 业务类型，留空返回全部
    });

    try {
      const resp = await fetch(
        `https://restapi.amap.com/v3/geocode/regeo?${params.toString()}`
      );
      const data: any = await resp.json();
      if (data.status !== "1") {
        res.status(502).json({ message: amapErrorMessage(data), infocode: data.infocode });
        return;
      }
      const regeo = data.regeocode || {};
      const addrComp = regeo.addressComponent || {};
      const pois = Array.isArray(regeo.pois) ? regeo.pois : [];
      res.json({
        formattedAddress: regeo.formatted_address || "",
        city: String(addrComp.city || addrComp.province || ""),
        province: String(addrComp.province || ""),
        district: String(addrComp.district || ""),
        address: String(addrComp.township || addrComp.neighborhood?.name || ""),
        pois: pois.slice(0, 20).map((poi: any) => {
          const [lngStr, latStr] = String(poi.location || ",").split(",");
          return {
            name: poi.name || "",
            address: poi.address || "",
            lng: lngStr ? parseFloat(lngStr) : undefined,
            lat: latStr ? parseFloat(latStr) : undefined,
          };
        }),
      });
    } catch {
      res.status(502).json({ message: "高德地图请求失败" });
    }
  }
);

/**
 * GET /api/location/search?keywords=光谷&city=武汉
 * 代理高德 REST API 的 POI 搜索，Key 从数据库 site_settings 读取。
 * 返回精简的 POI 列表：[{ name, city, address, lng, lat }]
 */
router.get("/search", async (req: Request, res: Response) => {
  const keywords = String(req.query.keywords || "").trim();
  if (!keywords) {
    res.json([]);
    return;
  }

  const setting = await SiteSetting.findByPk(1);
  const amapKey = setting?.amapKey || "";
  if (!amapKey) {
    res.status(500).json({ message: "未配置高德地图 Key，请在后台设置中配置" });
    return;
  }

  const city = String(req.query.city || "").trim();
  const params = new URLSearchParams({
    keywords,
    key: amapKey,
    offset: "20",
    page: "1",
    extensions: "base",
  });
  if (city) params.set("city", city);

  try {
    const resp = await fetch(
      `https://restapi.amap.com/v3/place/text?${params.toString()}`
    );
    const data: any = await resp.json();

    if (data.status !== "1") {
      res.status(502).json({ message: amapErrorMessage(data), infocode: data.infocode });
      return;
    }

    const pois = Array.isArray(data.pois) ? data.pois : [];
    res.json(
      pois.map((poi: any) => {
        const [lngStr, latStr] = String(poi.location || ",").split(",");
        return {
          name: poi.name || "",
          city: poi.cityname || poi.adname || "",
          address: poi.address || "",
          lng: lngStr ? parseFloat(lngStr) : undefined,
          lat: latStr ? parseFloat(latStr) : undefined,
        };
      })
    );
  } catch {
    res.status(502).json({ message: "高德地图请求失败" });
  }
});

/**
 * GET /api/location/ip
 * IP 定位：根据请求者的 IP 返回城市级别位置（admin only）
 * 作为 GPS 定位失败时的 fallback，精度为城市级别
 * 高德 IP 定位 API 返回 rectangle（城市矩形范围），取中心点作为定位结果
 */
router.get(
  "/ip",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    const setting = await SiteSetting.findByPk(1);
    const amapKey = setting?.amapKey || "";
    if (!amapKey) {
      res.status(500).json({ message: "未配置高德地图 Web服务 Key，请在后台设置中配置" });
      return;
    }

    // 获取真实客户端 IP（穿透代理）
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      (req.headers["x-real-ip"] as string) ||
      req.ip ||
      "";

    const params = new URLSearchParams({ key: amapKey });
    if (ip) params.set("ip", ip);

    try {
      const resp = await fetch(
        `https://restapi.amap.com/v3/ip?${params.toString()}`
      );
      const data: any = await resp.json();
      if (data.status !== "1") {
        res.status(502).json({ message: amapErrorMessage(data), infocode: data.infocode });
        return;
      }
      // rectangle 格式: "lng1,lat1;lng2,lat2" — 取中心点
      const rect = String(data.rectangle || "");
      let lng: number | undefined;
      let lat: number | undefined;
      if (rect) {
        const [p1, p2] = rect.split(";");
        if (p1 && p2) {
          const [lng1, lat1] = p1.split(",").map(Number);
          const [lng2, lat2] = p2.split(",").map(Number);
          if (!isNaN(lng1) && !isNaN(lng2)) lng = (lng1 + lng2) / 2;
          if (!isNaN(lat1) && !isNaN(lat2)) lat = (lat1 + lat2) / 2;
        }
      }
      res.json({
        lng,
        lat,
        province: String(data.province || ""),
        city: String(data.city || ""),
        adcode: String(data.adcode || ""),
        locationType: "ip",
        accuracy: 5000, // IP 定位精度约 5 公里
      });
    } catch {
      res.status(502).json({ message: "高德 IP 定位请求失败" });
    }
  }
);

export default router;
