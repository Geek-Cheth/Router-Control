import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const cookies = ["pageForward=home"];

async function req(path) {
  const t0 = performance.now();
  const res = await fetch(`${base}${path}`, {
    headers: {
      Referer: `${base}/main.html`,
      Cookie: cookies.join("; "),
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  const body = await res.text();
  return { ms: performance.now() - t0, body };
}

// login
await fetch(`${base}/goform/goform_set_cmd_process`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Referer: `${base}/main.html`,
  },
  body: loginBody(),
});

const times = [];
for (let i = 0; i < 20; i++) {
  const r = await req(
    "/goform/goform_get_cmd_process?isTest=false&cmd=realtime_tx_thrpt,realtime_rx_thrpt&multi_data=1"
  );
  times.push(r.ms);
}
times.sort((a, b) => a - b);
console.log("Speed API latency (ms):", {
  min: times[0].toFixed(0),
  p50: times[10].toFixed(0),
  max: times[19].toFixed(0),
  avg: (times.reduce((a, b) => a + b) / times.length).toFixed(0),
});
