import { Op } from "sequelize";
import Blacklist, { type BlacklistAttributes } from "../models/Blacklist";
import SiteSetting from "../models/SiteSetting";
import { normalizeEmail, normalizeIp } from "../utils/ip";

interface BanCheckResult {
  banned: boolean;
  reason?: string;
  type?: "email" | "ip";
  value?: string;
  expiresAt?: Date | null;
}

interface CacheEntry {
  banned: boolean;
  reason?: string;
  expiresAt?: Date | null;
  cachedAt: number;
}

const CACHE_TTL = 30 * 1000; // 30 秒缓存，平衡实时性与 DB 压力

class BlacklistService {
  private cache = new Map<string, CacheEntry>();

  private key(type: string, value: string): string {
    return `${type}:${value}`;
  }

  private getCached(type: string, value: string): CacheEntry | null {
    const entry = this.cache.get(this.key(type, value));
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL) {
      this.cache.delete(this.key(type, value));
      return null;
    }
    return entry;
  }

  private setCached(type: string, value: string, banned: boolean, reason?: string, expiresAt?: Date | null): void {
    this.cache.set(this.key(type, value), { banned, reason, expiresAt, cachedAt: Date.now() });
  }

  private invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * 检查邮箱和 IP 是否在黑名单中（任一命中即视为封禁）。
   * 优先读缓存，未命中则查数据库，过期记录视为未封禁。
   */
  async check(rawEmail: string, rawIp: string): Promise<BanCheckResult> {
    const email = normalizeEmail(rawEmail);
    const ip = normalizeIp(rawIp);
    const now = new Date();

    // 1. 缓存快速路径
    const emailCached = this.getCached("email", email);
    const ipCached = this.getCached("ip", ip);
    if (emailCached && ipCached) {
      if (emailCached.banned) return { banned: true, type: "email", value: email, reason: emailCached.reason, expiresAt: emailCached.expiresAt };
      if (ipCached.banned) return { banned: true, type: "ip", value: ip, reason: ipCached.reason, expiresAt: ipCached.expiresAt };
      return { banned: false };
    }

    // 2. 数据库查询：邮箱或 IP 任一命中，且未过期
    const records = await Blacklist.findAll({
      where: {
        [Op.and]: [
          {
            [Op.or]: [
              { type: "email", value: email },
              { type: "ip", value: ip },
            ],
          },
          {
            [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
          },
        ],
      },
    });

    // 3. 写缓存（无论是否命中都写，减少 DB 查询）
    const emailHit = records.find((r) => r.type === "email");
    const ipHit = records.find((r) => r.type === "ip");
    this.setCached("email", email, !!emailHit, emailHit?.reason, emailHit?.expiresAt);
    this.setCached("ip", ip, !!ipHit, ipHit?.reason, ipHit?.expiresAt);

    if (emailHit) return { banned: true, type: "email", value: email, reason: emailHit.reason, expiresAt: emailHit.expiresAt };
    if (ipHit) return { banned: true, type: "ip", value: ip, reason: ipHit.reason, expiresAt: ipHit.expiresAt };
    return { banned: false };
  }

  /** 添加封禁；type+value 已存在则更新（覆盖过期时间/原因） */
  async add(
    type: "email" | "ip",
    rawValue: string,
    reason?: string,
    durationMs?: number | null
  ): Promise<Blacklist> {
    const value = type === "email" ? normalizeEmail(rawValue) : normalizeIp(rawValue);
    const expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;
    const [record] = await Blacklist.upsert({
      type,
      value,
      reason: reason || null,
      expiresAt,
    });
    this.invalidateAll();
    return record;
  }

  async remove(id: string): Promise<boolean> {
    const n = await Blacklist.destroy({ where: { id } });
    if (n > 0) this.invalidateAll();
    return n > 0;
  }

  async list(): Promise<Blacklist[]> {
    return Blacklist.findAll({ order: [["createdAt", "DESC"]] });
  }

  /** 清理已过期记录，返回清理条数 */
  async cleanupExpired(): Promise<number> {
    const n = await Blacklist.destroy({
      where: { expiresAt: { [Op.lt]: new Date() } },
    });
    if (n > 0) this.invalidateAll();
    return n;
  }

  // ===== 评论防刷总开关 =====
  private enabledCache: { value: boolean; cachedAt: number } | null = null;
  private readonly ENABLED_TTL = 30 * 1000;

  /**
   * 查询评论防刷总开关（限流 + 黑名单是否生效）。
   * 30 秒内存缓存，避免每次评论都查 site_settings 表。
   */
  async isAntiSpamEnabled(): Promise<boolean> {
    if (this.enabledCache && Date.now() - this.enabledCache.cachedAt < this.ENABLED_TTL) {
      return this.enabledCache.value;
    }
    const setting = await SiteSetting.findByPk(1);
    const value = setting ? setting.commentAntiSpamEnabled : true;
    this.enabledCache = { value, cachedAt: Date.now() };
    return value;
  }

  /** 切换开关后调用，立即让缓存失效 */
  invalidateEnabledCache(): void {
    this.enabledCache = null;
  }

  /** 更新评论防刷开关，立即失效缓存 */
  async setAntiSpamEnabled(enabled: boolean): Promise<void> {
    const setting = await SiteSetting.findByPk(1);
    if (!setting) return;
    setting.commentAntiSpamEnabled = enabled;
    await setting.save();
    this.invalidateEnabledCache();
  }
}

export const blacklistService = new BlacklistService();
