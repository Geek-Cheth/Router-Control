import type { MacFilterState } from "./router-types";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatSpeed(kbps: number): string {
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
  if (kbps >= 100) return `${(kbps / 1000).toFixed(2)} Mbps`;
  return `${Math.round(kbps)} Kbps`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDays(days: number | null): string {
  if (days == null) return "—";
  if (days < 1) return "< 1 day";
  if (days < 2) return "1 day";
  return `${Math.round(days)} days`;
}

export function formatDateLabel(dateKey: string): string {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function parseDataLimit(raw: string): number {
  // Format: "80_1024" means 80 GB (value_unit where unit 1024 = GB)
  const [value] = raw.split("_");
  return parseInt(value, 10) || 0;
}

export function parseMacList(raw: string | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw.split(";").filter(Boolean);
}

export function macFilterModeFromCode(code: string): MacFilterState["mode"] {
  switch (code) {
    case "1":
      return "whitelist";
    case "2":
      return "blacklist";
    default:
      return "disabled";
  }
}
