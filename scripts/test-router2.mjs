import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const cookies = [];

async function req(url, init = {}) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    Referer: `${base}/main.html`,
    Origin: base,
    ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
    ...init.headers,
  };
  const res = await fetch(url, { ...init, headers });
  const set = res.headers.getSetCookie?.() ?? [];
  const raw = res.headers.get("set-cookie");
  if (raw && set.length === 0) set.push(raw);
  for (const c of set) cookies.push(c.split(";")[0]);
  return res;
}

async function main() {
  // Load pages like browser does
  await req(`${base}/main.html`);
  await req(`${base}/index.html`);

  const login = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody({ uppercase: true }),
  });
  console.log("LOGIN:", await login.text());
  cookies.push("pageForward=home");

  const loginfo = await req(
    `${base}/goform/goform_get_cmd_process?isTest=false&cmd=loginfo&multi_data=1`
  );
  console.log("LOGINFO:", await loginfo.text());

  const multi = await req(
    `${base}/goform/goform_get_cmd_process?isTest=false&cmd=monthly_tx_bytes,monthly_rx_bytes,SSID1&multi_data=1`
  );
  console.log("MULTI:", await multi.text());

  const devices = await req(
    `${base}/goform/goform_get_cmd_process?isTest=false&cmd=station_list`
  );
  console.log("DEVICES:", await devices.text());
}

main().catch(console.error);
