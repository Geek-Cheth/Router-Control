export type RouterProfileType = "dialog" | "huawei";

export interface RouterProfile {
  id: string;
  name: string;
  type: RouterProfileType;
  routerUrl: string;
  routerUsername: string;
  routerPassword: string;
}

export interface ProfilesConfig {
  activeProfileId: string;
  profiles: RouterProfile[];
}

export const PROFILE_STORAGE_KEY = "router-control-profile";

export const DEFAULT_PROFILES: RouterProfile[] = [
  {
    id: "dialog",
    name: "Dialog CPE",
    type: "dialog",
    routerUrl: "http://192.168.8.1",
    routerUsername: "user",
    routerPassword: "",
  },
  {
    id: "b310",
    name: "B310",
    type: "huawei",
    routerUrl: "http://192.168.8.1",
    routerUsername: "user",
    routerPassword: "yi5hfGe1",
  },
];

export function getProfileHost(profile: RouterProfile): string {
  try {
    return new URL(profile.routerUrl).host;
  } catch {
    return profile.routerUrl.replace(/^https?:\/\//, "");
  }
}

export function findProfile(
  config: ProfilesConfig,
  profileId: string | null | undefined
): RouterProfile | undefined {
  if (!profileId) return undefined;
  return config.profiles.find((p) => p.id === profileId);
}

export function getActiveProfile(config: ProfilesConfig): RouterProfile {
  return (
    findProfile(config, config.activeProfileId) ??
    config.profiles[0] ??
    DEFAULT_PROFILES[0]
  );
}

export function sanitizeProfilesConfig(raw: Partial<ProfilesConfig>): ProfilesConfig {
  const profiles =
    Array.isArray(raw.profiles) && raw.profiles.length > 0
      ? raw.profiles.map((p) => ({
          id: p.id ?? "dialog",
          name: p.name ?? p.id ?? "Router",
          type: (p.type === "huawei" ? "huawei" : "dialog") as RouterProfileType,
          routerUrl: p.routerUrl ?? "http://192.168.8.1",
          routerUsername: p.routerUsername ?? "user",
          routerPassword: p.routerPassword ?? "",
        }))
      : DEFAULT_PROFILES;

  const activeProfileId =
    raw.activeProfileId && profiles.some((p) => p.id === raw.activeProfileId)
      ? raw.activeProfileId
      : profiles[0].id;

  return { activeProfileId, profiles };
}

export function migrateLegacyConfig(raw: Record<string, unknown>): ProfilesConfig {
  if (Array.isArray(raw.profiles) && raw.profiles.length > 0) {
    return sanitizeProfilesConfig(raw as Partial<ProfilesConfig>);
  }

  const legacyPassword =
    typeof raw.routerPassword === "string" ? raw.routerPassword : "";
  const legacyUrl =
    typeof raw.routerUrl === "string" ? raw.routerUrl : "http://192.168.8.1";
  const legacyUser =
    typeof raw.routerUsername === "string" ? raw.routerUsername : "user";

  const profiles = DEFAULT_PROFILES.map((profile) =>
    profile.id === "dialog"
      ? {
          ...profile,
          routerUrl: legacyUrl,
          routerUsername: legacyUser,
          routerPassword: legacyPassword || profile.routerPassword,
        }
      : profile
  );

  return sanitizeProfilesConfig({
    activeProfileId:
      typeof raw.activeProfileId === "string" ? raw.activeProfileId : "dialog",
    profiles,
  });
}

export function applyDialogEnvToProfile(profile: RouterProfile): RouterProfile {
  if (profile.id !== "dialog") return profile;
  return {
    ...profile,
    routerUrl: process.env.ROUTER_URL ?? profile.routerUrl,
    routerUsername: process.env.ROUTER_USERNAME ?? profile.routerUsername,
    routerPassword: process.env.ROUTER_PASSWORD || profile.routerPassword,
  };
}

export function profileQuery(profileId: string) {
  return `profile=${encodeURIComponent(profileId)}`;
}

export function resolveProfileIdFromRequest(
  request: Request,
  config: ProfilesConfig
): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("profile");
  if (fromQuery && findProfile(config, fromQuery)) return fromQuery;
  return getActiveProfile(config).id;
}
