import type {
  ConnectedDevice,
  DashboardData,
  MacFilterState,
  QuotaSettings,
  RouterInfo,
  SignalInfo,
  TrafficStats,
  LiveSpeed,
} from "./router-types";
import {
  macFilterModeFromCode,
  parseDataLimit,
  parseMacList,
} from "./format";
import { applyConfigToEnv } from "./app-config";

const GET_URL = "/goform/goform_get_cmd_process";
const SET_URL = "/goform/goform_set_cmd_process";

function getConfig() {
  applyConfigToEnv();
  const baseUrl = process.env.ROUTER_URL ?? "http://192.168.8.1";
  const username = process.env.ROUTER_USERNAME ?? "user";
  const password = process.env.ROUTER_PASSWORD ?? "";
  return { baseUrl, username, password };
}

class RouterClient {
  private cookies: string[] = [];
  private loggedIn = false;
  private lastLogin = 0;
  private readonly loginTtlMs = 5 * 60 * 1000;

  private parseThrpt(raw: string | undefined): number {
    const n = parseFloat(raw ?? "0");
    return Number.isFinite(n) ? n : 0;
  }

  private get baseUrl() {
    return getConfig().baseUrl;
  }

  private mergeCookies(response: Response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    if (setCookies.length === 0) {
      const raw = response.headers.get("set-cookie");
      if (raw) setCookies.push(raw);
    }
    for (const c of setCookies) {
      const name = c.split("=")[0];
      this.cookies = this.cookies.filter((x) => !x.startsWith(`${name}=`));
      this.cookies.push(c.split(";")[0]);
    }
  }

