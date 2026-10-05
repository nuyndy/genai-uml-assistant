export default async function run(page, ui) {
  // Chặn mọi API backend và trả dữ liệu rỗng để đăng nhập giả và mở workspace.
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const json = (body) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    if (url.includes('/api/auth/me')) {
      return json({ id: 1, email: 'test@example.com', name: 'Test', avatar_url: null });
    }
    if (url.includes('/api/projects') && !url.includes('/api/projects/1/')) {
      return json([{ id: 1, name: 'Dự án thử', created_at: '2026-01-01' }]);
    }
    if (url.includes('/uml-state')) {
      return json({
        actors: [], use_cases: [], relations: [],
        classes: [], class_relations: [], diagrams: [],
      });
    }
    if (url.includes('/requirements') || url.includes('/user-stories')
        || url.includes('/specifications')) {
      return json([]);
    }
    if (url.includes('/specification-document')) {
      return json({
        project_id: 1,
        metadata: {
          intro_purpose: '', intro_scope: '', intro_definitions: '',
          overview_user_classes: '', overview_environment: '', appendix_notes: '',
        },
        sections: [], raw_markdown: '',
      });
    }
    return json({});
  });

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('genai-uml:token', 'fake-token-for-local-testing');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const opened = await page.getByText('Dự án thử').first().isVisible().catch(() => false);
  if (!opened) {
    return { step: 'khong mo duoc trang chu', text: (await page.locator('body').innerText()).slice(0, 400) };
  }

  await page.getByText('Dự án thử').first().click();
  await page.waitForTimeout(1200);

  const beforeText = (await page.locator('body').innerText()).slice(0, 200);

  // Nhấn sang Giai đoạn 2.
  await page.getByRole('button', { name: /Mô hình hóa UML/ }).click();
  await page.waitForTimeout(2500);

  const bodyText = (await page.locator('body').innerText()).trim();
  const headings = await page.locator('h1,h2,h3').allInnerTexts();

  return {
    beforeStage2: beforeText,
    bodyChars: bodyText.length,
    bodyPreview: bodyText.slice(0, 400),
    headings,
  };
}
