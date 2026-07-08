"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, Search } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import type { PostLocation } from "@/lib/mock-data";
import { wgs84ToGcj02 } from "@/lib/coord-transform";
import { useExitAnimation } from "@/lib/use-exit-animation";

interface LocationPickerProps {
  onSelect: (loc: PostLocation | null) => void;
  onClose: () => void;
  initial?: PostLocation | null;
}

// 全局 amap 加载状态：避免重复加载
let amapLoaderPromise: Promise<void> | null = null;

async function loadAmap(key: string, securityCode: string): Promise<void> {
  if ((window as any).AMap) return;
  if (amapLoaderPromise) return amapLoaderPromise;

  amapLoaderPromise = new Promise<void>((resolve, reject) => {
    if (securityCode) {
      (window as any)._AMapSecurityConfig = { securityJsCode: securityCode };
    }
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
      key
    )}&plugin=AMap.Geocoder,AMap.Geolocation`;
    script.async = true;
    script.onload = () => {
      const AMap = (window as any).AMap;
      if (!AMap || typeof AMap.Map !== "function") {
        amapLoaderPromise = null;
        reject(
          new Error(
            "地图加载失败：请检查 JS API Key 是否正确、域名白名单是否包含 kanle.net"
          )
        );
        return;
      }
      resolve();
    };
    script.onerror = () => {
      amapLoaderPromise = null;
      reject(new Error("高德地图脚本加载失败，请检查网络连接"));
    };
    document.head.appendChild(script);
  });

  return amapLoaderPromise;
}

export default function LocationPicker({
  onSelect,
  onClose,
  initial,
}: LocationPickerProps) {
  const { closing, handleClose } = useExitAnimation(onClose, 200);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用户是否手动编辑过 customName（编辑过则移动地图时不再覆盖）
  const userEditedRef = useRef(false);

  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState("");
  const [regeoError, setRegeoError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<PostLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [nearbyPois, setNearbyPois] = useState<PostLocation[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [locating, setLocating] = useState(false);
  // 定位方式反馈：gps（高精度）/ ip（城市级）/ browser（浏览器混合）
  const [locationType, setLocationType] = useState("");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [locationAttempted, setLocationAttempted] = useState(false);

  // 当前位置状态
  const [customName, setCustomName] = useState(initial?.name || "");
  const [currentCity, setCurrentCity] = useState(initial?.city || "");
  const [currentProvince, setCurrentProvince] = useState(initial?.province || "");
  const [currentAddress, setCurrentAddress] = useState(initial?.address || "");
  const [currentLatLng, setCurrentLatLng] = useState<{
    lng: number;
    lat: number;
  } | null>(
    initial?.lng && initial?.lat
      ? { lng: initial.lng, lat: initial.lat }
      : null
  );

  // 初始化地图
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch("/location/key");
        if (!res.ok) throw new Error("无法获取地图配置");
        const { amapJsKey, amapSecurityJsCode } = await res.json();
        if (!amapJsKey) {
          throw new Error("未配置高德地图 JS API Key，请在后台设置中配置");
        }
        await loadAmap(amapJsKey, amapSecurityJsCode);
        if (cancelled) return;

        const AMap = (window as any).AMap;
        const center: [number, number] =
          initial?.lng && initial?.lat
            ? [initial.lng, initial.lat]
            : [114.305469, 30.592849]; // 默认武汉

        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 16,
          center,
          resizeEnable: true,
        });
        mapRef.current = map;

        const marker = new AMap.Marker({
          position: center,
          anchor: "bottom-center",
        });
        map.add(marker);
        markerRef.current = marker;

        geocoderRef.current = new AMap.Geocoder({ extensions: "all" });

        // 初始化时立即设置 currentLatLng，确保"完成"按钮可用
        setCurrentLatLng({ lng: center[0], lat: center[1] });

        // 地图移动 → marker 跟随中心 → 防抖逆地理编码
        map.on("mapMove", () => {
          const c = map.getCenter();
          marker.setPosition([c.lng, c.lat]);
          setCurrentLatLng({ lng: c.lng, lat: c.lat });
          scheduleReverse(c.lng, c.lat);
        });

        setLoadingMap(false);

        // 初始化数据：无论有无初始值都用当前中心做逆地理
        reverseGeocode(center[0], center[1]);
        // 无初始值时尝试 GPS 定位
        if (!initial?.lng || !initial?.lat) {
          tryLocate();
        }
      } catch (e: any) {
        if (cancelled) return;
        setMapError(e.message || "地图加载失败");
        setLoadingMap(false);
      }
    })();

    return () => {
      cancelled = true;
      if (reverseTimerRef.current) {
        clearTimeout(reverseTimerRef.current);
        reverseTimerRef.current = null;
      }
      if (mapRef.current) {
        try {
          mapRef.current.destroy();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 防抖触发逆地理编码
  const scheduleReverse = (lng: number, lat: number) => {
    if (reverseTimerRef.current) {
      clearTimeout(reverseTimerRef.current);
    }
    reverseTimerRef.current = setTimeout(() => {
      reverseGeocode(lng, lat);
    }, 600);
  };

  // 逆地理编码：通过后端代理获取地址 + 附近 POI
  const reverseGeocode = async (lng: number, lat: number) => {
    setLoadingNearby(true);
    setRegeoError("");
    try {
      const res = await apiFetch(
        `/location/regeo?lng=${lng}&lat=${lat}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "逆地理编码失败");

      setCurrentCity(data.city || "");
      setCurrentProvince(data.province || "");
      setCurrentAddress(data.formattedAddress || "");
      setNearbyPois(data.pois || []);

      // 用户未手动编辑过 → 自动填充名称为第一个 POI 或格式化地址
      if (!userEditedRef.current) {
        if (data.pois?.[0]?.name) {
          setCustomName(data.pois[0].name);
        } else if (data.formattedAddress) {
          setCustomName(data.formattedAddress);
        }
      }
    } catch (e: any) {
      setRegeoError(e.message || "获取附近地点失败");
      setNearbyPois([]);
      // regeo 失败时，给 customName 一个默认值，确保"完成"按钮可用
      if (!userEditedRef.current) {
        setCustomName((prev) => prev || currentCity || "我的位置");
      }
    } finally {
      setLoadingNearby(false);
    }
  };

  // 深度优化定位流程：三种 GPS 定位并行执行，取精度最高结果
  // 1. 快速浏览器定位（WiFi/基站，8秒超时）— 先给出大致位置
  // 2. 精确浏览器 GPS 定位（30秒超时）— GPS 芯片精确定位
  // 3. 高德 GPS 定位（30秒超时）— 高德 SDK 定位（noIpLocate:1 强制 GPS）
  // 4. IP 定位 — 兜底，城市级精度（所有 GPS 失败后使用）
  // 并行执行避免串行等待，任何一种返回立即应用，更好的结果自动更新
  const tryLocate = () => {
    const AMap = (window as any).AMap;

    interface LocateResult {
      lng: number;
      lat: number;
      accuracy: number;
      type: string;
    }

    // 应用定位结果到地图和状态
    const applyResult = (r: LocateResult) => {
      if (mapRef.current) {
        const zoom = r.accuracy > 1000 ? 13 : r.accuracy > 200 ? 15 : 17;
        mapRef.current.setZoomAndCenter(zoom, [r.lng, r.lat]);
        markerRef.current?.setPosition([r.lng, r.lat]);
        setCurrentLatLng({ lng: r.lng, lat: r.lat });
        scheduleReverse(r.lng, r.lat);
      }
      setLocationType(r.type);
      setLocationAccuracy(r.accuracy);
    };

    // 快速浏览器定位（WiFi/基站，低精度，8秒超时）
    // enableHighAccuracy:false 让浏览器用 WiFi/基站快速返回大致位置
    // maximumAge:30000 允许 30 秒内的缓存位置，加速首次返回
    const quickBrowserLocate = (): Promise<LocateResult | null> => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { longitude, latitude, accuracy } = pos.coords;
            const [gcjLng, gcjLat] = wgs84ToGcj02(longitude, latitude);
            resolve({ lng: gcjLng, lat: gcjLat, accuracy: accuracy || 9999, type: "browser" });
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) setPermissionDenied(true);
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
        );
      });
    };

    // 精确浏览器 GPS 定位（高精度，30秒超时）
    // enableHighAccuracy:true 强制使用 GPS 芯片
    // maximumAge:5000 允许 5 秒内缓存，平衡速度与精度
    const preciseBrowserLocate = (): Promise<LocateResult | null> => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { longitude, latitude, accuracy } = pos.coords;
            const [gcjLng, gcjLat] = wgs84ToGcj02(longitude, latitude);
            resolve({ lng: gcjLng, lat: gcjLat, accuracy: accuracy || 9999, type: "browser" });
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) setPermissionDenied(true);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
        );
      });
    };

    // 高德 GPS 定位（noIpLocate:1 强制 GPS，不返回 IP 结果）
    // 高德 SDK 在浏览器环境中内部仍调用 navigator.geolocation，
    // 但某些国产浏览器（小米/华为自带浏览器）可能对高德 SDK 有特殊适配
    const amapLocate = (): Promise<LocateResult | null> => {
      return new Promise((resolve) => {
        if (!AMap?.Geolocation) { resolve(null); return; }
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 30000,
          GeoLocationFirst: true,
          showButton: false,
          showMarker: false,
          noIpLocate: 1,
        });
        geolocation.getCurrentPosition((status: string, result: any) => {
          if (status === "complete" && result?.position) {
            resolve({
              lng: result.position.lng,
              lat: result.position.lat,
              accuracy: result.accuracy || 9999,
              type: result.location_type || "gps",
            });
          } else {
            resolve(null);
          }
        });
      });
    };

    // IP 定位 fallback：通过后端调用高德 IP 定位 API
    const ipLocate = async (): Promise<LocateResult | null> => {
      try {
        const res = await apiFetch("/location/ip");
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "IP 定位失败");
        if (data.lng && data.lat) {
          if (data.city) {
            setCurrentCity(data.city);
            setCustomName((prev) => prev || data.city);
          }
          if (data.province) {
            setCurrentProvince(data.province);
          }
          return {
            lng: data.lng,
            lat: data.lat,
            accuracy: data.accuracy || 5000,
            type: "ip",
          };
        }
      } catch {
        // IP 定位也失败
      }
      return null;
    };

    // 并行执行所有定位方式，取精度最高结果
    setLocating(true);
    setLocationType("");
    setLocationAccuracy(null);
    setPermissionDenied(false);
    setLocationAttempted(true);

    let bestResult: LocateResult | null = null;
    let hasApplied = false;

    // 首次结果直接应用；后续结果仅在精度提升 30% 以上时更新（避免地图跳动）
    const applyIfBetter = (result: LocateResult | null) => {
      if (!result) return;
      if (!bestResult || result.accuracy < bestResult.accuracy * 0.7) {
        bestResult = result;
        applyResult(result);
        hasApplied = true;
      }
    };

    (async () => {
      // 三种 GPS 定位并行执行
      await Promise.all([
        quickBrowserLocate().then(applyIfBetter),
        preciseBrowserLocate().then(applyIfBetter),
        amapLocate().then(applyIfBetter),
      ]);

      // GPS 都失败 → IP 兜底
      if (!hasApplied) {
        const ipResult = await ipLocate();
        if (ipResult) {
          applyResult(ipResult);
        } else {
          setLocationType("");
          setLocationAccuracy(null);
        }
      }
      setLocating(false);
    })();
  };

  // 搜索地点
  const handleSearch = async () => {
    const kw = keyword.trim();
    if (!kw) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch(
        `/location/search?keywords=${encodeURIComponent(kw)}`
      );
      const data = await res.json();
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // 选择搜索结果
  const pickSearchResult = (poi: PostLocation) => {
    if (mapRef.current && poi.lng && poi.lat) {
      mapRef.current.setZoomAndCenter(16, [poi.lng, poi.lat]);
      markerRef.current?.setPosition([poi.lng, poi.lat]);
      setCurrentLatLng({ lng: poi.lng, lat: poi.lat });
    }
    // 标记为用户已选择，覆盖名称
    userEditedRef.current = false;
    setCustomName(poi.name);
    setCurrentCity(poi.city || "");
    setCurrentProvince(poi.province || "");
    setCurrentAddress(poi.address || "");
    setKeyword("");
    setSearchResults([]);
    // 触发附近列表更新
    if (poi.lng && poi.lat) {
      reverseGeocode(poi.lng, poi.lat);
    }
  };

  // 选择附近 POI
  const pickNearbyPoi = (poi: PostLocation) => {
    if (mapRef.current && poi.lng && poi.lat) {
      mapRef.current.setZoomAndCenter(17, [poi.lng, poi.lat]);
      markerRef.current?.setPosition([poi.lng, poi.lat]);
      setCurrentLatLng({ lng: poi.lng, lat: poi.lat });
    }
    userEditedRef.current = false;
    setCustomName(poi.name);
    // 重新获取该点附近列表
    if (poi.lng && poi.lat) {
      reverseGeocode(poi.lng, poi.lat);
    }
  };

  // 用户手动编辑名称
  const handleNameChange = (val: string) => {
    userEditedRef.current = true;
    setCustomName(val);
  };

  // 完成选择
  const handleConfirm = () => {
    if (!customName.trim() || !currentLatLng) return;
    onSelect({
      name: customName.trim(),
      city: currentCity,
      province: currentProvince,
      address: currentAddress,
      lng: currentLatLng.lng,
      lat: currentLatLng.lat,
    });
  };

  return (
    <div className={`absolute inset-0 z-20 flex flex-col overflow-hidden bg-wechat-white md:rounded-2xl dark:bg-[#232328] ${
      closing ? "animate-modal-out" : "animate-modal-in"
    }`}>
      {/* 顶部栏 */}
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
        <button
          onClick={handleClose}
          className="text-sm text-wechat-time hover:text-wechat-text"
        >
          取消
        </button>
        <span className="text-sm font-medium text-wechat-text dark:text-gray-200">
          选择位置
        </span>
        <button
          onClick={handleConfirm}
          disabled={!customName.trim() || !currentLatLng}
          className="text-sm font-medium disabled:text-wechat-time enabled:text-green-500"
        >
          完成
        </button>
      </div>

      {/* 地图区域 */}
      <div className="relative h-[220px] w-full bg-wechat-bubble md:h-[260px] dark:bg-white/5">
        <div ref={mapContainerRef} className="h-full w-full" />
        {loadingMap && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-wechat-time">
            地图加载中...
          </div>
        )}
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-red-500">
            {mapError}
          </div>
        )}
        {/* GPS 定位按钮 */}
        {!loadingMap && !mapError && (
          <button
            onClick={tryLocate}
            disabled={locating}
            className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition-transform active:scale-90 dark:bg-[#3a3a42]"
            title="获取当前位置"
          >
            <LocateFixed
              className={`h-5 w-5 ${
                locating ? "text-green-500" : "text-wechat-text dark:text-gray-200"
              }`}
            />
          </button>
        )}
        {/* 定位方式反馈提示 */}
        {locationType && !locating && !permissionDenied && (
          <div className="absolute left-3 top-3 max-w-[70%] rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
            {locationType === "gps" && "GPS 定位"}
            {locationType === "ip" && "IP 定位（精度较低，请拖动地图调整）"}
            {locationType === "browser" && locationAccuracy !== null && (
              <>
                浏览器定位
                {locationAccuracy > 1000
                  ? "（精度较低，请拖动地图调整）"
                  : `（误差约 ${Math.round(locationAccuracy)} 米）`}
              </>
            )}
            {locationType === "browser" && locationAccuracy === null && "浏览器定位"}
          </div>
        )}
        {/* 权限拒绝提示（优先级高于定位方式提示） */}
        {permissionDenied && !locating && (
          <div className="absolute left-3 top-3 max-w-[80%] rounded-lg bg-red-500/80 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
            {locationType === "ip"
              ? "位置权限被拒绝，已使用 IP 定位，请拖动地图调整"
              : "位置权限被拒绝，请在浏览器设置中允许位置权限后重试"}
          </div>
        )}
        {/* 定位失败提示（所有方法均失败） */}
        {locationAttempted && !locationType && !locating && !permissionDenied && (
          <div className="absolute left-3 top-3 max-w-[80%] rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
            定位失败，请拖动地图或搜索地点
          </div>
        )}
      </div>

      {/* 搜索栏 */}
      <div className="border-b border-black/5 p-3 dark:border-white/5">
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="搜索地点"
            className="min-w-0 flex-1 rounded-lg border border-black/5 bg-wechat-bubble px-3 py-2 text-sm text-wechat-text placeholder:text-wechat-time focus:outline-none dark:border-white/5 dark:bg-white/5 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !keyword.trim()}
            className="shrink-0 rounded-lg px-4 text-sm font-medium transition-colors disabled:bg-wechat-bubble disabled:text-wechat-time enabled:bg-green-500 enabled:text-white enabled:hover:bg-green-600 dark:disabled:bg-white/5 dark:disabled:text-gray-500"
          >
            {searching ? "..." : "搜索"}
          </button>
        </div>
      </div>

      {/* 列表区域 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {searchResults.length > 0 ? (
          <div className="divide-y divide-black/5 dark:divide-white/5">
            {searchResults.map((poi, i) => (
              <button
                key={`s-${i}`}
                onClick={() => pickSearchResult(poi)}
                className="block w-full px-4 py-3 text-left transition-colors hover:bg-wechat-bubble dark:hover:bg-white/5"
              >
                <p className="text-[15px] font-medium text-wechat-text dark:text-gray-200">
                  {poi.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-wechat-time">
                  {poi.city}
                  {poi.address ? ` · ${poi.address}` : ""}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* 自定义名称输入区 */}
            <div className="border-b border-black/5 px-4 py-3 dark:border-white/5">
              <p className="mb-1 text-xs text-wechat-time">
                位置名称（可自定义编辑）
              </p>
              <input
                type="text"
                value={customName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="点击输入或修改位置名称"
                className="w-full rounded-lg border border-black/5 bg-wechat-bubble px-3 py-2 text-sm text-wechat-text placeholder:text-wechat-time focus:border-green-500 focus:outline-none dark:border-white/5 dark:bg-white/5 dark:text-gray-200 dark:placeholder:text-gray-500"
              />
              {currentAddress && (
                <p className="mt-1.5 truncate text-xs text-wechat-time">
                  {currentCity ? `${currentCity} · ` : ""}
                  {currentAddress}
                </p>
              )}
              {loadingNearby && (
                <p className="mt-1 text-xs text-wechat-time">
                  正在获取附近地点...
                </p>
              )}
            </div>

            {/* 附近 POI */}
            <div className="py-1">
              <p className="px-4 pt-2 text-xs text-wechat-time">附近地点</p>
              {regeoError && !loadingNearby && (
                <p className="px-4 py-3 text-center text-xs text-red-500">
                  {regeoError}
                </p>
              )}
              {nearbyPois.length === 0 && !loadingNearby && !regeoError && (
                <p className="px-4 py-4 text-center text-xs text-wechat-time">
                  {mapError
                    ? "地图不可用，请搜索地点"
                    : "移动地图查看附近地点"}
                </p>
              )}
              {loadingNearby && nearbyPois.length === 0 && (
                <div className="space-y-2 px-4 py-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i}>
                      <div className="h-4 w-1/2 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                      <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-wechat-bubble dark:bg-white/5" />
                    </div>
                  ))}
                </div>
              )}
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {nearbyPois.map((poi, i) => (
                  <button
                    key={`n-${i}`}
                    onClick={() => pickNearbyPoi(poi)}
                    className="block w-full px-4 py-3 text-left transition-colors hover:bg-wechat-bubble dark:hover:bg-white/5"
                  >
                    <p className="text-[15px] font-medium text-wechat-text dark:text-gray-200">
                      {poi.name}
                    </p>
                    {poi.address && (
                      <p className="mt-0.5 truncate text-xs text-wechat-time">
                        {poi.address}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
