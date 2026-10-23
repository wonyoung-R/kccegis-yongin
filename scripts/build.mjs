import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");

await mkdir(output, { recursive: true });
for (const item of [
  "index.html",
  "css",
  "js",
  "assets",
  "robots.txt",
  "sitemap.xml",
]) {
  await cp(path.join(root, item), path.join(output, item), { recursive: true });
}

// The uploaded source has a messenger prefix; Naver requests the original name.
const naverVerification = "naver642ed06d90b7da59307c08a1040e9ca8.html";
await cp(
  path.join(root, `TalkFile_${naverVerification}`),
  path.join(output, naverVerification),
);

console.log(
  "배포 파일 생성 완료: dist/ (index.html, css/, js/, assets/, robots.txt, sitemap.xml, 네이버 소유확인 파일)",
);
