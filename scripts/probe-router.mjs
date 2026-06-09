const base = "http://192.168.8.1";

async function main() {
  const html = await fetch(`${base}/main.html`).then((r) => r.text());
  console.log("HTML length:", html.length);

  const tokenMatches = html.match(/CSRFToken[^<\n]{0,100}/gi);
  console.log("CSRF matches:", tokenMatches?.slice(0, 5));

  const stokMatches = html.match(/stok[=:][^"'\s&]{0,60}/gi);
  console.log("stok matches:", stokMatches?.slice(0, 5));

  // Fetch service.js for API patterns
  const svc = await fetch(`${base}/js/service.js`).then((r) => r.text()).catch(() => "");
  if (svc) {
    const station = svc.match(/station_list[^]{0,200}/);
    console.log("station_list context:", station?.[0]?.slice(0, 200));
    const login = svc.match(/LOGIN[^]{0,300}/);
    console.log("LOGIN context:", login?.[0]?.slice(0, 300));
  }

  // Try index_status commands (public dashboard)
  const pubCmds = [
    "monthly_tx_bytes,monthly_rx_bytes",
    "realtime_tx_bytes,realtime_rx_bytes",
    "traffic_alter_switch,traffic_alter_size",
    "data_volume_limit_switch,data_volume_limit_size",
    "cr_version,tz_real_version,imei",
    "network_type,rsrp,rsrq,sinr,band",
    "wifi_connected_num,SSID1",
  ];
  for (const cmd of pubCmds) {
    const res = await fetch(
      `${base}/goform/goform_get_cmd_process?isTest=false&cmd=${cmd}&multi_data=1`,
      { headers: { Referer: `${base}/index.html`, "X-Requested-With": "XMLHttpRequest" } }
    ).then((r) => r.text());
    const hasData = res.replace(/""/g, "").length > 20;
    if (hasData) console.log(`CMD [${cmd}]:`, res);
  }

  // Single commands without multi_data
  for (const cmd of ["station_list", "lan_station_list", "wifi_black_list"]) {
    const res = await fetch(
      `${base}/goform/goform_get_cmd_process?isTest=false&cmd=${cmd}`,
      { headers: { Referer: `${base}/main.html`, "X-Requested-With": "XMLHttpRequest" } }
    ).then((r) => r.text());
    console.log(`SINGLE [${cmd}]:`, res);
  }
}

main().catch(console.error);
