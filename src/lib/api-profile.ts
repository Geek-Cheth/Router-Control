import { getProfileById, loadProfilesConfig } from "@/lib/app-config";
import { setDbProfile } from "@/lib/db/profile-context";
import { resolveProfileIdFromRequest } from "@/lib/profiles";
import { getRouterClient } from "@/lib/router-client";

export function prepareProfileRequest(request: Request) {
  const config = loadProfilesConfig();
  const profileId = resolveProfileIdFromRequest(request, config);
  const profile = getProfileById(profileId);
  setDbProfile(profileId);
  const client = getRouterClient(profile);
  return { profileId, profile, client };
}
