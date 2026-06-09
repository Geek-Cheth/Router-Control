import { cp, access } from "fs/promises";
import { join } from "path";
import { constants } from "fs";
import { mkdir } from "fs/promises";

const root = process.cwd();
const iconSrc = join(root, "resources", "icon.png");
const iconDest = join(root, "dist-electron", "icon.png");

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(join(root, "dist-electron"), { recursive: true });
  if (await exists(iconSrc)) {
    await cp(iconSrc, iconDest, { force: true });
    console.log("Copied icon.png → dist-electron/");
  } else {
    console.log("No resources/icon.png — skipping icon copy.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
