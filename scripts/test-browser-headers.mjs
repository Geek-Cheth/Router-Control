import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const cookies = ["pageForward=home"];

async function req(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      Origin: base,
      Pragma: "no-cache",
      Referer: `${base}/main.html`,
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest",
      Cookie: cookies.join("; "),
      ...init.headers,
    },
  });
  return res;
}

await req("/main.html");
const login = await req("/goform/goform_set_cmd_process", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: loginBody({ uppercase: true }),
});
console.log("LOGIN:", await login.text());

for (const cmd of ["loginfo", "monthly_tx_bytes,monthly_rx_bytes", "station_list"]) {
  const multi = cmd.includes(",") ? "&multi_data=1" : "";
  const r = await req(`/goform/goform_get_cmd_process?isTest=false&cmd=${cmd}${multi}`);
  console.log(cmd, ":", await r.text());
}
