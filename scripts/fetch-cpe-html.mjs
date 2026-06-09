import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const cookies = [];

async function req(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: `${base}/main.html`,
      ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const name = c.split("=")[0];
    const i = cookies.findIndex((x) => x.startsWith(`${name}=`));
    if (i >= 0) cookies[i] = c.split(";")[0];
    else cookies.push(c.split(";")[0]);
  }
  return { status: res.status, text: await res.text() };
}

const paths = [
  "/html/wifi/station_info.html",
  "/html/firewall/rate_limit.html",
  "/html/status/flow_setting.html",
  "/html/status/traffic_alert.html",
  "/js/status/flow_setting.js",
  "/js/firewall/rate_limit.js",
  "/js/wifi/station_info.js",
];

async function main() {
  await req(`${base}/main.html`);
  await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody(),
  });
  cookies.push("pageForward=home");

  for (const p of paths) {
    const r = await req(`${base}${p}`);
    console.log(`\n${p} (${r.status}, ${r.text.length} bytes)`);
    const cols = [...r.text.matchAll(/<th[^>]*>([^<]+)</g)].map((m) => m[1].trim());
    if (cols.length) console.log("  cols:", cols.join(" | "));
    const trans = [
      ...new Set([...r.text.matchAll(/data-trans="([^"]+)"/g)].map((m) => m[1])),
    ];
    if (trans.length) console.log("  data-trans:", trans.join(", "));
    const goforms = [
      ...new Set(
        [...r.text.matchAll(/goformId[=:]["']([A-Z0-9_]+)["']/g)].map((m) => m[1])
      ),
    ];
    if (goforms.length) console.log("  goformIds:", goforms.join(", "));
    if (r.text.includes("getFlow") || r.text.includes("tz_get_flow"))
      console.log("  contains getFlow/tz_get_flow");
    if (r.text.includes("RateLimit"))
      console.log("  contains RateLimit");
    if (r.text.length < 8000) console.log(r.text.slice(0, 2000));
  }
}

main().catch((e) => console.error(e.message));
