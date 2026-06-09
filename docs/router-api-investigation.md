# Dialog 4G CPE Router — goform API Investigation

**Device:** Dialog 4G CPE at `http://192.168.8.1`  
**Firmware:** `S10_1.23.1` (`CPE_RDA_E-B03P01`, build `2024-04-12_09:07`)  
**Investigated:** 2026-06-07 via Node fetch scripts + `js/service.js` static analysis  
**Login tested:** `user` / password from `ROUTER_PASSWORD` env — **works**

---

## API Overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/goform/goform_get_cmd_process` | GET | Read router state |
| `/goform/goform_set_cmd_process` | POST | Write / actions (login, reboot, config) |

**Common GET params:** `isTest=false&cmd=<command>&multi_data=1` (omit `multi_data` for array/single-value cmds like `station_list`)

**Common POST body:** `application/x-www-form-urlencoded`

**Required headers (mimic web UI):**
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
Accept: application/json, text/javascript, */*; q=0.01
X-Requested-With: XMLHttpRequest
Referer: http://192.168.8.1/main.html
```

---

## Authentication

### Login

**Endpoint:** `POST /goform/goform_set_cmd_process`

**Body:**
```
isTest=false&goformId=LOGIN&username=<base64-user>&password=<base64-password>&CSRFToken=
```
(`username` and `password` are base64-encoded; `CSRFToken` can be empty)

**Example response (tested ✓):**
```json
{"result":"0","power":"3"}
```

**Post-login cookie:** append `pageForward=home` to session cookies (router does not always set this automatically).

**Result codes** (from `service.js` `login` function):
| result | Meaning |
|--------|---------|
| `0`, `4` | Success |
| `1` | Login fail |
| `2` | Duplicate user |
| `3` | Bad password |
| `5` | User does not exist |

### Logout

```
POST isTest=false&goformId=LOGOUT
```

### Public (no-login) access

Traffic stats are readable **without login** (tested ✓):
```
GET /goform/goform_get_cmd_process?isTest=false&cmd=monthly_tx_bytes,monthly_rx_bytes,realtime_tx_thrpt,realtime_rx_thrpt&multi_data=1
```

`station_list` may also return data without auth on some queries.

---

## 1. Per-Device Data Usage

### Verdict: **Router-wide stats only — no per-device byte counters**

Searched `js/service.js` for `station_list`, `rate_limit`, `traffic`, `bandwidth`, `tz_get_flow`, `childGroupList`, and probed 15+ GET commands. **No API returns per-MAC or per-IP upload/download byte totals.**

### Connected devices — `station_list` (tested ✓)

**Endpoint:**
```
GET /goform/goform_get_cmd_process?isTest=false&cmd=station_list
```
(no `multi_data`)

**Example response:**
```json
{
  "station_list": [
    {
      "connect_time": 40,
      "ssid_index": "1",
      "dev_type": "wifi",
      "mac_addr": "AA:BB:CC:DD:EE:FF",
      "hostname": "Example-Laptop",
      "ip_addr": "192.168.8.100",
      "ip_type": "DHCP"
    }
  ]
}
```

**Fields available:** MAC, IP, hostname, connection duration (seconds), WiFi SSID index, device type.  
**Fields NOT available:** tx/rx bytes, bandwidth rate, data quota per device.

### Wired clients — `lan_station_list` (tested ✓, empty)

```
GET /goform/goform_get_cmd_process?isTest=false&cmd=lan_station_list
```
```json
{"lan_station_list": []}
```

### Router-wide traffic (tested ✓)

```
GET ...&cmd=monthly_tx_bytes,monthly_rx_bytes,realtime_tx_thrpt,realtime_rx_thrpt&multi_data=1
```
```json
{
  "monthly_tx_bytes": "97143148",
  "monthly_rx_bytes": "244321597",
  "realtime_tx_thrpt": "13961",
  "realtime_rx_thrpt": "37923"
}
```

| Field | Unit | Notes |
|-------|------|-------|
| `monthly_tx_bytes` / `monthly_rx_bytes` | bytes | Billing-cycle cumulative |
| `realtime_tx_thrpt` / `realtime_rx_thrpt` | **centi-Kbps** (÷100 → Kbps) | Live throughput; e.g. `37923` = 379.23 Kbps |
| `realtime_tx_bytes` / `realtime_rx_bytes` | bytes | Shorter-window counters |
| `realtime_time` | seconds | Window for realtime counters |

### Rate limits (bandwidth caps per IP — NOT usage stats)

**Read:**
```
GET ...&cmd=RateLimitEnable,RateLimitRules_0,RateLimitRules_1,...&multi_data=1
```
```json
{
  "RateLimitEnable": "0",
  "RateLimitRules_0": "192.168.8.123,100,100,limited-N",
  "RateLimitRules_1": "192.168.8.100,1000,1000,",
  "RateLimitRules_2": ""
}
```
Rule format: `ip,download_kbps,upload_kbps,comment`

**Set (add rule):**
```
POST isTest=false&goformId=ADD_RATE_LIMIT
  &ip_address=192.168.8.100
  &download_speed=1000
  &upload_speed=1000
  &comment=mydevice
  &CSRFToken=
```
Dry-run (`isTest=true`) returned `{"result":"success"}` ✓

**Delete:**
```
POST isTest=false&goformId=DEL_RATE_LIMIT&delete_id=0;&CSRFToken=
```

**Enable/disable feature:**
```
POST isTest=false&goformId=ADD_RATE_LIMIT&RateLimitEnable=1&CSRFToken=
```

### Per-device flow (firmware hooks — unstable)

`service.js` defines:
- `getFlow()` → `goformId=tz_get_flow` (SET, no extra params)
- `setCleanFlow()` → `goformId=clean_flow&mac=<MAC>` (reset counters)

**Live test:** `tz_get_flow` caused connection drop / router unreachability. **Not reliably usable** on this device without further investigation. May require specific UI state or return data in a non-JSON format.

### Other device-related reads

| cmd | Result |
|-----|--------|
| `childGroupList` | `{"devices":[]}` — parental/group feature, no traffic |
| `hostNameList` | Historical hostname assignments by MAC |
| `device_traffic_list`, `client_traffic`, `station_traffic` | Empty / not supported |

---

## 2. Router Restart / Reboot

### Verdict: **Supported — `REBOOT_DEVICE`**

**Endpoint:** `POST /goform/goform_set_cmd_process`

**Body:**
```
isTest=false&goformId=REBOOT_DEVICE
```

From `service.js` `restart()` function — only `isTest` and `goformId` are sent.

**⚠️ Warning:** `isTest=true` **does not prevent reboot** on this firmware. A dry-run test triggered an actual reboot (router became unreachable for ~45s). **Never call this in development without expecting downtime.**

### Related power commands (from `service.js`, not live-tested)

| goformId | Function |
|----------|----------|
| `TURN_OFF_DEVICE` | Power off |
| `RESTORE_FACTORY_SETTINGS` | Factory reset |
| `RESULT_RESTORE` | Restore status poll |

---

## 3. Password Change

### Verdict: **Supported — `CHANGE_PASSWORD`**

**Endpoint:** `POST /goform/goform_set_cmd_process`

**Fields** (from `changePassword()` in `service.js`):
| Field | Required | Encoding |
|-------|----------|----------|
| `oldPassword` | Yes | Base64 when `PASSWORD_ENCODE` enabled |
| `newPassword` | Yes | Base64 |
| `newUsername` | Optional | Base64 |

**Example body:**
```
isTest=false&goformId=CHANGE_PASSWORD
  &oldPassword=<b64-old>
  &newPassword=<b64-new>
```

**Success response:** `{"result":"success"}`  
**Failure responses:** `badPassword`, `user_name_already_exist`, or `failure`

**Tested:** Dry-run with wrong field names (`old_password`) → `{"result":"failure"}`. Dry-run with correct names but fake credentials → `{"result":"failure"}`. Endpoint exists and validates; not tested with real password change.

---

## 4. Other Useful Features

### WiFi SSID / settings

**Read (tested ✓):**
```
GET ...&cmd=cr_version,tz_real_version,imei,SSID1,MAX_Access_num,wifi_cur_state,lan_ipaddr,wan_ipaddr&multi_data=1
```
```json
{
  "SSID1": "MyRouter-SSID",
  "MAX_Access_num": "32",
  "wifi_cur_state": "1"
}
```

Guest/multi-SSID read:
```
GET ...&cmd=wifi_coverage,m_ssid_enable,SSID1,SSID2,m_SSID,m_AuthMode,m_HideSSID&multi_data=1
```
```json
{
  "m_ssid_enable": "0",
  "SSID2": "MyRouter-SSID_Guest",
  "m_SSID": "MyRouter-SSID_5G"
}
```

**Set primary SSID:**
```
POST isTest=false&goformId=SET_WIFI_SSID1_SETTINGS
  &ssid=MyNetwork
  &broadcastSsidEnabled=1
  &MAX_Access_num=32
  &security_mode=WPA2PSK
  &cipher=CCMP
  &NoForwarding=0
  &show_qrcode_flag=0
  &WPAPSK1=<password>        # when changing password
```

**Set guest SSID (SSID2):**
```
POST isTest=false&goformId=SET_WIFI_SSID2_SETTINGS
  &m_SSID=GuestNetwork
  &m_HideSSID=0
  &m_MAX_Access_num=32
  &m_AuthMode=WPA2PSK
  &cipher=CCMP
  &m_NoForwarding=0
```

Dry-run with minimal fields returned `failure`; full field set per `service.js` required.

### DHCP / LAN

**Read (tested ✓):**
```
GET ...&cmd=lan_ipaddr,lan_netmask,mac_address,dhcpEnabled,dhcpStart,dhcpEnd,dhcpLease_hour,dhcpDns&multi_data=1
```
```json
{
  "lan_ipaddr": "192.168.8.1",
  "lan_netmask": "255.255.255.0",
  "dhcpEnabled": "1",
  "dhcpStart": "192.168.8.100",
  "dhcpEnd": "192.168.8.200",
  "dhcpLease_hour": "24",
  "dhcpDns": "192.168.8.1"
}
```

**Set:**
```
POST isTest=false&goformId=DHCP_SETTING
  &lanIp=192.168.8.1
  &lanNetmask=255.255.255.0
  &lanDhcpType=SERVER          # or DISABLE
  &dhcpStart=192.168.8.100
  &dhcpEnd=192.168.8.200
  &dhcpDns=192.168.8.1
  &dhcpLease=86400
  &dhcp_reboot_flag=1
  &CSRFToken=
```

### URL filter

**UI hidden** on this firmware (`HIDE_URL_FILTER_*` flags in `service.js`).

**Read (tested ✓, empty):**
```
GET ...&cmd=websURLFilters
GET ...&cmd=websURLFilters_1
GET ...&cmd=websURLFilters_2
```
```json
{"websURLFilters": ""}
```

**Set:** `addUrlFilterRule` / `addUrlFilterRule_1` / `addUrlFilterRule_2` — params passed through from UI layer (not fully enumerated in minified JS). Feature may be disabled at firmware level.

### Port forwarding

**Read (tested ✓):**
```
GET ...&cmd=PortMapEnable,PortMapRules_0,...&multi_data=1
```
```json
{"PortMapEnable": "1", "PortMapRules_0": "", "PortMapRules_1": ""}
```

Also available: `PortForwardEnable`, `PortForwardRules_0..9` via `getPortForward()`.

**Set (add rule):**
```
POST isTest=false&goformId=ADD_PORT_MAP
  &portMapEnabled=1
  &fromPort=8080
  &ip_address=192.168.8.100
  &toPort=80
  &protocol=TCP
  &comment=web
  &CSRFToken=
```
Dry-run returned `{"result":"success"}` ✓

**Delete:** `goformId=DEL_PORT_MAP&delete_id=0;`

### IP/port firewall filter

**Read (tested ✓):**
```
GET ...&cmd=IPPortFilterEnable,DefaultFirewallPolicy,IPPortFilterRules_0&multi_data=1
```
```json
{"IPPortFilterEnable": "0", "DefaultFirewallPolicy": "0"}
```

**Set:** `goformId=ADD_IP_PORT_FILETER` (or `ADD_IP_PORT_FILETER_V4V6` for IPv6)

### DMZ

**Read (tested ✓):**
```
GET ...&cmd=DMZEnable,DMZIPAddress&multi_data=1
```
```json
{"DMZEnable": "0", "DMZIPAddress": ""}
```

**Set:**
```
POST isTest=false&goformId=DMZ_SETTING
  &DMZEnabled=1
  &DMZIPAddress=192.168.8.100
  &CSRFToken=
```

### Guest network

Controlled via `m_ssid_enable` + `SET_WIFI_SSID2_SETTINGS`. Currently `m_ssid_enable=0` (guest disabled). SSID names pre-provisioned (`SSID2`, `m_SSID`).

### SMS

**Read (tested ✓):**
```
GET ...&cmd=sms_data_total          → {"messages":[]}
GET ...&cmd=sms_capacity_info       → capacity counters (all 0 on test SIM)
```

**Send:**
```
POST isTest=false&goformId=SEND_SMS
  &Number=0771234567
  &MessageBody=<encoded>    # use escapeMessage/encodeMessage per firmware
  &sms_time=<timestamp>
  &ID=-1
  &encode_type=GSM7
```

Also: `DELETE_SMS`, `SAVE_SMS`, `ALL_DELETE_SMS`, `SET_MSG_READ`, `SEND_SMS_ID`

Dry-run returned `failure` (likely needs properly encoded `MessageBody`).

### Firmware update status

**Read (tested):**
| cmd | Response |
|-----|----------|
| `tz_upgrade_state` | `"none"` ✓ |
| `fota_current_upgrade_state` | `""` (empty) |
| `fota_new_version_state` | `""` (empty) |
| `update_info` | `""` (empty) |
| `upgrade_result` | `""` (empty) |

**Actions:**
```
POST isTest=false&goformId=IF_UPGRADE&select_op=check&ota_manual_check_roam_state=1
POST isTest=false&goformId=TZ_START_SYSTEM_UPGRADE
```

No update in progress on test device; check endpoint exists but returned `failure` on dry-run.

### MAC filter (tested ✓ in existing app)

**Read:**
```
GET ...&cmd=ACL_mode,wifi_mac_white_list,wifi_mac_black_list&multi_data=1
```
```json
{
  "ACL_mode": "1",
  "wifi_mac_white_list": "AA:BB:CC:DD:EE:FF",
  "wifi_mac_black_list": ""
}
```

**Set:** `goformId=WIFI_MAC_FILTER` with `ACL_mode` (0=off, 1=whitelist, 2=blacklist) and MAC lists.

### Signal / cell info

```
GET ...&cmd=network_type,rsrp,rsrq,sinr,band&multi_data=1
```
```json
{"network_type":"LTE","rsrp":"","rsrq":"","sinr":"","band":""}
```
LTE type returned; signal metrics empty (may need separate unauthenticated query per `router-client.ts`).

---

## 5. Realtime Throughput Polling

**Units:** `realtime_tx_thrpt` and `realtime_rx_thrpt` are **centi-Kbps** (hundredths of a Kbps), not plain Kbps. Divide the raw value by 100 before displaying as Kbps or Mbps (e.g. `13961` → 139.61 Kbps ≈ 0.14 Mbps).

**Command:**
```
GET /goform/goform_get_cmd_process?isTest=false&cmd=realtime_tx_thrpt,realtime_rx_thrpt&multi_data=1
```

**Load test results** (8 requests per interval, logged-in session):

| Interval | Errors | Avg latency | Max latency |
|----------|--------|-------------|-------------|
| 250 ms | 0 | 46 ms | 144 ms |
| 500 ms | 0 | 110 ms | 252 ms |
| 1000 ms | 0 | 166 ms | 386 ms |
| 2000 ms | 0 | 109 ms | 289 ms |
| 3000 ms | 0 | 115 ms | 215 ms |

### Recommendation

- **Fastest safe interval: 500 ms** (250 ms worked but avg latency ≈ interval, leaving little headroom)
- **Production default: 1000 ms** — comfortable margin, ~166 ms avg response
- **Avoid < 250 ms** — risks saturating the router's single-threaded HTTP server
- Works without login for read-only dashboard use

---

## Complete goformId Inventory (112 from `service.js`)

<details>
<summary>All discovered goformId values</summary>

```
ACL_SETTING, ADD_IP_PORT_FILETER, ADD_IP_PORT_FILETER_V4V6, ADD_PORT_MAP,
ADD_RATE_LIMIT, ALL_DELETE_SMS, APN2_PROC_EX, APN3_PROC_EX, APN_PROC, APN_PROC_EX,
BASIC_SETTING, CHANGE_MODE, CHANGE_PASSWORD, CONNECT_NETWORK, DATA_LIMIT_SETTING,
DELETE_SMS, DEL_IP_PORT_FILETER, DEL_IP_PORT_FILETER_V4V6, DEL_PORT_MAP,
DEL_RATE_LIMIT, DHCP_SETTING, DHCP_SETTING1, DHCP_SETTING2, DIGITMAP_SETTINGS,
DISABLE_PIN, DISCONNECT_NETWORK, DMZ_SETTING, EDIT_HOSTNAME, ENABLE_PIN,
ENABLE_WPS_SET, ENTER_PIN, ENTER_PUK, FLOW_CALIBRATION_MANUAL, FLOW_SWITCH,
FW_FORWARD_ADD, FW_FORWARD_DEL, GET_STATUS_ROUTE, GOFORM_HTTPSHARE_CHECK_FILE,
GRE_SETTING, HOTLINE_SETTINGS, HTTPS_PORT_SETTINGS, HTTPS_SWITCH_PORT_SETTINGS,
IF_UPGRADE, L2TP_SETTING, LOCK_FREQUENCY, LOGIN, LOGOUT,
MGMT_CONTROL_POWER_ON_SPEED, MONITOR_GETTINGS, MONITOR_SETTINGS, NAT_SETTING,
PBM_CONTACT_ADD, PBM_CONTACT_DEL, POLARITY_REVERSAL, PORT_SETTINGS, PPPOE_SETTING,
QUICK_SETUP, QUICK_SETUP_EX, REBOOT_DEVICE, RESTORE_FACTORY_SETTINGS, RESULT_RESTORE,
SAVE_SMS, SAVE_TSW, SCAN_NETWORK, SEND_SMS, SEND_SMS_ID, SET_BEARER_PREFERENCE,
SET_HOTSPOTSERVER, SET_MESSAGE_CENTER, SET_MSG_READ, SET_MTU, SET_NETWORK,
SET_STATUS_ROUTE, SET_UART_BAUDRATE, SET_USB_MODE, SET_W13_WLAN, SET_WEB_LANGUAGE,
SET_WIFI_COVERAGE, SET_WIFI_INFO, SET_WIFI_INFO2, SET_WIFI_SLEEP_INFO,
SET_WIFI_SSID1_SETTINGS, SET_WIFI_SSID2_SETTINGS, SET_WIFI_SSID3_SETTINGS,
SET_WIFI_SSID4_SETTINGS, SET_WIFI_SSID5_SETTINGS, SIP_SERVER_SETTING, STATIC_IP,
TURN_OFF_DEVICE, TZ_CMD_SECURE_LOGIN, TZ_ENTER_PUK, TZ_GET_LOCK_BAND,
TZ_GET_LOCK_PLMN, TZ_PIN_WSC_CONFIGURED, TZ_POST_ROUTE, TZ_SET_LOCK_BAND,
TZ_SET_LOCK_PLMN, TZ_SET_UNLOCK_CODE, TZ_SET_USB_STATUS, TZ_SET_WPS_PIN_CONFIG,
TZ_START_CONFIG_UPDATE, TZ_START_SYSTEM_UPGRADE, TZ_UNLOCK_PLMN, UNLOCK_NETWORK,
UNLOCK_PLMN_PSK, UPNP_SETTING, USSD_PROCESS, VIRTUAL_SERVER, VOLTE_APN, WB_MODE,
WIFI_MAC_FILTER, WIFI_WPS_SET
```

</details>

---

## Feasibility Summary

| Feature | Feasible? | Notes |
|---------|-----------|-------|
| **Per-device bandwidth/bytes** | ❌ No | `station_list` has MAC/IP/hostname only; no per-client counters |
| **Per-device rate limiting** | ✅ Yes | `ADD_RATE_LIMIT` by IP — caps, not monitoring |
| **Router-wide traffic** | ✅ Yes | `monthly_*_bytes`, `realtime_*_thrpt`; public read OK |
| **Connected device list** | ✅ Yes | `station_list` + `lan_station_list` |
| **Reboot** | ✅ Yes | `REBOOT_DEVICE` — **causes real reboot even with isTest** |
| **Password change** | ✅ Yes | `CHANGE_PASSWORD` with `oldPassword`/`newPassword` (base64) |
| **WiFi SSID change** | ✅ Yes | `SET_WIFI_SSID1_SETTINGS` (+ SSID2–5 for guest/multi) |
| **DHCP settings** | ✅ Yes | `DHCP_SETTING` read/write |
| **URL filter** | ⚠️ Hidden | API exists (`websURLFilters`) but UI disabled; rules empty |
| **Port forwarding** | ✅ Yes | `ADD_PORT_MAP` / `PortMapRules_*` |
| **DMZ** | ✅ Yes | `DMZ_SETTING` read/write |
| **Guest network** | ✅ Yes | `SET_WIFI_SSID2_SETTINGS`, `m_ssid_enable` |
| **SMS** | ⚠️ Partial | Read works; send needs encoded `MessageBody` |
| **Firmware status** | ⚠️ Partial | `tz_upgrade_state` works; FOTA fields empty (no update pending) |
| **MAC filter** | ✅ Yes | Already used in `router-client.ts` |
| **Realtime polling** | ✅ Yes | Safe at **500–1000 ms** intervals |

### Best candidates for `browser-control` dashboard

1. Router-wide live speed — `realtime_tx_thrpt` / `realtime_rx_thrpt` @ 1 Hz
2. Monthly data usage + limit — `monthly_tx_bytes`, `monthly_rx_bytes`, `data_volume_limit_*`
3. Connected devices — `station_list` (MAC, IP, hostname, uptime)
4. MAC whitelist/blacklist — `WIFI_MAC_FILTER`
5. Router info — firmware, IMEI, SSID, signal type

### Not feasible without firmware changes

- Per-device data consumption graphs
- Per-device realtime throughput
- Reliable `tz_get_flow` per-client stats (unstable on live test)

---

## Test Artifacts

- `scripts/service.js.dump` — full router JS (146 KB)
- `scripts/service-js-parsed.json` — extracted goformIds and cmd refs
- `scripts/investigate-safe-output.json` — live GET/SET/polling results
- `scripts/investigate-router-api.mjs` — investigation runner
