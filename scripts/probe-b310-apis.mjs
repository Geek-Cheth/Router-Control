import CryptoJS from "crypto-js";

const BASE = "http://192.168.8.1";
const USER = "user";
const PASS = "yi5hfGe1";

function object2xml(root, obj) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?><${root}>`;
  for (const [k, v] of Object.entries(obj)) xml += `<${k}>${v}</${k}>`;
  return `${xml}</${root}>`;
}

function getTokens(headers) {
  const tokens = [];
  for (const key of ["__RequestVerificationTokenone", "__RequestVerificationTokentwo", "__RequestVerificationToken"]) {
    const val = headers.get(key);
    if (val) tokens.push(val);
  }
  return tokens;
}

const SCRAM = {
  nonce() { return CryptoJS.lib.WordArray.random(32); },
  saltedPassword(p, s, i) { return CryptoJS.PBKDF2(p, s, { keySize: 8, iterations: i, hasher: CryptoJS.algo.SHA256 }); },
  clientKey(s) { return CryptoJS.HmacSHA256(s, "Client Key"); },
  storedKey(c) { const h = CryptoJS.algo.SHA256.create(); h.update(c); return h.finalize(); },
  signature(s, m) { return CryptoJS.HmacSHA256(s, m); },
  clientProof(p, s, i, a) {
    const sp = this.saltedPassword(p, s, i), ck = this.clientKey(sp), sk = this.storedKey(ck), cs = this.signature(sk, a);
    for (let j = 0; j < ck.sigBytes / 4; j++) ck.words[j] ^= cs.words[j];
    return ck.toString();
  },
};

let cookie = "", token = "";
const sesText = await fetch(`${BASE}/api/webserver/SesTokInfo`).then((r) => r.text());
cookie = sesText.match(/<SesInfo>([^<]+)/)[1];
token = sesText.match(/<TokInfo>([^<]+)/)[1];
const fn = SCRAM.nonce().toString();
const s1 = await fetch(`${BASE}/api/user/challenge_login`, {
  method: "POST",
  headers: { Cookie: cookie, __RequestVerificationToken: token, "Content-Type": "application/xml" },
  body: object2xml("request", { username: USER, firstnonce: fn, mode: "1" }),
});
const s1t = await s1.text();
token = getTokens(s1.headers)[0] ?? token;
const salt = CryptoJS.enc.Hex.parse(s1t.match(/<salt>([^<]+)/)[1]);
const iter = parseInt(s1t.match(/<iterations>([^<]+)/)[1], 10);
const sn = s1t.match(/<servernonce>([^<]+)/)[1];
const cp = SCRAM.clientProof(PASS, salt, iter, `${fn},${sn},${sn}`);
const s2 = await fetch(`${BASE}/api/user/authentication_login`, {
  method: "POST",
  headers: { Cookie: cookie, __RequestVerificationToken: token, "Content-Type": "application/xml" },
  body: object2xml("request", { clientproof: cp, finalnonce: sn }),
});
cookie = (s2.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ") || cookie;
token = getTokens(s2.headers)[0] ?? token;

async function get(path) {
  const res = await fetch(`${BASE}/${path}`, { headers: { Cookie: cookie, __RequestVerificationToken: token } });
  const t = await res.text();
  const nt = getTokens(res.headers);
  if (nt.length) token = nt[0];
  return t.trim();
}

const paths = [
  "api/lan/HostInfo",
  "api/wlan/host-list",
  "api/wlan/station-list",
  "api/monitoring/check-network-status",
  "api/net/current-plmn",
  "api/net/net-mode",
  "api/device/signal",
  "api/monitoring/signal",
  "api/monitoring/traffic-statistics",
  "api/monitoring/month_statistics",
  "api/monitoring/monthly_statistics",
  "api/monitoring/status",
  "api/wlan/basic-settings",
  "api/dhcp/settings",
  "api/device/information",
  "api/device/basic_information",
  "api/wlan/security-settings",
];

for (const p of paths) {
  const t = await get(p);
  if (!t.includes("<error>")) console.log(`\n=== ${p} ===\n${t.slice(0, 800)}`);
}
