import { writeFileSync } from "fs";
import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const cookies = [];

async function req(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${base}/main.html`,
      ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) cookies.push(c.split(";")[0]);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function login() {
  await req(`${base}/main.html`);
  const r = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody(),
  });
  cookies.push("pageForward=home");
  return r;
}

async function get(cmd, multi = false) {
  const p = new URLSearchParams({ isTest: "false", cmd });
  if (multi) p.set("multi_data", "1");
  return req(`${base}/goform/goform_get_cmd_process?${p}`);
}

async function set(body) {
  return req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

const out = {};
await login();
out.login = "ok";

// Per-device flow attempt
out.tz_get_flow = await set("isTest=false&goformId=tz_get_flow");
await new Promise((r) => setTimeout(r, 2000));

// Re-login if session lost
try {
  out.station_after_flow = await get("station_list");
} catch {
  await login();
  out.station_after_flow = await get("station_list");
}

// Correct-field dry runs (isTest=true)
const dryRuns = {
  changePassword: "isTest=true&goformId=CHANGE_PASSWORD&oldPassword=dGVzdA==&newPassword=dGVzdDI=",
  wifiSsid1: "isTest=true&goformId=SET_WIFI_SSID1_SETTINGS&ssid=TestSSID&broadcastSsidEnabled=1&MAX_Access_num=32&security_mode=WPA2PSK&cipher=CCMP&NoForwarding=0&show_qrcode_flag=0",
  wifiSsid2: "isTest=true&goformId=SET_WIFI_SSID2_SETTINGS&m_SSID=GuestTest&m_HideSSID=0&m_MAX_Access_num=32&m_AuthMode=WPA2PSK&cipher=CCMP&m_NoForwarding=0&m_show_qrcode_flag=0",
  dhcp: "isTest=true&goformId=DHCP_SETTING&lanIp=192.168.8.1&lanNetmask=255.255.255.0&lanDhcpType=SERVER&dhcpStart=192.168.8.100&dhcpEnd=192.168.8.200&dhcpDns=192.168.8.1&dhcpLease=86400&dhcp_reboot_flag=0&CSRFToken=",
  dmz: "isTest=true&goformId=DMZ_SETTING&DMZEnabled=0&CSRFToken=",
  sendSms: "isTest=true&goformId=SEND_SMS&Number=0771234567&Message=test",
  ifUpgradeCheck: "isTest=true&goformId=IF_UPGRADE&select_op=check&ota_manual_check_roam_state=1",
};

out.dryRuns = {};
for (const [k, body] of Object.entries(dryRuns)) {
  out.dryRuns[k] = await set(body);
  await new Promise((r) => setTimeout(r, 500));
}

// Public access without login
cookies.length = 0;
out.publicTraffic = await get("monthly_tx_bytes,monthly_rx_bytes,realtime_tx_thrpt,realtime_rx_thrpt", true);
out.publicStation = await get("station_list");

writeFileSync("scripts/investigate-final-output.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
