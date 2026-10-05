// Đo tràn ngang cho từng giai đoạn/bước tại một bề rộng cố định.
// Chạy: node browser.mjs http://localhost:5199/preview.html --script qa-one.mjs --eval-w 390
const W = Number(process.env.QA_W || 1280);

const PROBE = () => {
  const de = document.documentElement;
  const offenders = [];
  document.querySelectorAll("main *, nav *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > de.clientWidth + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName,
        cls: (el.className || "").toString().slice(0, 70),
        text: (el.textContent || "").trim().slice(0, 40),
        left: Math.round(r.left),
        right: Math.round(r.right),
      });
    }
  });
  return {
    docW: de.clientWidth,
    scrollW: de.scrollWidth,
    hScroll: de.scrollWidth > de.clientWidth + 1,
    count: offenders.length,
    offenders: offenders.slice(0, 4),
  };
};

export default async function run(page, ui) {
  await page.setViewportSize({ width: W, height: 900 });
  const results = [];

  for (const s of [1, 2, 3]) {
    const maxStep = s === 3 ? 4 : 5;
    for (let b = 1; b <= maxStep; b++) {
      await page.goto(`http://localhost:5199/preview.html?s=${s}&b=${b}`, {
        waitUntil: "load",
        timeout: 60000,
      });
      const r = await page.evaluate(PROBE);
      results.push({ w: W, stage: s, step: b, ...r });
    }
  }

  const bad = results.filter((r) => r.count > 0 || r.hScroll);
  return {
    width: W,
    checked: results.length,
    failures: bad.length,
    bad: bad.map((x) => ({
      s: x.stage,
      b: x.step,
      scrollW: x.scrollW,
      docW: x.docW,
      off: x.offenders,
    })),
  };
}
