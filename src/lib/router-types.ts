export interface ConnectedDevice {
  hostname: string;
  ip_addr: string;
  mac_addr: string;
  connect_time: number;
  ssid_index?: string;
  dev_type?: string;
  ip_type?: string;
}

export interface TrafficStats {
  monthlyTxBytes: number;
  monthlyRxBytes: number;
  totalBytes: number;
  dataLimitSwitch: boolean;
  dataLimitGB: number;
  usagePercent: number;
}

export interface LiveSpeed {
  realtimeTxKbps: number;
  realtimeRxKbps: number;
}

export interface MacFilterState {
  mode: "disabled" | "whitelist" | "blacklist";
  modeCode: string;
  whiteList: string[];
  blackList: string[];
}

export interface RouterInfo {
  firmware: string;
  hardware: string;
  imei: string;
  ssid: string;
  maxClients: number;
  wifiState: boolean;
  lanIp: string;
  wanIp: string;
}

export interface SignalInfo {
  rsrp: string;
  rsrq: string;
  sinr: string;
  networkType: string;
  band: string;
}

export interface DashboardData {
  info: RouterInfo;
  traffic: TrafficStats;
  devices: ConnectedDevice[];
  macFilter: MacFilterState;
  signal: SignalInfo;
  connected: boolean;
  storedUsage?: {
    yearMonth: string;
    txBytes: number;
    rxBytes: number;
    totalBytes: number;
  };
  purchaseStatus?: PurchaseStatus | null;
}

export interface PurchaseStatus {
  id: number;
  amountGb: number;
  startAt: number;
  expiresAt: number;
  alertPercent: number;
  usedBytes: number;
  remainingBytes: number;
  usagePercent: number;
  isDepleted: boolean;
}

export interface DataPurchase {
  id: number;
  amountGb: number;
  purchasedAt: number;
  startAt: number;
  expiresAt: number;
  notes: string | null;
  usedBytes: number;
  remainingBytes: number;
  wastedBytes: number | null;
  alertPercent: number;
  status: "scheduled" | "active" | "depleted" | "expired";
}

export interface DailyUsageRow {
  date: string;
  txBytes: number;
  rxBytes: number;
  totalBytes: number;
}

export type PlanLimitingFactor =
  | "burn_rate"
  | "expiry"
  | "already_depleted"
  | "insufficient_data";

export interface PlanPrediction {
  averageDailyBytes: number;
  daysUntilDepletion: number | null;
  daysUntilExpiry: number | null;
  estimatedDepletionAt: number | null;
  limitingFactor: PlanLimitingFactor;
  sampleDays: number;
}

export interface UsageAnalytics {
  daily: DailyUsageRow[];
  averageDailyBytes: number;
  sampleDays: number;
  prediction: PlanPrediction | null;
}
