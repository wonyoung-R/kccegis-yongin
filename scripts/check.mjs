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
for (const match of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)) {
  await checkResource(match[1], root);
}
for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
  await checkResource(match[1], path.join(root, "css"));
}

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
  `검증 통과: 리소스 ${resources.size}개, 내부 이동, 전화 링크 ${phoneLinks}개, SNS·지도 새 창 링크 ${externalLinks.size}개, JavaScript 문법`,
);
