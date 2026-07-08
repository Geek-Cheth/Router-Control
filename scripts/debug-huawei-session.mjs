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
  for (const key of [
    "__RequestVerificationTokenone",
    "__RequestVerificationTokentwo",
    "__RequestVerificationToken",
  ]) {
    const val = headers.get(key);
    if (val) tokens.push(val);
  }
  return tokens;
}

const SCRAM = {
  nonce() {
    return CryptoJS.lib.WordArray.random(32);
  },
  saltedPassword(password, salt, iterations) {
    return CryptoJS.PBKDF2(password, salt, { keySize: 8, iterations, hasher: CryptoJS.algo.SHA256 });
  },
  clientKey(saltPwd) {
    return CryptoJS.HmacSHA256(saltPwd, "Client Key");
  },
  storedKey(clientKey) {
    const hasher = CryptoJS.algo.SHA256.create();
    hasher.update(clientKey);
    return hasher.finalize();
  },
  signature(storedKey, authMessage) {
    return CryptoJS.HmacSHA256(storedKey, authMessage);
  },
  clientProof(password, salt, iterations, authMessage) {
    const spwd = this.saltedPassword(password, salt, iterations);
    const ckey = this.clientKey(spwd);
    const skey = this.storedKey(ckey);
    const csig = this.signature(skey, authMessage);
    for (let i = 0; i < ckey.sigBytes / 4; i += 1) ckey.words[i] ^= csig.words[i];
    return ckey.toString();
  },
};

let cookie = "";
let token = "";

const sesRes = await fetch(`${BASE}/api/webserver/SesTokInfo`);
const sesText = await sesRes.text();
cookie = sesText.match(/<SesInfo>([^<]+)/)[1];
token = sesText.match(/<TokInfo>([^<]+)/)[1];
console.log("init cookie:", cookie.slice(0, 80));
console.log("init set-cookie:", sesRes.headers.getSetCookie?.() ?? "none");

const firstNonce = SCRAM.nonce().toString();
const step1 = await fetch(`${BASE}/api/user/challenge_login`, {
  method: "POST",
  headers: { Cookie: cookie, __RequestVerificationToken: token, "Content-Type": "application/xml" },
  body: object2xml("request", { username: USER, firstnonce: firstNonce, mode: "1" }),
});
const step1Text = await step1.text();
const step1Tokens = getTokens(step1.headers);
if (step1Tokens.length) token = step1Tokens[0];
console.log("\nstep1 status:", step1.status);
console.log("step1 set-cookie:", step1.headers.getSetCookie?.() ?? "none");
console.log("step1 tokens:", step1Tokens);

const salt = CryptoJS.enc.Hex.parse(step1Text.match(/<salt>([^<]+)/)[1]);
const iter = parseInt(step1Text.match(/<iterations>([^<]+)/)[1], 10);
const serverNonce = step1Text.match(/<servernonce>([^<]+)/)[1];
const authMsg = `${firstNonce},${serverNonce},${serverNonce}`;
const clientProof = SCRAM.clientProof(PASS, salt, iter, authMsg);

const step2 = await fetch(`${BASE}/api/user/authentication_login`, {
  method: "POST",
  headers: { Cookie: cookie, __RequestVerificationToken: token, "Content-Type": "application/xml" },
  body: object2xml("request", { clientproof: clientProof, finalnonce: serverNonce }),
});
const step2Text = await step2.text();
const step2Tokens = getTokens(step2.headers);
const step2Cookies = step2.headers.getSetCookie?.() ?? [];
if (step2Cookies.length) {
  cookie = step2Cookies.map((c) => c.split(";")[0]).join("; ");
}
console.log("\nstep2 status:", step2.status);
console.log("step2 set-cookie:", step2Cookies);
console.log("step2 updated cookie:", cookie.slice(0, 80));
console.log("step2 tokens:", step2Tokens);
console.log("step2 body:", step2Text.slice(0, 200));

async function tryGet(label, headers) {
  const res = await fetch(`${BASE}/api/user/state-login`, { headers });
  const text = await res.text();
  console.log(`\n${label}:`, res.status, text.trim().slice(0, 250));
  console.log("  response tokens:", getTokens(res.headers));
  console.log("  set-cookie:", res.headers.getSetCookie?.() ?? "none");
}

await tryGet("no-token", { Cookie: cookie });
if (step2Tokens[0]) {
  await tryGet("step2-token-0", { Cookie: cookie, __RequestVerificationToken: step2Tokens[0] });
}
if (step2Tokens[1]) {
  await tryGet("step2-token-1", { Cookie: cookie, __RequestVerificationToken: step2Tokens[1] });
}
