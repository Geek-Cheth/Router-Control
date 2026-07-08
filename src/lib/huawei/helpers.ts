import CryptoJS from "crypto-js";

export const huaweiScram = {
  nonce() {
    return CryptoJS.lib.WordArray.random(32);
  },
  saltedPassword(password: string, salt: CryptoJS.lib.WordArray, iterations: number) {
    return CryptoJS.PBKDF2(password, salt, {
      keySize: 8,
      iterations,
      hasher: CryptoJS.algo.SHA256,
    });
  },
  clientKey(saltPwd: CryptoJS.lib.WordArray) {
    return CryptoJS.HmacSHA256(saltPwd, "Client Key");
  },
  serverKey(saltPwd: CryptoJS.lib.WordArray) {
    return CryptoJS.HmacSHA256(saltPwd, "Server Key");
  },
  storedKey(clientKey: CryptoJS.lib.WordArray) {
    const hasher = CryptoJS.algo.SHA256.create();
    hasher.update(clientKey);
    return hasher.finalize();
  },
  signature(storedKey: CryptoJS.lib.WordArray, authMessage: string) {
    return CryptoJS.HmacSHA256(storedKey, authMessage);
  },
  clientProof(
    password: string,
    salt: CryptoJS.lib.WordArray,
    iterations: number,
    authMessage: string
  ) {
    const spwd = this.saltedPassword(password, salt, iterations);
    const ckey = this.clientKey(spwd);
    const skey = this.storedKey(ckey);
    const csig = this.signature(skey, authMessage);
    for (let i = 0; i < ckey.sigBytes / 4; i += 1) {
      ckey.words[i] ^= csig.words[i];
    }
    return ckey.toString();
  },
  serverProof(
    password: string,
    salt: CryptoJS.lib.WordArray,
    iterations: number,
    authMessage: string
  ) {
    const spwd = this.saltedPassword(password, salt, iterations);
    const skey = this.serverKey(spwd);
    return this.signature(skey, authMessage).toString();
  },
};

export function object2xml(root: string, obj: Record<string, string | number>) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?><${root}>`;
  for (const [key, value] of Object.entries(obj)) {
    xml += `<${key}>${value}</${key}>`;
  }
  return `${xml}</${root}>`;
}

export function parseXmlResponse(text: string): Record<string, string> {
  const response: Record<string, string> = {};
  for (const match of text.matchAll(/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g)) {
    if (match[1] !== "response" && match[1] !== "error") {
      response[match[1]] = match[2];
    }
  }
  return response;
}

export function xmlHasError(text: string): boolean {
  return text.includes("<error>");
}

export function getVerificationTokens(headers: Headers): string[] {
  const tokens: string[] = [];
  for (const key of [
    "__RequestVerificationTokenone",
    "__RequestVerificationTokentwo",
    "__RequestVerificationToken",
    "__requestverificationtokenone",
    "__requestverificationtokentwo",
    "__requestverificationtoken",
  ]) {
    const value = headers.get(key);
    if (value) tokens.push(value);
  }
  return tokens;
}

export function parseHostList(text: string) {
  const hosts: Array<Record<string, string>> = [];
  for (const block of text.matchAll(/<Host>([\s\S]*?)<\/Host>/g)) {
    const host: Record<string, string> = {};
    for (const field of block[1].matchAll(/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g)) {
      host[field[1]] = field[2];
    }
    if (Object.keys(host).length > 0) hosts.push(host);
  }
  return hosts;
}

export function bytesPerSecondToKbps(rate: string | undefined): number {
  const n = parseInt(rate ?? "0", 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return (n * 8) / 1000;
}

export function networkTypeLabel(code: string | undefined): string {
  const map: Record<string, string> = {
    "19": "LTE",
    "7": "LTE",
    "3": "3G",
    "2": "2G",
  };
  return map[code ?? ""] ?? code ?? "—";
}
