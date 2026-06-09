import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const cookies = [];

async function fetchRouter(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Referer: `${base}/main.html`,
      Origin: base,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
      ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
      ...init.headers,
    },
  });
  return res;
}

async function ensureLogin() {
  await fetchRouter(`${base}/main.html`);
  const res = await fetchRouter(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody(),
  });
  const data = await res.json();
  console.log("login:", data);
  cookies.push("pageForward=home");
}

async function getCmd(cmd, multi) {
  const params = new URLSearchParams({ isTest: "false", cmd });
  if (multi) params.set("multi_data", "1");
  const res = await fetchRouter(`${base}/goform/goform_get_cmd_process?${params}`);
  return res.json();
}

await ensureLogin();

const queries = [
  ["monthly_tx_bytes,monthly_rx_bytes,data_volume_limit_switch,data_volume_limit_size,realtime_tx_thrpt,realtime_rx_thrpt", true],
  ["cr_version,tz_real_version,imei,SSID1,MAX_Access_num,wifi_cur_state,lan_ipaddr,wan_ipaddr", true],
  ["ACL_mode,wifi_mac_white_list,wifi_mac_black_list", true],
  ["network_type,rsrp,rsrq,sinr,band", true],
  ["station_list", false],
];

for (const [cmd, multi] of queries) {
  console.log("\nCMD:", cmd.slice(0, 60));
  console.log(JSON.stringify(await getCmd(cmd, multi)));
}
