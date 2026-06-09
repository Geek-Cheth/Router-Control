import { cp, rm } from "fs/promises";
import { join } from "path";

/** electron-builder strips node_modules from extraResources — restore full standalone after pack */
export default async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const src = join(projectDir, "electron-resources", "standalone");
  const dest = join(context.appOutDir, "resources", "standalone");

  await rm(dest, { recursive: true, force: true });
  await cp(src, dest, { recursive: true, force: true, dereference: true });
  console.log("afterPack: copied standalone with node_modules →", dest);
}
