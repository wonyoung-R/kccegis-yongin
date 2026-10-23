import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const html = await readFile(path.join(root, "index.html"), "utf8");
const css = await readFile(path.join(root, "css/style.css"), "utf8");

assert(!html.includes("base64,"), "HTML에 인라인 미디어가 남아 있습니다.");
assert(!css.includes("base64,"), "CSS에 인라인 글꼴이 남아 있습니다.");

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "중복된 HTML id가 있습니다.");

const resources = new Set();
async function checkResource(ref, base) {
  assert(!/^(?:[a-z]+:|\/)/i.test(ref), `상대 경로가 아닌 리소스: ${ref}`);
  const resolved = path.resolve(base, ref.split(/[?#]/)[0]);
  const relative = path.relative(root, resolved);
  assert(
    !relative.startsWith("..") && !path.isAbsolute(relative),
    `프로젝트 밖 참조: ${ref}`,
  );
  const info = await stat(resolved);
  assert(info.isFile() && info.size > 0, `비어 있거나 잘못된 리소스: ${ref}`);
  resources.add(relative);
}

for (const match of html.matchAll(/\b(?:src|poster)="([^"]+)"/g)) {
  await checkResource(match[1], root);
}
const canonicalLinks = [];
for (const match of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)) {
  if (/\brel="canonical"/.test(match[0])) {
    canonicalLinks.push(match[1]);
    continue;
  }
  await checkResource(match[1], root);
}
for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
  await checkResource(match[1], path.join(root, "css"));
}

const metadata = new Map(
  [
    ...html.matchAll(
      /<meta\b[^>]*(?:property|name)="([^"]+)"[^>]*content="([^"]*)"[^>]*>/g,
    ),
  ].map((match) => [match[1], match[2]]),
);
const siteUrl = new URL(metadata.get("og:url"));
assert.equal(siteUrl.protocol, "https:", "대표 주소는 HTTPS여야 합니다.");
assert.deepEqual(
  canonicalLinks,
  [siteUrl.href],
  "canonical은 대표 주소와 일치하는 하나여야 합니다.",
);
const titles = [...html.matchAll(/<title>([^<]+)<\/title>/g)];
assert.equal(titles.length, 1, "검색 제목은 하나여야 합니다.");
for (const key of ["og:title", "twitter:title"]) {
  assert.equal(
    metadata.get(key),
    titles[0][1],
    `${key}가 검색 제목과 다릅니다.`,
  );
}
assert(metadata.get("description"), "검색 설명이 없습니다.");
for (const key of ["og:description", "twitter:description"]) {
  assert.equal(
    metadata.get(key),
    metadata.get("description"),
    `${key}가 검색 설명과 다릅니다.`,
  );
}
assert(
  /\bindex\b/.test(metadata.get("robots")),
  "검색 색인 허용 설정이 없습니다.",
);
const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
assert.equal(headings.length, 1, "H1은 하나여야 합니다.");
assert(
  headings[0][1].includes("KCC 이지스 주니어 용인점"),
  "H1에 센터명이 없습니다.",
);
const structuredData = [
  ...html.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  ),
].map((match) => JSON.parse(match[1]));
assert.equal(structuredData.length, 1, "구조화 데이터 블록이 없습니다.");
const graph = structuredData[0]["@graph"];
assert.equal(structuredData[0]["@context"], "https://schema.org");
for (const type of ["WebSite", "WebPage", "SportsActivityLocation"]) {
  const entity = graph.find((node) => [node["@type"]].flat().includes(type));
  assert(entity, `${type} 구조화 데이터가 없습니다.`);
  assert.equal(entity.url, siteUrl.href, `${type} 대표 주소가 다릅니다.`);
}
const center = graph.find((node) =>
  [node["@type"]].flat().includes("SportsActivityLocation"),
);
assert.equal(center.telephone, "+82-10-4915-9549");
assert.equal(center.address.streetAddress, "동백죽전대로527번길 98-40 A동");
assert.equal(center.address.addressLocality, "용인시 기흥구");
for (const field of ["image", "logo"]) {
  const url = new URL(center[field]);
  assert.equal(url.origin, siteUrl.origin);
  await checkResource(decodeURIComponent(url.pathname).slice(1), root);
}
const robots = await readFile(path.join(root, "robots.txt"), "utf8");
assert(
  /^User-agent:\s*\*\s*$/m.test(robots) && /^Allow:\s*\/\s*$/m.test(robots),
  "검색 수집 허용 설정을 확인하세요.",
);
assert(
  robots.includes(`Sitemap: ${siteUrl.origin}/sitemap.xml`),
  "사이트맵 주소가 다릅니다.",
);
const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
assert.deepEqual(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]),
  [siteUrl.href],
  "사이트맵에는 실제 페이지의 대표 주소만 넣어야 합니다.",
);
const shareImageUrl = new URL(metadata.get("og:image"));
assert.equal(
  shareImageUrl.protocol,
  "https:",
  "SNS 이미지는 HTTPS 절대 주소여야 합니다.",
);
assert.equal(
  shareImageUrl.origin,
  siteUrl.origin,
  "SNS 이미지와 홈페이지 도메인이 다릅니다.",
);
assert.equal(
  metadata.get("twitter:image"),
  shareImageUrl.href,
  "SNS 공유 이미지가 일치하지 않습니다.",
);
const shareImagePath = decodeURIComponent(shareImageUrl.pathname).slice(1);
await checkResource(shareImagePath, root);
const shareImage = await readFile(path.join(root, shareImagePath));
assert.equal(
  shareImage.subarray(0, 8).toString("hex"),
  "89504e470d0a1a0a",
  "SNS 이미지가 PNG가 아닙니다.",
);
assert.equal(
  shareImage.readUInt32BE(16),
  Number(metadata.get("og:image:width")),
  "SNS 이미지 너비가 메타데이터와 다릅니다.",
);
assert.equal(
  shareImage.readUInt32BE(20),
  Number(metadata.get("og:image:height")),
  "SNS 이미지 높이가 메타데이터와 다릅니다.",
);

