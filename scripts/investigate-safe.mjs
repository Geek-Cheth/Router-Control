import { loginBody } from "./lib/credentials.mjs";

/**
 * Safe router investigation with longer timeouts
 */
import { writeFileSync } from "fs";

const base = "http://192.168.8.1";
const cookies = [];
const TIMEOUT = 20000;

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
    signal: AbortSignal.timeout(TIMEOUT),
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
  console.log("Fetching main.html...");
  await req(`${base}/main.html`);
  console.log("Logging in...");
  const res = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody(),
  });
  cookies.push("pageForward=home");
  console.log("Login result:", res.json ?? res.text);
  return res;
}

async function getCmd(cmd, multi = false) {
  const params = new URLSearchParams({ isTest: "false", cmd });
  if (multi) params.set("multi_data", "1");
  return req(`${base}/goform/goform_get_cmd_process?${params}`);
}

async function setCmd(body, label) {
  console.log(`SET ${label}...`);
  const res = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  console.log(`  -> ${JSON.stringify(res.json ?? res.text)}`);
  return res;
}

async function main() {
  const out = { testedAt: new Date().toISOString() };

  out.login = (await login()).json;

  // Key GET commands
  const getTests = [
    ["station_list", false],
    ["lan_station_list", false],
    ["monthly_tx_bytes,monthly_rx_bytes,realtime_tx_thrpt,realtime_rx_thrpt,data_volume_limit_switch,data_volume_limit_size", true],
    ["ssid_and_pwd", false],
    ["cr_version,tz_real_version,imei,SSID1,MAX_Access_num,wifi_cur_state,lan_ipaddr,wan_ipaddr", true],
    ["network_type,rsrp,rsrq,sinr,band", true],
    ["loginfo,tz_account_power,tz_build_time", true],
    ["ACL_mode,wifi_mac_white_list,wifi_mac_black_list", true],
    ["sms_data_total", false],
    ["sms_capacity_info", false],
    ["fota_current_upgrade_state", false],
    ["fota_new_version_state", false],
    ["tz_upgrade_state", false],
    ["update_info", false],
    ["upgrade_result", false],
    ["opms_wan_auto_mode,ethwan_mode,pppoe_username,pppoe_password,ethwan_dialmode,ppp_status,static_wan_ipaddr,static_wan_netmask,static_wan_gateway,static_wan_primary_dns,static_wan_secondary_dns,rj45_state,lan_ipaddr,lan_netmask", true],
    ["data_volume_limit_switch,data_volume_limit_unit,data_volume_limit_size,data_volume_alert_percent,monthly_tx_bytes,monthly_rx_bytes,monthly_time,traffic_alined_delta", true],
  ];

  out.getResults = [];
  for (const [cmd, multi] of getTests) {
    const res = await getCmd(cmd, multi);
    const data = res.json ?? {};
    const hasData = Object.entries(data).some(([, v]) => v !== "" && v != null && v !== "null");
    out.getResults.push({ cmd, multi, hasData, response: data });
    console.log(`${hasData ? "[OK]" : "[--]"} ${cmd.split(",")[0]}`);
  }

  // Safe SET dry-runs only (isTest=true) — skip REBOOT entirely
  const setTests = [
    ["CHANGE_PASSWORD dry-run", "isTest=true&goformId=CHANGE_PASSWORD&old_password=dGVzdA==&new_password=dGVzdDI=&confirm_password=dGVzdDI="],
    ["DHCP_SETTING dry-run", "isTest=true&goformId=DHCP_SETTING&dhcp_enabled=1"],
    ["DMZ_SETTING dry-run", "isTest=true&goformId=DMZ_SETTING&dmz_enabled=0"],
    ["ADD_RATE_LIMIT dry-run", "isTest=true&goformId=ADD_RATE_LIMIT&ip_address=192.168.8.100&download_speed=1000&upload_speed=1000"],
    ["SET_WIFI_SSID1 dry-run", "isTest=true&goformId=SET_WIFI_SSID1_SETTINGS&SSID1=TestSSID"],
    ["ADD_PORT_MAP dry-run", "isTest=true&goformId=ADD_PORT_MAP&portMapEnabled=1&fromPort=8080&ip_address=192.168.8.100&toPort=80&protocol=TCP"],
    ["ADD_IP_PORT_FILTER dry-run", "isTest=true&goformId=ADD_IP_PORT_FILETER&action=1&protocol=TCP"],
    ["SEND_SMS dry-run", "isTest=true&goformId=SEND_SMS&Number=123&Message=test"],
    ["TZ_START_SYSTEM_UPGRADE dry-run", "isTest=true&goformId=TZ_START_SYSTEM_UPGRADE"],
    ["IF_UPGRADE dry-run", "isTest=true&goformId=IF_UPGRADE"],
  ];

  out.setResults = [];
  for (const [label, body] of setTests) {
    const res = await setCmd(body, label);
    out.setResults.push({ label, body, response: res.json ?? res.text });
    await new Promise((r) => setTimeout(r, 500));
  }

  // Polling
  out.polling = [];
  for (const ms of [250, 500, 1000, 2000, 3000]) {
    const times = [];
    let errors = 0;
    const start = Date.now();
    for (let i = 0; i < 8; i++) {
      const t0 = Date.now();
      try {
        const r = await getCmd("realtime_tx_thrpt,realtime_rx_thrpt", true);
        if (r.status !== 200) errors++;
        times.push(Date.now() - t0);
      } catch { errors++; }
      if (i < 7) await new Promise((r) => setTimeout(r, ms));
    }
    out.polling.push({
      intervalMs: ms,
      requests: 8,
      errors,
      avgLatencyMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
      maxLatencyMs: times.length ? Math.max(...times) : null,
      totalDurationMs: Date.now() - start,
    });
    console.log(`Poll ${ms}ms: avg=${out.polling.at(-1).avgLatencyMs}ms errors=${errors}`);
  }

  writeFileSync("scripts/investigate-safe-output.json", JSON.stringify(out, null, 2));
  console.log("\nDone. Output: scripts/investigate-safe-output.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
