/**
 * Comprehensive per-device usage probe for Dialog 4G CPE
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
    signal: AbortSignal.timeout(15000),
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
  return { status: res.status, text, json };
}

async function getCmd(cmd, multi = false) {
  const params = new URLSearchParams({ isTest: "false", cmd });
  if (multi) params.set("multi_data", "1");
  return req(`${base}/goform/goform_get_cmd_process?${params}`);
}

async function main() {
  await req(`${base}/main.html`);
  const login = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody(),
  });
  cookies.push("pageForward=home");

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
    [
      "RateLimitEnable,RateLimitRules_0,RateLimitRules_1,RateLimitRules_2,RateLimitRules_3",
      true,
    ],
    ["tz_traffic_share_switch", true],
    [
      "monthly_tx_bytes,monthly_rx_bytes,realtime_tx_bytes,realtime_rx_bytes,realtime_tx_thrpt,realtime_rx_thrpt,traffic_alined_delta,monthly_time",
      true,
    ],
    ["flow_list", false],
    ["tz_flow_list", false],
    ["station_flow", false],
    ["mac_flow", false],
    ["device_flow", false],
    ["traffic_share", false],
    ["data_volume_limit_switch,data_volume_limit_size,data_volume_limit_unit", true],
  ];

  const results = { login: login.json, getCmds: [], stationList: null, tzGetFlow: null };

  for (const [cmd, multi] of cmds) {
    const r = await getCmd(cmd, multi);
    const data = r.json ?? {};
    const hasData = Object.values(data).some(
      (v) => v !== "" && v !== null && v !== undefined && v !== "null"
    );
    results.getCmds.push({ cmd, multi, hasData, response: data });
  }

  const flow = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "isTest=false&goformId=tz_get_flow",
  });
  results.tzGetFlow = flow.json ?? flow.text;

  const st = results.getCmds.find((c) => c.cmd === "station_list");
  if (st?.response?.station_list) {
    let list = st.response.station_list;
    if (typeof list === "string") {
      try {
        list = JSON.parse(list);
      } catch {
        /* keep string */
      }
    }
    results.stationList = {
      count: Array.isArray(list) ? list.length : 0,
      fields: Array.isArray(list) && list[0] ? Object.keys(list[0]) : [],
      sample: Array.isArray(list) && list[0] ? list[0] : null,
      full: list,
    };
  }

  writeFileSync(
    "scripts/probe-per-device-output.json",
    JSON.stringify(results, null, 2)
  );
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
