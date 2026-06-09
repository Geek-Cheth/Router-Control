import { encodeLoginField, getRouterUsername, requireRouterPassword } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";
const cookies = ["pageForward=home"];

async function req(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Referer: `${base}/main.html`,
      Origin: base,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
      Cookie: cookies.join("; "),
      ...init.headers,
    },
  });
  return res;
}

const password = requireRouterPassword();
const username = getRouterUsername();
const userB64 = encodeLoginField(username);
const pwdB64 = encodeLoginField(password);
const variants = [
  `isTest=false&goformId=LOGIN&username=${userB64}&password=${password}`,
  `isTest=false&goformId=LOGIN&username=${userB64}&password=${pwdB64}`,
  `isTest=false&goformId=LOGIN&Username=${userB64}&Password=${password}`,
  `isTest=false&goformId=LOGIN&Username=${userB64}&Password=${pwdB64}`,
];

for (const body of variants) {
  await req("/main.html");
  const login = await req("/goform/goform_set_cmd_process", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const loginJson = await login.text();
  const loginfo = await req(
    "/goform/goform_get_cmd_process?isTest=false&cmd=loginfo&multi_data=1"
  ).then((r) => r.text());
  console.log(body.slice(30), "->", loginJson, "| loginfo:", loginfo);
}
