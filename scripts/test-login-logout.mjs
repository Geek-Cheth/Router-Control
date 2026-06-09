import { encodeLoginField, getRouterUsername, requireRouterPassword } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";

async function attempt(label, body) {
  const cookies = [];
  async function req(path, init = {}) {
    return fetch(`${base}${path}`, {
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
  }

  await req("/main.html");
  await req("/goform/goform_set_cmd_process", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "isTest=false&goformId=LOGOUT",
  });

  const login = await req("/goform/goform_set_cmd_process", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  cookies.push("pageForward=home");
  const loginText = await login.text();
  const loginfo = await req(
    "/goform/goform_get_cmd_process?isTest=false&cmd=loginfo&multi_data=1"
  ).then((r) => r.text());
  const multi = await req(
    "/goform/goform_get_cmd_process?isTest=false&cmd=monthly_tx_bytes,monthly_rx_bytes&multi_data=1"
  ).then((r) => r.text());
  console.log(`\n[${label}]`);
  console.log("  login:", loginText);
  console.log("  loginfo:", loginfo);
  console.log("  traffic:", multi);
}

const password = requireRouterPassword();
const username = getRouterUsername();
const userB64 = encodeLoginField(username);
const pwdB64 = encodeLoginField(password);

await attempt("lower plain pwd", `isTest=false&goformId=LOGIN&username=${userB64}&password=${password}&CSRFToken=`);
await attempt("lower b64 pwd", `isTest=false&goformId=LOGIN&username=${userB64}&password=${pwdB64}&CSRFToken=`);
await attempt("upper plain pwd", `isTest=false&goformId=LOGIN&Username=${userB64}&Password=${password}`);
await attempt("upper b64 pwd", `isTest=false&goformId=LOGIN&Username=${userB64}&Password=${pwdB64}`);
await attempt("lower plain user", `isTest=false&goformId=LOGIN&username=${username}&password=${password}&CSRFToken=`);
