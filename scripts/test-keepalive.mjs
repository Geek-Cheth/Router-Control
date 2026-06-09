import http from "node:http";
import { loginBody } from "./lib/credentials.mjs";

const base = "192.168.8.1";

function request(path, method = "GET", body = null, cookies = []) {
  return new Promise((resolve, reject) => {
    const headers = {
      Host: base,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `http://${base}/main.html`,
      Origin: `http://${base}`,
      Connection: "keep-alive",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (cookies.length) headers.Cookie = cookies.join("; ");
    if (body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = http.request(
      { hostname: base, port: 80, path, method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const cookies = ["pageForward=home"];

await request("/main.html", "GET", null, cookies);
const login = await request(
  "/goform/goform_set_cmd_process",
  "POST",
  loginBody({ uppercase: true }),
  cookies
);
console.log("LOGIN:", login.body);

const loginfo = await request(
  "/goform/goform_get_cmd_process?isTest=false&cmd=loginfo&multi_data=1",
  "GET",
  null,
  cookies
);
console.log("LOGINFO:", loginfo.body);

const multi = await request(
  "/goform/goform_get_cmd_process?isTest=false&cmd=monthly_tx_bytes,monthly_rx_bytes&multi_data=1",
  "GET",
  null,
  cookies
);
console.log("MULTI:", multi.body);

const devices = await request(
  "/goform/goform_get_cmd_process?isTest=false&cmd=station_list",
  "GET",
  null,
  cookies
);
console.log("DEVICES:", devices.body);
