import CryptoJS from "crypto-js";
import type {
  ConnectedDevice,
  DashboardData,
  LiveSpeed,
  MacFilterState,
  RouterInfo,
  SignalInfo,
  TrafficStats,
} from "./router-types";
import type { RouterProfile } from "./profiles";
import { macFilterModeFromCode } from "./format";
import {
  buildHuaweiMacFilterSlots,
  bytesPerSecondToKbps,
  getVerificationTokens,
  HUAWEI_MAC_FILTER_SLOTS,
  huaweiScram,
  networkTypeLabel,
  object2xml,
  parseHostList,
  parseHuaweiMacFilterSlots,
  parseHuaweiSsidBlocks,
  parseXmlResponse,
  xmlHasError,
} from "./huawei/helpers";

export class HuaweiRouterClient {
  private cookie = "";
  private tokens: string[] = [];
  private loggedIn = false;
  private lastLogin = 0;
  private readonly loginTtlMs = 5 * 60 * 1000;

  constructor(private readonly profile: RouterProfile) {}

  private get baseUrl() {
    return this.profile.routerUrl.replace(/\/$/, "");
  }

  private headers(consumeToken: boolean): HeadersInit {
    const h: HeadersInit = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "*/*",
      "X-Requested-With": "XMLHttpRequest",
    };
    if (this.cookie) h.Cookie = this.cookie;
    if (this.tokens.length) {
      // POSTs consume one-time CSRF tokens; GETs reuse the current token.
      h.__RequestVerificationToken = consumeToken
        ? this.tokens.shift()!
        : this.tokens[0];
    }
    return h;
  }

  private mergeSession(response: Response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    if (setCookies.length) {
      this.cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    }
    const newTokens = getVerificationTokens(response.headers);
    if (newTokens.length) this.tokens = newTokens;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();
    const consumeToken = method === "POST" || method === "PUT" || method === "DELETE";
    const res = await fetch(`${this.baseUrl}/${path.replace(/^\//, "")}`, {
      ...init,
      headers: { ...this.headers(consumeToken), ...init?.headers },
      signal: AbortSignal.timeout(10000),
    });
    this.mergeSession(res);
    return res;
  }

  private async get(path: string): Promise<Record<string, string>> {
    const res = await this.request(path);
    const text = await res.text();
    if (xmlHasError(text)) {
      throw new Error(`Huawei API error on ${path}`);
    }
    return parseXmlResponse(text);
  }

  private async post(
    path: string,
    body: string,
    retries = 2
  ): Promise<Record<string, string>> {
    const res = await this.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body,
    });
    const text = await res.text();
    if (xmlHasError(text)) {
      const code = text.match(/<code>([^<]+)/)?.[1] ?? "unknown";
      // 100004 = system busy — brief wait then retry (token already rotated)
      if (code === "100004" && retries > 0) {
        await new Promise((r) => setTimeout(r, 750));
        return this.post(path, body, retries - 1);
      }
      throw new Error(`Huawei API error on ${path} (code ${code})`);
    }
    return parseXmlResponse(text);
  }

  async ensureLogin(): Promise<void> {
    if (this.loggedIn && Date.now() - this.lastLogin < this.loginTtlMs) return;

    const sesText = await this.request("api/webserver/SesTokInfo").then((r) => r.text());
    const sesInfo = sesText.match(/<SesInfo>([^<]+)/)?.[1];
    const tokInfo = sesText.match(/<TokInfo>([^<]+)/)?.[1];
    if (!sesInfo || !tokInfo) {
      throw new Error("Failed to initialize Huawei router session");
    }
    this.cookie = sesInfo;
    this.tokens = [tokInfo];

    const stateLogin = await this.get("api/user/state-login");
    const useScram =
      this.profile.routerUsername === "user"
        ? stateLogin.user_extern_password_type === "1"
        : stateLogin.extern_password_type === "1";

    if (useScram) {
      await this.scramLogin();
    } else {
      await this.plainLogin();
    }

    const loginState = await this.get("api/user/state-login");
    if (loginState.State !== "0") {
      throw new Error("Router login failed — check credentials in config");
    }

    this.loggedIn = true;
    this.lastLogin = Date.now();
  }

  private async plainLogin(): Promise<void> {
    const xml = object2xml("request", {
      Username: this.profile.routerUsername,
      Password: Buffer.from(this.profile.routerPassword).toString("base64"),
      password_type: "4",
    });
    await this.post("api/user/login", xml);
  }

  private async scramLogin(): Promise<void> {
    const firstNonce = huaweiScram.nonce().toString();
    const step1 = await this.post(
      "api/user/challenge_login",
      object2xml("request", {
        username: this.profile.routerUsername,
        firstnonce: firstNonce,
        mode: "1",
      })
    );

    const salt = CryptoJS.enc.Hex.parse(step1.salt ?? "");
    const iterations = parseInt(step1.iterations ?? "0", 10);
    const serverNonce = step1.servernonce ?? "";
    const authMessage = `${firstNonce},${serverNonce},${serverNonce}`;
    const clientProof = huaweiScram.clientProof(
      this.profile.routerPassword,
      salt,
      iterations,
      authMessage
    );

    const step2 = await this.post(
      "api/user/authentication_login",
      object2xml("request", {
        clientproof: clientProof,
        finalnonce: serverNonce,
      })
    );

    const expected = huaweiScram.serverProof(
      this.profile.routerPassword,
      salt,
      iterations,
      authMessage
    );
    if (step2.serversignature && step2.serversignature !== expected) {
      throw new Error("Router login failed — invalid server signature");
    }
  }

  async getLiveSpeed(): Promise<LiveSpeed> {
    await this.ensureLogin();
    const data = await this.get("api/monitoring/traffic-statistics");
    return {
      realtimeTxKbps: bytesPerSecondToKbps(data.CurrentUploadRate),
      realtimeRxKbps: bytesPerSecondToKbps(data.CurrentDownloadRate),
    };
  }

  async getTrafficStats(): Promise<TrafficStats> {
    await this.ensureLogin();
    const month = await this.get("api/monitoring/month_statistics");
    const tx = parseInt(month.CurrentMonthUpload ?? "0", 10) || 0;
    const rx = parseInt(month.CurrentMonthDownload ?? "0", 10) || 0;
    const total = tx + rx;
    return {
      monthlyTxBytes: tx,
      monthlyRxBytes: rx,
      totalBytes: total,
      dataLimitSwitch: false,
      dataLimitGB: 0,
      usagePercent: 0,
    };
  }

  async getDevices(): Promise<ConnectedDevice[]> {
    await this.ensureLogin();
    const text = await this.request("api/wlan/host-list").then((r) => r.text());
    if (xmlHasError(text)) return [];
    return parseHostList(text).map((host) => ({
      hostname: host.HostName || "Unknown",
      ip_addr: host.IpAddress ?? "—",
      mac_addr: (host.MacAddress ?? "").toLowerCase(),
      connect_time: parseInt(host.AssociatedTime ?? "0", 10) || 0,
      ssid_index: host.AssociatedSsid,
    }));
  }

  async getMacFilter(): Promise<MacFilterState> {
    await this.ensureLogin();
    const text = await this.request("api/wlan/multi-macfilter-settings").then(
      (r) => r.text()
    );
    if (xmlHasError(text)) {
      // Fallback for firmwares without multi-SSID MAC filter API
      const data = await this.get("api/wlan/mac-filter");
      const modeCode = data.WifiMacFilterStatus ?? "0";
      const macs = parseHuaweiMacFilterSlots(data);
      return {
        mode: macFilterModeFromCode(modeCode),
        modeCode,
        whiteList: modeCode === "1" ? macs : [],
        blackList: modeCode === "2" ? macs : [],
      };
    }

    const ssids = parseHuaweiSsidBlocks(text);
    const primary = ssids[0] ?? {};
    const modeCode = primary.WifiMacFilterStatus ?? "0";
    const macs = parseHuaweiMacFilterSlots(primary);
    return {
      mode: macFilterModeFromCode(modeCode),
      modeCode,
      whiteList: modeCode === "1" ? macs : [],
      blackList: modeCode === "2" ? macs : [],
    };
  }

  async setMacFilter(
    mode: MacFilterState["mode"],
    macs: string[]
  ): Promise<void> {
    await this.ensureLogin();

    if (macs.length > HUAWEI_MAC_FILTER_SLOTS) {
      throw new Error(
        `B310 supports at most ${HUAWEI_MAC_FILTER_SLOTS} MAC filter entries`
      );
    }

    const modeCode =
      mode === "whitelist" ? "1" : mode === "blacklist" ? "2" : "0";
    const normalized =
      mode === "disabled"
        ? []
        : [...new Set(macs.map((m) => m.trim().toUpperCase()).filter(Boolean))];

    if (mode !== "disabled" && normalized.length === 0) {
      throw new Error("Add at least one MAC address before enabling the filter");
    }

    const text = await this.request("api/wlan/multi-macfilter-settings").then(
      (r) => r.text()
    );

    if (xmlHasError(text)) {
      const slots = buildHuaweiMacFilterSlots(normalized);
      await this.post(
        "api/wlan/mac-filter",
        object2xml("request", {
          WifiMacFilterStatus: modeCode,
          ...slots,
        })
      );
      return;
    }

    const ssids = parseHuaweiSsidBlocks(text);
    if (ssids.length === 0) {
      throw new Error("No WLAN SSIDs found for MAC filter update");
    }

    const slots = buildHuaweiMacFilterSlots(normalized);
    const updated = ssids.map((ssid) => ({
      Index: ssid.Index ?? "0",
      WifiMacFilterStatus: modeCode,
      ...slots,
    }));

    await this.post(
      "api/wlan/multi-macfilter-settings",
      object2xml("request", {
        Ssids: {
          Ssid: updated,
        },
      })
    );
  }

  async getRouterInfo(): Promise<RouterInfo> {
    await this.ensureLogin();
    const [info, wlan, dhcpText, status] = await Promise.all([
      this.get("api/device/information"),
      this.get("api/wlan/basic-settings"),
      this.request("api/dhcp/settings").then((r) => r.text()),
      this.get("api/monitoring/status"),
    ]);

    const lanIp =
      dhcpText.match(/<DhcpIPAddress>([^<]+)/)?.[1] ?? "192.168.8.1";

    return {
      firmware: info.SoftwareVersion ?? info.WebUIVersion ?? "Unknown",
      hardware: info.HardwareVersion ?? info.DeviceName ?? "Unknown",
      imei: info.Imei ?? "—",
      ssid: wlan.WifiSsid ?? "—",
      maxClients: parseInt(wlan.WifiMaxAssoc ?? status.TotalWifiUser ?? "0", 10) || 0,
      wifiState: wlan.WifiEnable === "1",
      lanIp,
      wanIp: info.WanIPAddress ?? "—",
    };
  }

  async getSignal(): Promise<SignalInfo> {
    await this.ensureLogin();
    const [signal, status] = await Promise.all([
      this.get("api/device/signal"),
      this.get("api/monitoring/status"),
    ]);
    return {
      rsrp: signal.rsrp ?? "—",
      rsrq: signal.rsrq ?? "—",
      sinr: signal.sinr ?? "—",
      networkType: networkTypeLabel(status.CurrentNetworkType),
      band: signal.band || "—",
    };
  }

  async getDashboard(): Promise<DashboardData> {
    const [info, traffic, devices, macFilter, signal] = await Promise.all([
      this.getRouterInfo(),
      this.getTrafficStats(),
      this.getDevices(),
      this.getMacFilter(),
      this.getSignal(),
    ]);
    return { info, traffic, devices, macFilter, signal, connected: true };
  }

  async reboot(): Promise<void> {
    await this.ensureLogin();
    await this.post("api/device/control", object2xml("request", { Control: 1 }));
    this.loggedIn = false;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.ensureLogin();
    const xml = object2xml("request", {
      OldPassword: oldPassword,
      NewPassword: newPassword,
      password_type: "4",
    });
    await this.post("api/user/password", xml);
    this.loggedIn = false;
  }

  async getTrafficAlertRaw(): Promise<Record<string, string>> {
    await this.ensureLogin();
    const month = await this.get("api/monitoring/month_statistics");
    return {
      monthly_tx_bytes: month.CurrentMonthUpload ?? "0",
      monthly_rx_bytes: month.CurrentMonthDownload ?? "0",
      date_month: month.MonthLastClearTime ?? "",
      data_volume_limit_switch: "0",
      data_volume_limit_size: "0",
      data_volume_alert_percent: "80",
    };
  }
}