const allowedExternalLinks = new Set([
  "https://www.instagram.com/kccegis_junior_yongin/",
  "https://blog.naver.com/kcc_junior_yongin",
  "https://map.naver.com/p/search/KCC%EC%9D%B4%EC%A7%80%EC%8A%A4%EC%A3%BC%EB%8B%88%EC%96%B4%20%EC%9A%A9%EC%9D%B8%EC%A0%90",
]);
let phoneLinks = 0;
const externalLinks = new Set();
for (const match of html.matchAll(/<a\b[^>]*>/g)) {
  const tag = match[0];
  const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
  if (!href) continue;
  if (href.startsWith("#")) {
    assert(ids.includes(href.slice(1)), `없는 섹션을 가리키는 링크: ${href}`);
  } else if (allowedExternalLinks.has(href)) {
    assert(/\btarget="_blank"/.test(tag), `새 창 설정 누락: ${href}`);
    const rel = /\brel="([^"]+)"/.exec(tag)?.[1].split(/\s+/) ?? [];
    assert(
      rel.includes("noopener") && rel.includes("noreferrer"),
      `외부 링크 rel 설정 누락: ${href}`,
    );
    externalLinks.add(href);
  } else {
    assert.equal(
      href,
      "tel:01049159549",
      `예상하지 못한 외부 이동 링크: ${href}`,
    );
    phoneLinks += 1;
  }
}
assert(phoneLinks > 0, "전화 문의 링크가 없습니다.");
assert.equal(
  externalLinks.size,
  allowedExternalLinks.size,
  "요청된 SNS 또는 지도 링크가 없습니다.",
);
console.log(
  `검증 통과: 리소스 ${resources.size}개, 내부 이동, 전화 링크 ${phoneLinks}개, SNS·지도 새 창 링크 ${externalLinks.size}개, JavaScript 문법, 검색 메타데이터·H1·구조화 데이터·robots·사이트맵`,
);
