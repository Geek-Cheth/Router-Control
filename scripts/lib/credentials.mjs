export function requireRouterPassword() {
  const password = process.env.ROUTER_PASSWORD;
  if (!password) {
    console.error("Set ROUTER_PASSWORD (and optionally ROUTER_USERNAME) before running this script.");
    process.exit(1);
  }
  return password;
}

export function getRouterUsername() {
  return process.env.ROUTER_USERNAME ?? "user";
}

export function encodeLoginField(value) {
  return Buffer.from(value).toString("base64");
}

export function loginBody(options = {}) {
  const password = requireRouterPassword();
  const username = getRouterUsername();
  const userB64 = encodeLoginField(username);
  const pwdB64 = encodeLoginField(password);

  if (options.plainPassword) {
    return `isTest=false&goformId=LOGIN&username=${userB64}&password=${password}&CSRFToken=`;
  }

  if (options.uppercase) {
    return `isTest=false&goformId=LOGIN&Username=${userB64}&Password=${password}`;
  }

  return `isTest=false&goformId=LOGIN&username=${userB64}&password=${pwdB64}&CSRFToken=`;
}
