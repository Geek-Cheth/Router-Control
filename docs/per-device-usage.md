# Per-Device Data Usage — Investigation

Dialog 4G CPE (`192.168.8.1`, TZTEK/Huawei-style firmware).

## Verdict

**Native per-device byte counters are NOT available on this firmware.**

`station_list` is the only reliable per-device endpoint. It returns identity and session metadata only — no TX/RX bytes, no throughput per client.

## What `station_list` provides

```json
{
  "station_list": [{
    "connect_time": 95,
    "ssid_index": "1",
    "dev_type": "wifi",
    "mac_addr": "AA:BB:CC:DD:EE:FF",
    "hostname": "Example-Laptop",
    "ip_addr": "192.168.8.100",
    "ip_type": "DHCP"
  }]
}
```

**Fields:** `connect_time`, `ssid_index`, `dev_type`, `mac_addr`, `hostname`, `ip_addr`, `ip_type`

**Missing:** bytes used, download/upload totals, current speed per device

## Commands tested (all empty or router-level only)

| Command | Result |
|---------|--------|
| `device_traffic_list` | Empty |
| `client_traffic` | Empty |
| `station_traffic` | Empty |
| `traffic_statistics` | Empty |
| `flow_list`, `tz_flow_list` | Empty |
| `station_flow`, `mac_flow`, `device_flow` | Empty |
| `wifi_station_list` | Empty |
| `station_rate_limit`, `rate_limit` | Empty |
| `RateLimitEnable,RateLimitRules_*` | Empty |
| `goformId=tz_get_flow` (POST) | `"result": "failure"` |

Router-level commands that **do** work: `monthly_tx_bytes`, `monthly_rx_bytes`, `realtime_tx_thrpt`, `realtime_rx_thrpt` (aggregate only).

## Rate limiting vs usage

`ADD_RATE_LIMIT` sets **speed caps by IP address** — it does not report how much data each device consumed. The `#rate_limit` UI page toggles limits; no per-device usage graph exists in the admin UI either.

## Recommended approach

### Option A: Local estimation via SQLite (recommended)

Since the router exposes aggregate `realtime_*_thrpt` and `monthly_*_bytes` only:

1. **Device registry** — upsert MACs from `station_list` on each dashboard poll (`devices` table).
2. **Usage snapshots** — every 15 min, store router totals + JSON snapshot of connected devices (`usage_snapshots` table).
3. **Attribution heuristic** (optional, approximate):
   - When only one device is connected, attribute delta in `monthly_tx/rx_bytes` to that device.
   - When multiple devices connected, show “shared pool” only; optionally split by equal share or by live speed ratio at snapshot time (clearly label as estimated).
4. **History charts** — plot router totals over time; show “who was online” alongside from `devices_json`.

### Option B: IP-based rate limits (control, not monitoring)

Use `ADD_RATE_LIMIT` to cap a device’s bandwidth by IP — useful for parental control, not usage reporting.

### Option C: External monitoring (not recommended)

Packet capture on LAN would work but is out of scope for this app.

## UI recommendation

- **Now:** Show per-device connection info (hostname, IP, MAC, uptime) — already implemented.
- **Next:** “Usage history” tab with router-level charts from SQLite snapshots.
- **Later:** “Estimated share” badge per device when single-client or heuristic applies — with disclaimer.

## Implementation hooks

```
GET /api/router/dashboard  → upsert devices, maybe snapshot
SQLite devices             → first_seen, last_seen, hostname, last_ip
SQLite usage_snapshots     → monthly_tx/rx + devices_json
```

Do **not** expect firmware update to add per-MAC counters unless Dialog/ZTE enables hidden commands (`clean_flow` suggests internal flow tracking exists but is not exposed via GET).
