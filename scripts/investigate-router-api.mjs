/**
 * Comprehensive Dialog 4G CPE router goform API investigation.
 * Run: node scripts/investigate-router-api.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const cookies = [];
const results = {
  login: null,
  goformIds: [],
  getCmds: [],
  setTests: [],
  stationList: null,
  polling: [],
  serviceJsSnippets: {},
};

async function req(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${base}/main.html`,
      ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
      ...init.headers,
    },
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
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, text, json, headers: Object.fromEntries(res.headers) };
}

async function login() {
  await req(`${base}/main.html`);
  const loginPayload = loginBody();
  const res = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginPayload,
  });
  cookies.push("pageForward=home");
  results.login = {
    endpoint: "POST /goform/goform_set_cmd_process",
    body: "isTest=false&goformId=LOGIN&username=<base64-user>&password=<base64-password>&CSRFToken=",
    response: res.json ?? res.text,
    cookies,
  };
  return res;
}

async function getCmd(cmd, multi = false) {
  const params = new URLSearchParams({ isTest: "false", cmd });
  if (multi) params.set("multi_data", "1");
  const res = await req(
    `${base}/goform/goform_get_cmd_process?${params}`
  );
  return res;
}

async function setCmd(body) {
  const res = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: typeof body === "string" ? body : new URLSearchParams(body).toString(),
  });
  return res;
}

function extractPatterns(svc) {
  const goformIds = [
    ...new Set([...svc.matchAll(/goformId\s*[:=]\s*["']([A-Z0-9_]+)["']/g)].map((m) => m[1])),
  ].sort();

  const cmdRefs = [
    ...new Set([...svc.matchAll(/cmd\s*[:=]\s*["']([a-z0-9_,]+)["']/g)].map((m) => m[1])),
  ].sort();

  const keywords = [
    "station_list",
    "rate_limit",
    "traffic",
    "bandwidth",
    "reboot",
    "restart",
    "CHANGE_PASSWORD",
    "PASSWORD",
    "SSID",
    "DHCP",
    "url_filter",
    "port_forward",
    "DMZ",
    "guest",
    "sms",
    "firmware",
    "realtime_tx_thrpt",
    "realtime_rx_thrpt",
    "monthly_tx_bytes",
    "monthly_rx_bytes",
    "lan_station",
    "device",
    "client",
    "usage",
    "bytes",
  ];

  const snippets = {};
  for (const kw of keywords) {
    const idx = svc.indexOf(kw);
    if (idx >= 0) {
      snippets[kw] = svc.slice(Math.max(0, idx - 80), idx + 200);
    }
  }

  return { goformIds, cmdRefs, snippets };
}

async function testGetCommands() {
  const cmds = [
    // Traffic / devices
    { cmd: "station_list", multi: false },
    { cmd: "lan_station_list", multi: false },
    { cmd: "wifi_station_list", multi: false },
    { cmd: "station_rate_limit", multi: false },
    { cmd: "rate_limit", multi: false },
    { cmd: "device_traffic_list", multi: false },
    { cmd: "client_traffic", multi: false },
    { cmd: "traffic_statistics", multi: false },
    { cmd: "station_traffic", multi: false },
    {
      cmd: "monthly_tx_bytes,monthly_rx_bytes,realtime_tx_thrpt,realtime_rx_thrpt,data_volume_limit_switch,data_volume_limit_size",
      multi: true,
    },
    { cmd: "realtime_tx_bytes,realtime_rx_bytes", multi: true },
    { cmd: "traffic_alter_switch,traffic_alter_size", multi: true },
    // Router info
    { cmd: "cr_version,tz_real_version,imei,SSID1,SSID2,MAX_Access_num,wifi_cur_state,lan_ipaddr,wan_ipaddr", multi: true },
    { cmd: "network_type,rsrp,rsrq,sinr,band", multi: true },
    { cmd: "loginfo", multi: true },
    // WiFi
    { cmd: "wifi_encryption,wifi_password,wifi_auth_mode,wifi_wpa_psk_key", multi: true },
    { cmd: "m_ssid_enable,SSID2,wifi_guest_enable", multi: true },
    // DHCP
    { cmd: "dhcp_enabled,dhcp_start,dhcp_end,dhcp_lease_time,lan_ipaddr,lan_netmask", multi: true },
    { cmd: "DHCP_LeaseTime,DhcpStartAddr,DhcpEndAddr", multi: true },
    // Security / filters
    { cmd: "ACL_mode,wifi_mac_white_list,wifi_mac_black_list", multi: true },
    { cmd: "url_filter_enable,url_filter_mode,url_filter_list", multi: true },
    { cmd: "url_filter", multi: false },
    { cmd: "firewall_enabled,port_forward_list,port_forward", multi: true },
    { cmd: "dmz_enabled,dmz_ip", multi: true },
    { cmd: "DMZ", multi: false },
    // SMS
    { cmd: "sms_unread_num,sms_total_num", multi: true },
    { cmd: "sms_data_total", multi: false },
    { cmd: "message_list", multi: false },
    // Firmware
    { cmd: "update_package_info,update_state,update_progress", multi: true },
    { cmd: "firmware_version,cr_version,tz_real_version", multi: true },
    { cmd: "new_version_state", multi: true },
    // Password
    { cmd: "password_type,admin_password", multi: true },
  ];

  for (const { cmd, multi } of cmds) {
    const res = await getCmd(cmd, multi);
    const data = res.json ?? {};
    const hasData = Object.values(data).some(
      (v) => v !== "" && v !== null && v !== undefined && v !== "null"
    );
    results.getCmds.push({
      cmd,
      multi,
      endpoint: `GET /goform/goform_get_cmd_process?isTest=false&cmd=${cmd}${multi ? "&multi_data=1" : ""}`,
      hasData,
      response: data,
    });
  }
}

async function testSetReadOnly() {
  // Only test read-only / isTest=true probes — never actually reboot or change password
  const tests = [
    {
      name: "REBOOT (isTest=true dry run)",
      body: "isTest=true&goformId=REBOOT_DEVICE",
    },
    {
      name: "RESTART (isTest=true)",
      body: "isTest=true&goformId=RESTART",
    },
    {
      name: "CHANGE_PASSWORD (isTest=true)",
      body: "isTest=true&goformId=CHANGE_PASSWORD&old_password=dGVzdA==&new_password=dGVzdDI=&confirm_password=dGVzdDI=",
    },
    {
      name: "SET_WIFI_SSID (isTest=true)",
      body: "isTest=true&goformId=SET_WIFI_SSID&SSID1=TestSSID",
    },
    {
      name: "WIFI_BASIC (isTest=true)",
      body: "isTest=true&goformId=WIFI_BASIC&SSID1=TestSSID",
    },
    {
      name: "DHCP_SETTING (isTest=true)",
      body: "isTest=true&goformId=DHCP_SETTING&dhcp_enabled=1",
    },
    {
      name: "URL_FILTER (isTest=true)",
      body: "isTest=true&goformId=URL_FILTER&url_filter_enable=1",
    },
    {
      name: "PORT_FORWARDING (isTest=true)",
      body: "isTest=true&goformId=PORT_FORWARDING",
    },
    {
      name: "DMZ_SETTING (isTest=true)",
      body: "isTest=true&goformId=DMZ_SETTING&dmz_enabled=0",
    },
    {
      name: "GUEST_WIFI (isTest=true)",
      body: "isTest=true&goformId=GUEST_WIFI&m_ssid_enable=1",
    },
    {
      name: "RATE_LIMIT (isTest=true)",
      body: "isTest=true&goformId=RATE_LIMIT",
    },
    {
      name: "STATION_RATE_LIMIT (isTest=true)",
      body: "isTest=true&goformId=STATION_RATE_LIMIT",
    },
    {
      name: "FIRMWARE_UPDATE (isTest=true)",
      body: "isTest=true&goformId=FIRMWARE_UPDATE",
    },
    {
      name: "CHECK_NEW_VERSION (isTest=true)",
      body: "isTest=true&goformId=CHECK_NEW_VERSION",
    },
    {
      name: "DELETE_SMS (isTest=true)",
      body: "isTest=true&goformId=DELETE_SMS&msg_id=0",
    },
    {
      name: "SEND_SMS (isTest=true)",
      body: "isTest=true&goformId=SEND_SMS&Number=123&Message=test",
    },
    {
      name: "LOGOUT",
      body: "isTest=false&goformId=LOGOUT",
    },
  ];

  for (const t of tests) {
    const res = await setCmd(t.body);
    results.setTests.push({
      name: t.name,
      endpoint: "POST /goform/goform_set_cmd_process",
      body: t.body,
      response: res.json ?? res.text,
    });
    // Re-login after logout test
    if (t.name === "LOGOUT") await login();
  }
}

async function testPolling() {
  const intervals = [100, 250, 500, 1000, 2000];
  for (const ms of intervals) {
    const times = [];
    let errors = 0;
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      const t0 = Date.now();
      try {
        const res = await getCmd("realtime_tx_thrpt,realtime_rx_thrpt", true);
        if (!res.json?.realtime_tx_thrpt && res.json?.realtime_tx_thrpt !== "0")
          errors++;
        times.push(Date.now() - t0);
      } catch {
        errors++;
      }
      if (i < 9) await new Promise((r) => setTimeout(r, ms));
    }
    results.polling.push({
      intervalMs: ms,
      requests: 10,
      errors,
      avgLatencyMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      maxLatencyMs: Math.max(...times),
      totalDurationMs: Date.now() - start,
    });
  }
}

async function main() {
  console.log("=== Router API Investigation ===\n");

  const loginRes = await login();
  console.log("Login:", JSON.stringify(loginRes.json ?? loginRes.text));

  const svcRes = await req(`${base}/js/service.js`);
  const svc = svcRes.text;
  const { goformIds, cmdRefs, snippets } = extractPatterns(svc);
  results.goformIds = goformIds;
  results.serviceJsSnippets = snippets;
  results.serviceJsCmdRefs = cmdRefs;
  console.log(`Found ${goformIds.length} goformIds, ${cmdRefs.length} cmd refs`);

  // Deep search service.js for device traffic related functions
  const trafficMatches = [];
  const trafficRegex =
    /(?:station|device|client|traffic|bandwidth|rate_limit|bytes)[^]{0,120}/gi;
  let m;
  const seen = new Set();
  while ((m = trafficRegex.exec(svc)) !== null) {
    const snippet = m[0].replace(/\s+/g, " ").slice(0, 150);
    if (!seen.has(snippet)) {
      seen.add(snippet);
      trafficMatches.push(snippet);
    }
    if (trafficMatches.length >= 40) break;
  }
  results.trafficSnippets = trafficMatches;

  // Search for reboot/password goform blocks
  for (const id of ["REBOOT", "RESTART", "CHANGE_PASSWORD", "PASSWORD", "SSID", "DHCP", "URL_FILTER", "PORT_FORWARD", "DMZ", "GUEST", "SMS", "FIRMWARE", "RATE_LIMIT"]) {
    const idx = svc.indexOf(id);
    if (idx >= 0) {
      results.serviceJsSnippets[`block_${id}`] = svc.slice(
        Math.max(0, idx - 100),
        idx + 400
      );
    }
  }

  console.log("\nTesting GET commands...");
  await testGetCommands();

  const station = results.getCmds.find((c) => c.cmd === "station_list");
  results.stationList = station;

  console.log("\nTesting SET commands (dry-run / logout only)...");
  await testSetReadOnly();

  console.log("\nTesting polling intervals...");
  await testPolling();

  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "scripts",
    "investigate-router-api-output.json"
  );
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nResults written to ${outPath}`);

  // Summary to stdout
  console.log("\n=== SUMMARY ===");
  console.log("Login OK:", results.login?.response?.result);
  console.log(
    "GET cmds with data:",
    results.getCmds.filter((c) => c.hasData).map((c) => c.cmd.split(",")[0])
  );
  console.log(
    "SET tests:",
    results.setTests.map((t) => `${t.name}: ${JSON.stringify(t.response)}`)
  );
  console.log("Polling:", results.polling);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
