import { cp, access, rm, mkdir } from "fs/promises";
import { join, basename } from "path";
import { constants } from "fs";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");
const staticSrc = join(root, ".next", "static");
const staticDest = join(standaloneDir, ".next", "static");
const publicSrc = join(root, "public");
const publicDest = join(standaloneDir, "public");
const electronResourcesDir = join(root, "electron-resources", "standalone");

const SKIP_TOP_LEVEL = new Set([
  "electron",
  "release",
  "dist-electron",
  "data",
  "scripts",
  "src",
  ".git",
]);

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function shouldCopy(src, dest) {
  const rel = src.slice(standaloneDir.length + 1);
  if (!rel) return true;
  const top = rel.split(/[/\\]/)[0];
  if (SKIP_TOP_LEVEL.has(top)) return false;
  if (basename(src) === ".env.local") return false;
  return true;
}

async function main() {
  if (!(await exists(standaloneDir))) {
    console.error(
      "Missing .next/standalone — run `npm run build` first (requires output: standalone in next.config.ts)."
    );
    process.exit(1);
  }

  if (!(await exists(staticSrc))) {
    console.error("Missing .next/static — run `npm run build` first.");
    process.exit(1);
  }

  await cp(staticSrc, staticDest, { recursive: true, force: true });
  console.log("Copied .next/static → .next/standalone/.next/static");

  if (await exists(publicSrc)) {
    await cp(publicSrc, publicDest, { recursive: true, force: true });
    console.log("Copied public/ → .next/standalone/public/");
  }

  if (!(await exists(join(standaloneDir, "node_modules", "next")))) {
    console.error("Missing .next/standalone/node_modules/next — standalone build incomplete.");
    process.exit(1);
  }

  await rm(join(root, "electron-resources"), { recursive: true, force: true });
  await mkdir(electronResourcesDir, { recursive: true });

  await cp(standaloneDir, electronResourcesDir, {
    recursive: true,
    force: true,
    dereference: true,
    filter: shouldCopy,
  });

  console.log(`Copied standalone → electron-resources/standalone (includes node_modules)`);
  console.log("Standalone bundle ready for Electron packaging.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
