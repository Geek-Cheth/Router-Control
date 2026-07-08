let currentProfileId = "dialog";

export function setDbProfile(profileId: string): void {
  currentProfileId = profileId;
}

export function getDbProfile(): string {
  return currentProfileId;
}
