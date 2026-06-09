import { loginBody } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";

async function main() {
  const res = await fetch(`${base}/goform/goform_set_cmd_process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${base}/main.html`,
      Origin: base,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: loginBody({ uppercase: true }),
  });

  console.log("Status:", res.status);
  console.log("Headers:");
  for (const [k, v] of res.headers.entries()) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("Body:", await res.text());

  // Also check main.html response headers
  const main = await fetch(`${base}/main.html`);
  console.log("\nmain.html headers:");
  for (const [k, v] of main.headers.entries()) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch(console.error);
