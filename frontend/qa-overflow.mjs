export default async function run(page, ui) {
  const results = [];

  // Kiểm tra tràn ngang ở nhiều bề rộng, trên cả 3 giai đoạn và các bước con.
  const widths = [1280, 768, 390];
  const stages = [1, 2, 3];

  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const st of stages) {
      // Chuyển giai đoạn bằng cách click vào nút giai đoạn tương ứng.
      const snap = await ui.snapshot();
      const ref = snap.match(
        new RegExp(`@(e\\d+) button \"Giai đoạn ${st}\"`),
      )?.[1];
      if (ref) {
        await ui.click(ref);
        await page.waitForTimeout(250);
      }

      const maxStep = st === 3 ? 4 : 5;
      for (let s = 1; s <= maxStep; s++) {
        // Click bước trong sub-stepper.
        const s2 = await ui.snapshot();
        const li = s2.match(/@(e\d+) button/gs) || [];
        void li;
        // Chuyển bước bằng cách bấm nút điều hướng phía dưới.
        const buttons = await page
          .locator('nav[aria-label="Tiến trình các bước"] button')
          .all();
        if (buttons[s - 1]) {
          await buttons[s - 1].click();
          await page.waitForTimeout(200);
        }

        const over = await page.evaluate(() => {
          const de = document.documentElement;
          const bad = [];
          document.querySelectorAll("*").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0) return;
            // Tràn ra ngoài bề rộng khung nhìn.
            if (r.right > de.clientWidth + 1) {
              bad.push({
                tag: el.tagName,
                cls: (el.className || "").toString().slice(0, 60),
                right: Math.round(r.right),
              });
            }
          });
          return {
            docW: de.clientWidth,
            scrollW: de.scrollWidth,
            horizontalScroll: de.scrollWidth > de.clientWidth + 1,
            offenders: bad.slice(0, 5),
            count: bad.length,
          };
        });

        results.push({ w, stage: st, step: s, ...over });
      }
    }
  }

  const bad = results.filter((r) => r.count > 0 || r.horizontalScroll);
  return { checked: results.length, failures: bad.length, bad };
}
