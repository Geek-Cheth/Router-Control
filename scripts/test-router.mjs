import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const cookies = [];

async function req(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      Referer: `${base}/main.html`,
      ...(cookies.length ? { Cookie: cookies.join("; ") } : {}),
      ...init?.headers,
    },
  });
  const set = res.headers.getSetCookie?.() ?? [];
  const raw = res.headers.get("set-cookie");
  if (raw && set.length === 0) set.push(raw);
  for (const c of set) cookies.push(c.split(";")[0]);
  return res;
}

async function main() {
  await req(`${base}/main.html`);
  const login = await req(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: loginBody({ uppercase: true }),
  });
  console.log("LOGIN:", await login.text());
  cookies.push("pageForward=home");
  console.log("COOKIES after login:", cookies);

  const multi = await req(
    `${base}/goform/goform_get_cmd_process?isTest=false&cmd=monthly_tx_bytes,monthly_rx_bytes,SSID1,MAX_Access_num,realtime_tx_thrpt,realtime_rx_thrpt&multi_data=1`
  );
  console.log("MULTI:", await multi.text());

  const devices = await req(
    `${base}/goform/goform_get_cmd_process?isTest=false&cmd=station_list`
  );
  console.log("DEVICES:", await devices.text());

  const acl = await req(
    `${base}/goform/goform_get_cmd_process?isTest=false&cmd=ACL_mode,wifi_mac_white_list,wifi_mac_black_list&multi_data=1`
  );
  console.log("ACL:", await acl.text());

  // Try without login (public status)
  cookies.length = 0;
  const pub = await req(
    `${base}/goform/goform_get_cmd_process?isTest=false&cmd=monthly_tx_bytes,monthly_rx_bytes,realtime_tx_thrpt,realtime_rx_thrpt&multi_data=1`
  );
  console.log("PUBLIC:", await pub.text());
}

main().catch(console.error);
