import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const svc = await fetch(`${base}/js/service.js`).then((r) => r.text());
const idx = svc.indexOf('goformId:"LOGIN"');
console.log(svc.slice(idx - 100, idx + 300));

// Try lowercase field names
const cookies = [];
async function req(url, init = {}) {
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

await req(`${base}/main.html`);
const login = await req(`${base}/goform/goform_set_cmd_process`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: loginBody({ plainPassword: true }),
});
console.log("lowercase login:", await login.text());
cookies.push("pageForward=home");
const loginfo = await req(
  `${base}/goform/goform_get_cmd_process?isTest=false&cmd=loginfo&multi_data=1`
).then((r) => r.text());
console.log("loginfo:", loginfo);

const multi = await req(
  `${base}/goform/goform_get_cmd_process?isTest=false&cmd=monthly_tx_bytes,monthly_rx_bytes&multi_data=1`
).then((r) => r.text());
console.log("multi:", multi);
