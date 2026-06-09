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
    signal: AbortSignal.timeout(20000),
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
  return { json: json ?? text };
}

async function login() {
  await req(`${base}/main.html`);
  await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody(),
  });
  cookies.push("pageForward=home");
}

async function getCmd(cmd, multi = true) {
  const params = new URLSearchParams({ isTest: "false", cmd });
  if (multi) params.set("multi_data", "1");
  return req(`${base}/goform/goform_get_cmd_process?${params}`);
}

async function setCmd(body) {
  return req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

const cmds = [
  "RateLimitEnable,RateLimitRules_0,RateLimitRules_1,RateLimitRules_2",
  "PortMapEnable,PortMapRules_0,PortMapRules_1,PortMapRules_2",
  "IPPortFilterEnable,DefaultFirewallPolicy,IPPortFilterRules_0",
  "DMZEnable,DMZIPAddress",
  "lan_ipaddr,lan_netmask,mac_address,dhcpEnabled,dhcpStart,dhcpEnd,dhcpLease_hour,dhcpDns",
  "childGroupList",
  "hostNameList",
  "wifi_coverage,m_ssid_enable,SSID1,SSID2,m_SSID,m_AuthMode,m_HideSSID,MAX_Access_num",
  "PortForwardEnable",
  "upnp_setting_option",
  "main_nat,main_nat_1,main_nat_2",
  "realtime_tx_bytes,realtime_rx_bytes,realtime_time",
];

async function main() {
  const out = {};
  await login();

  for (const cmd of cmds) {
    const multi = !["childGroupList", "hostNameList"].includes(cmd);
    const res = await getCmd(cmd, multi);
    out[cmd] = res.json;
    console.log(cmd.split(",")[0] + ":", JSON.stringify(res.json).slice(0, 250));
  }

  // REBOOT dry-run
  const reboot = await setCmd("isTest=true&goformId=REBOOT_DEVICE");
  out.rebootDryRun = reboot.json;
  console.log("REBOOT dry-run:", reboot.json);

  // Public (no auth) traffic
  cookies.length = 0;
  const pub = await getCmd("monthly_tx_bytes,monthly_rx_bytes,realtime_tx_thrpt,realtime_rx_thrpt");
  out.publicTraffic = pub.json;
  console.log("public traffic:", pub.json);

  writeFileSync("scripts/investigate-extra-output.json", JSON.stringify(out, null, 2));
}

main().catch(console.error);
