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

type XmlValue = string | number | null | undefined | XmlValue[] | { [key: string]: XmlValue };

function valueToXml(key: string, value: XmlValue): string {
  if (value === null || value === undefined) return `<${key}></${key}>`;
  if (Array.isArray(value)) {
    return value.map((item) => valueToXml(key, item)).join("");
  }
  if (typeof value === "object") {
    let inner = "";
    for (const [childKey, childValue] of Object.entries(value)) {
      inner += valueToXml(childKey, childValue);
    }
    return `<${key}>${inner}</${key}>`;
  }
  return `<${key}>${value}</${key}>`;
}

export function object2xml(root: string, obj: Record<string, XmlValue>) {
  let inner = "";
  for (const [key, value] of Object.entries(obj)) {
    inner += valueToXml(key, value);
  }
  return `<?xml version="1.0" encoding="UTF-8"?><${root}>${inner}</${root}>`;
}

export const HUAWEI_MAC_FILTER_SLOTS = 10;

export function parseHuaweiMacFilterSlots(
  data: Record<string, string>
): string[] {
  const macs: string[] = [];
  for (let i = 0; i < HUAWEI_MAC_FILTER_SLOTS; i += 1) {
    const mac = (data[`WifiMacFilterMac${i}`] ?? "").trim();
    if (mac) macs.push(mac.toUpperCase());
  }
  return macs;
}

export function buildHuaweiMacFilterSlots(
  macs: string[],
  hostnames: string[] = []
): Record<string, string> {
  const slots: Record<string, string> = {};
  for (let i = 0; i < HUAWEI_MAC_FILTER_SLOTS; i += 1) {
    slots[`WifiMacFilterMac${i}`] = (macs[i] ?? "").toLowerCase();
    slots[`wifihostname${i}`] = hostnames[i] ?? "";
  }
  return slots;
}

/** Extract each <Ssid>...</Ssid> block as a flat field map. */
export function parseHuaweiSsidBlocks(text: string): Array<Record<string, string>> {
  const blocks: Array<Record<string, string>> = [];
  for (const match of text.matchAll(/<Ssid>([\s\S]*?)<\/Ssid>/g)) {
    const fields: Record<string, string> = {};
    for (const field of match[1].matchAll(/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g)) {
      fields[field[1]] = field[2];
    }
    if (Object.keys(fields).length > 0) blocks.push(fields);
  }
  return blocks;
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
    if (!value) continue;
    for (const part of value.split("#")) {
      const trimmed = part.trim();
      if (trimmed) tokens.push(trimmed);
    }
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
