import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");

await mkdir(output, { recursive: true });
for (const item of ["index.html", "css", "js", "assets"]) {
  await cp(path.join(root, item), path.join(output, item), { recursive: true });
}

console.log("배포 파일 생성 완료: dist/ (index.html, css/, js/, assets/)");