  private headers(): HeadersInit {
    const h: HeadersInit = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${this.baseUrl}/main.html`,
    };
    if (this.cookies.length) {
      h["Cookie"] = this.cookies.join("; ");
    }
    return h;
  }

  async ensureLogin(): Promise<void> {
    if (this.loggedIn && Date.now() - this.lastLogin < this.loginTtlMs) {
      return;
    }
    const { username, password } = getConfig();
    await this.fetch(`${this.baseUrl}/main.html`);
    const encodedUser = Buffer.from(username).toString("base64");
    const encodedPass = Buffer.from(password).toString("base64");
    const body = new URLSearchParams({
      isTest: "false",
      goformId: "LOGIN",
      username: encodedUser,
      password: encodedPass,
      CSRFToken: "",
    });
    const res = await this.fetch(`${this.baseUrl}${SET_URL}`, {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = await res.json();
    // Result "0" or "4" = success on TZTEK/Huawei-style firmware
    if (data.result !== "0" && data.result !== 0 && data.result !== "4" && data.result !== 4) {
      throw new Error("Router login failed — check credentials in .env.local");
    }
    this.cookies = this.cookies.filter((x) => !x.startsWith("pageForward="));
    this.cookies.push("pageForward=home");
    this.loggedIn = true;
    this.lastLogin = Date.now();
  }

  private async fetch(url: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      headers: { ...this.headers(), ...init?.headers },
      signal: AbortSignal.timeout(10000),
    });
    this.mergeCookies(res);
    return res;
  }

  private async getCmd(cmd: string, multi = false): Promise<Record<string, string>> {
    await this.ensureLogin();
    const params = new URLSearchParams({ isTest: "false", cmd });
    if (multi) params.set("multi_data", "1");
    const res = await this.fetch(`${this.baseUrl}${GET_URL}?${params}`);
    return res.json();
  }

  private async getSingleCmd(cmd: string): Promise<Record<string, string>> {
    return this.getCmd(cmd, false);
  }

  async getLiveSpeed(): Promise<LiveSpeed> {
    const data = await this.getCmd("realtime_tx_thrpt,realtime_rx_thrpt", true);
    return {
      realtimeTxKbps: this.parseThrpt(data.realtime_tx_thrpt),
      realtimeRxKbps: this.parseThrpt(data.realtime_rx_thrpt),
      fetchedAt: Date.now(),
    };
  }

  async getTrafficStats(): Promise<TrafficStats> {
    const data = await this.getCmd(
      "monthly_tx_bytes,monthly_rx_bytes,data_volume_limit_switch,data_volume_limit_size,realtime_tx_thrpt,realtime_rx_thrpt",
      true
    );
    const tx = parseInt(data.monthly_tx_bytes ?? "0", 10) || 0;
    const rx = parseInt(data.monthly_rx_bytes ?? "0", 10) || 0;
    const total = tx + rx;
    const limitGB = parseDataLimit(data.data_volume_limit_size ?? "0_1024");
    const limitBytes = limitGB * 1024 * 1024 * 1024;
    const usagePercent = limitBytes > 0 ? Math.min(100, (total / limitBytes) * 100) : 0;

    return {
      monthlyTxBytes: tx,
      monthlyRxBytes: rx,
      totalBytes: total,
      dataLimitSwitch: data.data_volume_limit_switch === "1",
      dataLimitGB: limitGB,
      usagePercent,
      realtimeTxKbps: this.parseThrpt(data.realtime_tx_thrpt),
      realtimeRxKbps: this.parseThrpt(data.realtime_rx_thrpt),
    };
  }

  async getDevices(): Promise<ConnectedDevice[]> {
    const data = await this.getSingleCmd("station_list");
    let list = data.station_list;
    if (!list) {
      const lan = await this.getSingleCmd("lan_station_list");
      list = lan.lan_station_list;
    }
    if (!list) return [];
    const parsed = typeof list === "string" ? JSON.parse(list) : list;
    return Array.isArray(parsed) ? parsed : [];
  }

  async getMacFilter(): Promise<MacFilterState> {
    const data = await this.getCmd(
      "ACL_mode,wifi_mac_white_list,wifi_mac_black_list",
      true
    );
    return {
      mode: macFilterModeFromCode(data.ACL_mode ?? "0"),
      modeCode: data.ACL_mode ?? "0",
      whiteList: parseMacList(data.wifi_mac_white_list),
      blackList: parseMacList(data.wifi_mac_black_list),
    };
  }

  async setMacFilter(mode: MacFilterState["mode"], macs: string[]): Promise<void> {
    await this.ensureLogin();
    const modeCode = mode === "whitelist" ? "1" : mode === "blacklist" ? "2" : "0";
    const params: Record<string, string> = {
      isTest: "false",
      goformId: "WIFI_MAC_FILTER",
      ACL_mode: modeCode,
    };
    if (mode === "blacklist") {
      params.wifi_mac_black_list = macs.join(";");
    } else if (mode === "whitelist") {
      params.wifi_mac_white_list = macs.join(";");
    }
    const body = new URLSearchParams(params);

    const res = await this.fetch(`${this.baseUrl}${SET_URL}`, {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = await res.json();
    if (data.result !== "success" && data.result !== "0" && data.result !== 0) {
      // Some firmware returns "1" on success
      if (data.result !== "1" && data.result !== 1) {
        throw new Error(`MAC filter update failed: ${JSON.stringify(data)}`);
      }
    }
  }

  async getRouterInfo(): Promise<RouterInfo> {
    const data = await this.getCmd(
      "cr_version,tz_real_version,imei,SSID1,MAX_Access_num,wifi_cur_state,lan_ipaddr,wan_ipaddr",
      true
    );
    return {
      firmware: data.tz_real_version ?? data.cr_version ?? "Unknown",
      hardware: data.cr_version ?? "Unknown",
      imei: data.imei ?? "—",
      ssid: data.SSID1 ?? "—",
      maxClients: parseInt(data.MAX_Access_num ?? "0", 10) || 0,
      wifiState: data.wifi_cur_state === "1",
      lanIp: data.lan_ipaddr ?? "192.168.8.1",
      wanIp: data.wan_ipaddr ?? "—",
    };
  }

  async getSignal(): Promise<SignalInfo> {
    const data = await this.getCmd("network_type,rsrp,rsrq,sinr,band", true);
    // Signal fields may need separate public query when empty after login
    const empty = !data.rsrp && !data.sinr;
    if (empty) {
      const pub = await this.fetch(
        `${this.baseUrl}${GET_URL}?${new URLSearchParams({ isTest: "false", cmd: "rsrp,rsrq,sinr,band", multi_data: "1" })}`
      ).then((r) => r.json());
      Object.assign(data, pub);
    }
    return {
      rsrp: data.rsrp ?? "—",
      rsrq: data.rsrq ?? "—",
      sinr: data.sinr ?? "—",
      networkType: data.network_type ?? "—",
      band: data.band ?? "—",
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
    const body = new URLSearchParams({
      isTest: "false",
      goformId: "REBOOT_DEVICE",
    });
    await this.fetch(`${this.baseUrl}${SET_URL}`, {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    this.loggedIn = false;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.ensureLogin();
    const body = new URLSearchParams({
      isTest: "false",
      goformId: "CHANGE_PASSWORD",
      oldPassword: Buffer.from(oldPassword).toString("base64"),
      newPassword: Buffer.from(newPassword).toString("base64"),
    });
    const res = await this.fetch(`${this.baseUrl}${SET_URL}`, {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = await res.json();
    if (data.result !== "success") {
      throw new Error("Password change failed — check current password");
    }
  }

  async getQuotaSettings(): Promise<QuotaSettings> {
    const data = await this.getCmd(
      "data_volume_limit_switch,data_volume_limit_unit,data_volume_limit_size,data_volume_alert_percent",
      true
    );
    const limitGB = parseDataLimit(data.data_volume_limit_size ?? "80_1024");
    return {
      enabled: data.data_volume_limit_switch === "1",
      limitGB,
      alertPercent: parseInt(data.data_volume_alert_percent ?? "80", 10) || 80,
      routerLimitSize: data.data_volume_limit_size,
    };
  }

  async setQuotaSettings(settings: QuotaSettings): Promise<void> {
    await this.ensureLogin();
    const body = new URLSearchParams({
      isTest: "false",
      goformId: "DATA_LIMIT_SETTING",
      data_volume_limit_switch: settings.enabled ? "1" : "0",
      data_volume_limit_unit: "data",
      data_volume_limit_size: `${settings.limitGB}_1024`,
      data_volume_alert_percent: String(settings.alertPercent),
      CSRFToken: "",
    });
    const res = await this.fetch(`${this.baseUrl}${SET_URL}`, {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = await res.json();
    if (data.result !== "success" && data.result !== "0" && data.result !== 0) {
      throw new Error(`Quota update failed: ${JSON.stringify(data)}`);
    }
  }

  async getTrafficAlertRaw(): Promise<Record<string, string>> {
    return this.getCmd(
      "data_volume_limit_switch,data_volume_limit_unit,data_volume_limit_size,data_volume_alert_percent,monthly_tx_bytes,monthly_rx_bytes,date_month",
      true
    );
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __routerClient: RouterClient | undefined;
}

export function getRouterClient(): RouterClient {
  if (!global.__routerClient) {
    global.__routerClient = new RouterClient();
  }
  return global.__routerClient;
}

export function resetRouterClient(): void {
  global.__routerClient = new RouterClient();
}
