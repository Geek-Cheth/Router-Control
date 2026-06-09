import { encodeLoginField, getRouterUsername, requireRouterPassword } from "./lib/credentials.mjs";

const base = "http://192.168.8.1";

async function main() {
  const html = await fetch(`${base}/main.html`).then((r) => r.text());
  const inputs = [...html.matchAll(/<input[^>]+>/gi)].map((m) => m[0]);
  console.log("Inputs:", inputs.slice(0, 20));

  const scripts = [...html.matchAll(/src="([^"]+)"/gi)].map((m) => m[1]);
  console.log("Scripts:", scripts);

  // Check login page
  const loginHtml = await fetch(`${base}/html/login.html`).then((r) => r.text()).catch(() => "");
  if (loginHtml) {
    console.log("Login HTML snippet:", loginHtml.slice(0, 1500));
  }

  // Try login with password base64
  const cookies = [];
  async function req(url, init = {}) {
    const res = await fetch(url, {
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
    return res;
  }

  const password = requireRouterPassword();
  const username = getRouterUsername();
  const userB64 = encodeLoginField(username);
  const pwdB64 = encodeLoginField(password);
  for (const body of [
    `isTest=false&goformId=LOGIN&Username=${userB64}&Password=${password}`,
    `isTest=false&goformId=LOGIN&Username=${userB64}&Password=${pwdB64}`,
    `isTest=false&goformId=LOGIN&Username=${username}&Password=${password}`,
  ]) {
    cookies.length = 0;
    await req(`${base}/main.html`);
    const login = await req(`${base}/goform/goform_set_cmd_process`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    cookies.push("pageForward=home");
    const loginfo = await req(
      `${base}/goform/goform_get_cmd_process?isTest=false&cmd=loginfo&multi_data=1`
    ).then((r) => r.text());
    console.log(`Body [${body.slice(40, 80)}...] login:`, await login.text(), "loginfo:", loginfo);
  }
}

main().catch(console.error);
