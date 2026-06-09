/**
 * Probe per-device traffic APIs on Dialog 4G CPE
 */
import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const cookies = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(url, init = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "*/*",
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
      try {
        json = JSON.parse(text);
      } catch {
        /* not json */
      }
      return { status: res.status, text, json };
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(1000);
    }
  }
}

async function main() {
  await sleep(500);
  await req(`${base}/main.html`);
  await sleep(300);
  const login = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody(),
  });
  cookies.push("pageForward=home");
  console.log("LOGIN:", login.json);

  await sleep(500);
  const flow = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "isTest=false&goformId=tz_get_flow",
  });
  console.log("tz_get_flow:", JSON.stringify(flow.json ?? flow.text).slice(0, 3000));

  const htmlPaths = [
    "/html/wifi/station_info.html",
    "/html/firewall/rate_limit.html",
    "/html/firewall/flow_setting.html",
    "/html/status/traffic_alert.html",
  ];
  for (const path of htmlPaths) {
    await sleep(300);
    const r = await req(`${base}${path}`);
    console.log(`\n=== ${path} (${r.status}, ${r.text.length} bytes) ===`);
    const cols = [...r.text.matchAll(/<th[^>]*>([^<]+)</gi)].map((m) => m[1].trim());
    if (cols.length) console.log("Columns:", cols.join(" | "));
    const koBindings = [
      ...r.text.matchAll(/data-bind="([^"]+)"/g),
    ].map((m) => m[1]).filter((b) => /flow|traffic|byte|upload|download|rate|station|device|mac/i.test(b));
    if (koBindings.length) console.log("KO bindings:", [...new Set(koBindings)].slice(0, 20).join(" | "));
    const ids = [...r.text.matchAll(/id="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((id) => /flow|traffic|station|rate|device|mac|byte|upload|download/i.test(id));
    if (ids.length) console.log("IDs:", [...new Set(ids)].slice(0, 25).join(", "));
  }

  const extraCmds = [
    "station_list",
    "client_traffic",
    "device_traffic_list",
    "station_traffic",
    "wifi_station_list",
    "hostNameList",
  ];
  for (const cmd of extraCmds) {
    await sleep(200);
    const r = await req(
      `${base}/goform/goform_get_cmd_process?${new URLSearchParams({ isTest: "false", cmd })}`
    );
    console.log(`\nCMD ${cmd}:`, JSON.stringify(r.json ?? r.text).slice(0, 500));
  }
}

main().catch((e) => console.error("ERR:", e.message));
