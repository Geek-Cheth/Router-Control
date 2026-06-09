import { readFileSync, writeFileSync } from "fs";

const svc = readFileSync("scripts/service.js.dump", "utf8");

const targets = [
  "CHANGE_PASSWORD",
  "REBOOT_DEVICE",
  "RESTORE_FACTORY_SETTINGS",
  "TURN_OFF_DEVICE",
  "SET_WIFI_SSID1_SETTINGS",
  "SET_WIFI_SSID2_SETTINGS",
  "SET_WIFI_INFO",
  "DHCP_SETTING",
  "DMZ_SETTING",
  "ADD_RATE_LIMIT",
  "DEL_RATE_LIMIT",
  "ADD_IP_PORT_FILETER",
  "DEL_IP_PORT_FILETER",
  "ADD_PORT_MAP",
  "DEL_PORT_MAP",
  "SEND_SMS",
  "DELETE_SMS",
  "SAVE_SMS",
  "TZ_START_SYSTEM_UPGRADE",
  "IF_UPGRADE",
  "fota",
  "station_list",
  "lan_station_list",
  "realtime_tx_thrpt",
  "realtime_rx_thrpt",
  "login:function",
  "changePassword",
  "reboot",
  "setWifi",
  "setDhcp",
  "setDMZ",
  "getStation",
  "getRateLimit",
  "getPortMap",
  "getPortFilter",
  "getSms",
];

const details = {};
for (const t of targets) {
  let idx = 0;
  const hits = [];
  while ((idx = svc.indexOf(t, idx)) >= 0 && hits.length < 3) {
    hits.push(svc.slice(Math.max(0, idx - 150), idx + 600));
    idx += t.length;
  }
  if (hits.length) details[t] = hits;
}

// Find function names near goformIds
const fnPattern = /(\w+):function\(\)\{return v\(arguments/g;
const fns = [...svc.matchAll(fnPattern)].map((m) => m[1]).sort();
details.allFunctions = [...new Set(fns)];

writeFileSync("scripts/goform-details.json", JSON.stringify(details, null, 2));

// Print key blocks
for (const k of ["CHANGE_PASSWORD", "REBOOT_DEVICE", "SET_WIFI_SSID1_SETTINGS", "DHCP_SETTING", "DMZ_SETTING", "ADD_RATE_LIMIT", "station_list", "realtime_tx_thrpt", "login:function"]) {
  if (details[k]) {
    console.log(`\n=== ${k} ===`);
    console.log(details[k][0]);
  }
}
