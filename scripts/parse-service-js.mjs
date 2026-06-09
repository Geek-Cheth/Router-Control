import { readFileSync, writeFileSync } from "fs";

const svc = readFileSync("scripts/service.js.dump", "utf8");

const goformIds = [
  ...new Set([...svc.matchAll(/goformId\s*[:=]\s*["']([A-Z0-9_]+)["']/g)].map((m) => m[1])),
].sort();

const cmds = [
  ...new Set([...svc.matchAll(/cmd\s*[:=]\s*["']([a-z0-9_,]+)["']/g)].map((m) => m[1])),
].sort();

const keywords = [
  "station_list",
  "lan_station_list",
  "rate_limit",
  "traffic",
  "bandwidth",
  "reboot",
  "REBOOT",
  "RESTART",
  "CHANGE_PASSWORD",
  "PASSWORD",
  "SSID",
  "DHCP",
  "url_filter",
  "port_forward",
  "PORT_FORWARD",
  "DMZ",
  "guest",
  "GUEST",
  "sms",
  "SMS",
  "firmware",
  "FIRMWARE",
  "realtime_tx_thrpt",
  "realtime_rx_thrpt",
  "monthly_tx_bytes",
  "monthly_rx_bytes",
  "device",
  "client",
  "usage",
  "bytes",
  "station_rate",
  "wifi_station",
];

const snippets = {};
for (const kw of keywords) {
  let idx = 0;
  const hits = [];
  while ((idx = svc.indexOf(kw, idx)) >= 0 && hits.length < 5) {
    hits.push({
      pos: idx,
      context: svc.slice(Math.max(0, idx - 120), idx + 280),
    });
    idx += kw.length;
  }
  if (hits.length) snippets[kw] = hits;
}

// Extract function blocks for specific goformIds
const goformBlocks = {};
for (const id of goformIds) {
  const patterns = [
    `goformId:"${id}"`,
    `goformId:'${id}'`,
    `goformId="${id}"`,
    `goformId='${id}'`,
  ];
  for (const p of patterns) {
    const idx = svc.indexOf(p);
    if (idx >= 0) {
      goformBlocks[id] = svc.slice(Math.max(0, idx - 200), idx + 500);
      break;
    }
  }
}

const out = { goformIds, cmds, snippets, goformBlocks };
writeFileSync("scripts/service-js-parsed.json", JSON.stringify(out, null, 2));
console.log("goformIds:", goformIds.length);
console.log("cmds:", cmds.length);
console.log("\nAll goformIds:\n" + goformIds.join("\n"));
console.log("\nAll cmds:\n" + cmds.join("\n"));
