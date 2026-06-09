/**
 * GET-only router API probe (safe — no destructive SET calls)
 */
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
    signal: AbortSignal.timeout(8000),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  const raw = res.headers.get("set-cookie");
  if (raw && set.length === 0) set.push(raw);
  for (const c of set) {
    const name = c.split("=")[0];
    const idx = cookies.findIndex((x) => x.startsWith(`${name}=`));
    if (idx >= 0) cookies[idx] = c.split(";")[0];
    else cookies.push(c.split(";")[0]);
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

async function login() {
  await req(`${base}/main.html`);
  const res = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody(),
  });
  cookies.push("pageForward=home");
  return res;
}

async function getCmd(cmd, multi = false) {
  const params = new URLSearchParams({ isTest: "false", cmd });
  if (multi) params.set("multi_data", "1");
  return req(`${base}/goform/goform_get_cmd_process?${params}`);
}

async function main() {
  const loginRes = await login();
  console.log("LOGIN:", loginRes.json ?? loginRes.text);

  const cmds = [
    ["station_list", false],
    ["lan_station_list", false],
    ["wifi_station_list", false],
    ["station_rate_limit", false],
    ["rate_limit", false],
    ["device_traffic_list", false],
    ["client_traffic", false],
    ["traffic_statistics", false],
    ["station_traffic", false],
    ["monthly_tx_bytes,monthly_rx_bytes,realtime_tx_thrpt,realtime_rx_thrpt,data_volume_limit_switch,data_volume_limit_size", true],
    ["realtime_tx_bytes,realtime_rx_bytes", true],
    ["traffic_alter_switch,traffic_alter_size", true],
    ["cr_version,tz_real_version,imei,SSID1,SSID2,MAX_Access_num,wifi_cur_state,lan_ipaddr,wan_ipaddr", true],
    ["network_type,rsrp,rsrq,sinr,band", true],
    ["loginfo", true],
    ["wifi_encryption,wifi_auth_mode", true],
    ["m_ssid_enable,SSID2,wifi_guest_enable", true],
    ["dhcp_enabled,dhcp_start,dhcp_end,dhcp_lease_time,lan_ipaddr,lan_netmask", true],
    ["DhcpStartAddr,DhcpEndAddr,DHCP_LeaseTime", true],
    ["ACL_mode,wifi_mac_white_list,wifi_mac_black_list", true],
    ["url_filter_enable,url_filter_mode,url_filter_list", true],
    ["url_filter", false],
    ["firewall_enabled,port_forward_list", true],
    ["port_forward", false],
    ["dmz_enabled,dmz_ip", true],
    ["DMZ", false],
    ["sms_unread_num,sms_total_num", true],
    ["sms_data_total", false],
    ["message_list", false],
    ["update_package_info,update_state,update_progress", true],
    ["new_version_state", true],
    ["password_type", true],
    ["wifi_black_list", false],
    ["wifi_white_list", false],
    ["station_mac", false],
    ["connected_wifi_name", false],
    ["wifi_connected_num", true],
  ];

  const results = [];
  for (const [cmd, multi] of cmds) {
    const res = await getCmd(cmd, multi);
    const data = res.json ?? {};
    const hasData = Object.entries(data).some(
      ([, v]) => v !== "" && v !== null && v !== undefined && v !== "null"
    );
    results.push({ cmd, multi, hasData, response: data });
    if (hasData) console.log(`[DATA] ${cmd}:`, JSON.stringify(data).slice(0, 300));
    else console.log(`[empty] ${cmd}`);
  }

  // Polling test
  const polling = [];
  for (const ms of [250, 500, 1000, 2000]) {
    const times = [];
    let errors = 0;
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      const t0 = Date.now();
      try {
        const r = await getCmd("realtime_tx_thrpt,realtime_rx_thrpt", true);
        if (r.status !== 200) errors++;
        times.push(Date.now() - t0);
      } catch { errors++; }
      if (i < 9) await new Promise((r) => setTimeout(r, ms));
    }
    polling.push({ intervalMs: ms, errors, avgMs: Math.round(times.reduce((a,b)=>a+b,0)/times.length), maxMs: Math.max(...times), totalMs: Date.now()-start });
  }
  console.log("\nPOLLING:", polling);

  writeFileSync("scripts/investigate-get-output.json", JSON.stringify({ login: loginRes.json, results, polling }, null, 2));
}

main().catch(console.error);
