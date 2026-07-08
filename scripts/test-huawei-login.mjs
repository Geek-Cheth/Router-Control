import CryptoJS from "crypto-js";

const BASE = process.env.ROUTER_URL ?? "http://192.168.8.1";
const USERNAME = process.env.ROUTER_USERNAME ?? "user";
const PASSWORD = process.env.ROUTER_PASSWORD ?? "Mbo5DjaM";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "*/*",
  "X-Requested-With": "XMLHttpRequest",
};

function object2xml(root, obj) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?><${root}>`;
  for (const [k, v] of Object.entries(obj)) {
    xml += `<${k}>${v}</${k}>`;
  }
  xml += `</${root}>`;
  return xml;
}

function parseXml(text) {
  const get = (tag) => {
    const m = text.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return m?.[1];
  };
  if (text.includes("<response>")) {
    const response = {};
    for (const m of text.matchAll(/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g)) {
      if (m[1] !== "response") response[m[1]] = m[2];
    }
    return { type: "response", response };
  }
  if (text.includes("<error>")) {
    return { type: "error", error: { code: get("code"), message: get("message") } };
  }
  return { type: "unknown", raw: text };
}

function getTokensFromHeaders(headers) {
  const tokens = [];
  for (const key of [
    "__RequestVerificationTokenone",
    "__RequestVerificationTokentwo",
    "__RequestVerificationToken",
    "__requestverificationtokenone",
    "__requestverificationtokentwo",
    "__requestverificationtoken",
  ]) {
    const val = headers.get(key);
    if (val) tokens.push(val);
  }
  return tokens;
}

// SCRAM implementation (from router scram.js)
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
  serverKey(saltPwd) {
    return CryptoJS.HmacSHA256(saltPwd, "Server Key");
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
    for (let i = 0; i < ckey.sigBytes / 4; i += 1) {
      ckey.words[i] ^= csig.words[i];
    }
    return ckey.toString();
  },
  serverProof(password, salt, iterations, authMessage) {
    const spwd = this.saltedPassword(password, salt, iterations);
    const skey = this.serverKey(spwd);
    return this.signature(skey, authMessage);
  },
};

class Session {
  constructor() {
    this.cookie = "";
    this.tokens = [];
  }

  mergeCookies(response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    if (setCookies.length) {
      this.cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    }
  }

  async init() {
    const res = await fetch(`${BASE}/api/webserver/SesTokInfo`, { headers: HEADERS });
    const text = await res.text();
    const parsed = parseXml(text);
    const sesInfo = parsed.response?.SesInfo;
    const tokInfo = parsed.response?.TokInfo;
    if (!sesInfo || !tokInfo) throw new Error(`SesTokInfo failed: ${text}`);
    this.cookie = sesInfo;
    this.tokens = [tokInfo];
    return parsed;
  }

  hdr() {
    const h = { ...HEADERS, Cookie: this.cookie };
    if (this.tokens.length) h.__RequestVerificationToken = this.tokens[0];
    return h;
  }

  async get(path) {
    const res = await fetch(`${BASE}/${path}`, { headers: this.hdr() });
    const text = await res.text();
    this.mergeCookies(res);
    const newTokens = getTokensFromHeaders(res.headers);
    if (newTokens.length) this.tokens = newTokens;
    return { text, parsed: parseXml(text) };
  }

  async post(path, body) {
    const res = await fetch(`${BASE}/${path}`, {
      method: "POST",
      headers: { ...this.hdr(), "Content-Type": "application/xml" },
      body,
    });
    const text = await res.text();
    this.mergeCookies(res);
    const newTokens = getTokensFromHeaders(res.headers);
    if (newTokens.length) this.tokens = newTokens;
    return { text, parsed: parseXml(text), headers: res.headers };
  }
}

async function checkScramEnabled(session) {
  const { parsed } = await session.get("api/user/state-login");
  const r = parsed.response ?? {};
  return {
    operatorScram: r.extern_password_type === "1",
    userScram: r.user_extern_password_type === "1",
    raw: parsed,
  };
}

async function plainLogin(session) {
  const b64 = Buffer.from(PASSWORD).toString("base64");
  const xml = object2xml("request", {
    Username: USERNAME,
    Password: b64,
    password_type: "4",
  });
  return session.post("api/user/login", xml);
}

async function scramLogin(session) {
  const firstNonce = SCRAM.nonce().toString();
  const firstXml = object2xml("request", {
    username: USERNAME,
    firstnonce: firstNonce,
    mode: "1",
  });
  const step1 = await session.post("api/user/challenge_login", firstXml);
  if (step1.parsed.type !== "response") return { step: 1, ...step1 };

  const salt = CryptoJS.enc.Hex.parse(step1.parsed.response.salt);
  const iter = parseInt(step1.parsed.response.iterations, 10);
  const finalNonce = step1.parsed.response.servernonce;
  const authMsg = `${firstNonce},${finalNonce},${finalNonce}`;
  const clientProof = SCRAM.clientProof(PASSWORD, salt, iter, authMsg);

  const finalXml = object2xml("request", {
    clientproof: clientProof,
    finalnonce: finalNonce,
  });
  const step2 = await session.post("api/user/authentication_login", finalXml);
  return { step: 2, ...step2 };
}

async function main() {
  console.log(`Testing login at ${BASE} as ${USERNAME}...`);
  const session = new Session();
  const ses = await session.init();
  console.log("SesTokInfo OK");

  const scramInfo = await checkScramEnabled(session);
  console.log("SCRAM flags:", scramInfo);

  let loginResult;
  const useScram =
    (USERNAME === "user" && scramInfo.userScram) ||
    (USERNAME === "Operator" && scramInfo.operatorScram);

  if (useScram) {
    console.log("Trying SCRAM login...");
    loginResult = await scramLogin(session);
  } else {
    console.log("Trying plain login...");
    loginResult = await plainLogin(session);
  }

  console.log("Login response:", loginResult.text?.trim().slice(0, 300));

  const stateLogin = await session.get("api/user/state-login");
  console.log("state-login:", stateLogin.text.trim());

  const endpoints = [
    "api/user/state",
    "api/monitoring/traffic-statistics",
    "api/device/information",
    "api/lan/HostInfo",
    "api/monitoring/status",
  ];
  for (const ep of endpoints) {
    const res = await session.get(ep);
    console.log(`\n--- ${ep} ---`);
    console.log(res.text.trim().slice(0, 600));
  }

  const loginOk =
    loginResult.parsed?.type === "response" &&
    loginResult.parsed.response?.serversignature;

  const stateOk = stateLogin.parsed?.type === "response" &&
    stateLogin.parsed.response?.State === "0";

  console.log(loginOk ? "\n✓ SCRAM AUTH SUCCESS" : "\n✗ SCRAM AUTH FAILED");
  console.log(stateOk ? "✓ SESSION ACTIVE (State=0)" : "✗ SESSION NOT ACTIVE");
  process.exit(loginOk && stateOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
