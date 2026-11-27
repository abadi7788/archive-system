import { test, expect, type Page } from '@playwright/test';

const user = { id: '11111111-1111-4111-8111-111111111111', username: 'admin', full_name: 'مدير النظام', role: 'admin', preferred_language: 'ar', preferred_theme: 'light', can_print: true };
const documents = Array.from({ length: 40 }, (_, i) => ({
  id: `doc-${i}`, file_name: `وثيقة تجريبية ${i + 1}.png`, mime_type: 'image/png', file_size: 45200,
  created_at: '2026-11-25T12:00:00Z', status: 'completed', owner_name: 'موظف الاختبار', department: 'المالية',
  summary: 'وصف تفصيلي للتحقق من وضوح النصوص في لوحة المعاينة', extracted_text: 'نص الوثيقة '.repeat(100), can_manage: true,
}));
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');

async function mockApi(page: Page) {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: any = [];
    if (path.endsWith('/health')) data = { status: 'ok' };
    else if (path.endsWith('/auth/me')) data = user;
    else if (path.endsWith('/auth/preferences')) data = { ...user, ...route.request().postDataJSON() };
    else if (path.endsWith('/search')) data = documents;
    else if (path.endsWith('/taxonomy')) data = { departments: [], classifications: [] };
    else if (path.endsWith('/trash')) data = { folders: [], documents: [], total_count: 0 };
    else if (path.includes('/file')) return route.fulfill({ contentType: 'image/png', body: image });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
}
async function loginFixture(page: Page, theme = 'light') {
  await page.addInitScript(({ user, theme }) => {
    localStorage.setItem('archive-pref-lang', 'ar');
    localStorage.setItem('archive-pref-lang-chosen', '1');
    localStorage.setItem('archive-pref-theme', theme);
    sessionStorage.setItem('archive-system-session', JSON.stringify({ token: 'test-token', user: { ...user, preferred_theme: theme } }));
  }, { user, theme });
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 1000 }, { width: 1280, height: 800 }, { width: 820, height: 1180 }, { width: 390, height: 844 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
  test(`RTL layout and independent scrolling ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mockApi(page);
    await loginFixture(page);
    await page.goto('/');
    await expect(page.locator('tbody tr')).toHaveCount(40);
    expect(await page.title()).toBe('Archive YemanY');
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain('Tajawal');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const search = page.locator('input[type="search"]');
    const before = await search.boundingBox();
    const list = page.locator('.file-list-scroll');
    await list.evaluate((element) => { element.scrollTop = 600; });
    expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect((await search.boundingBox())!.y).toBe(before!.y);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    if (viewport.width < 640) expect(await list.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.keyboard.press('Control+k');
    await expect(search).toBeFocused();
    await expect(page.locator('kbd')).toHaveCount(0);
    // No print/delete/download controls outside the full document preview.
    await expect(page.getByRole('button', { name: 'طباعة', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'تحميل', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('ISO dates, filters, grid thumbnails and single modal actions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockApi(page); await loginFixture(page); await page.goto('/');
  await expect(page.locator('tbody tr')).toHaveCount(40);
  await page.getByRole('button', { name: 'فلاتر', exact: true }).click();
  const dates = page.getByPlaceholder('YYYY-MM-DD');
  await expect(dates).toHaveCount(2);
  await dates.first().fill('2026-11-25');
  await expect(dates.first()).toHaveValue('2026-11-25');
  expect(await dates.first().evaluate((input) => getComputedStyle(input).direction)).toBe('ltr');
  await dates.last().fill('2026-02-31');
  expect(await dates.last().evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);
  await dates.last().fill('2026-11-25');
  await page.getByRole('button', { name: 'تطبيق الفلاتر', exact: true }).click();
  await page.getByRole('button', { name: 'فلاتر', exact: false }).first().click();
  await page.getByRole('button', { name: 'شبكة', exact: true }).click();
  await expect(page.locator('.archive-workspace img').first()).toBeVisible();
  await page.getByRole('button', { name: 'فتح المعاينة الكاملة', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'طباعة', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'تحميل', exact: true })).toHaveCount(1);
});

test('login identity has no active badge or filler and supports dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.addInitScript(() => {
    localStorage.setItem('archive-pref-lang', 'ar'); localStorage.setItem('archive-pref-lang-chosen', '1');
    localStorage.setItem('archive-pref-theme', 'dark');
  });
  await page.goto('/');
  await expect(page.locator('#login-username')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Archive YemanY', exact: true })).toHaveCount(1);
  await expect(page.getByText('النظام نشط', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('PDF grid uses a rendered first page; office files have meaningful icons', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockApi(page); await loginFixture(page);
  // Last route registered wins. Only this fixture supplies a real local PDF.
  await page.route('**/api/v1/search*', (route) => route.fulfill({ json: [
    { ...documents[0], id: 'pdf', file_name: 'Preview.pdf', mime_type: 'application/pdf' },
    { ...documents[1], id: 'word', file_name: 'Document.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { ...documents[2], id: 'excel', file_name: 'Workbook.xlsx', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ] }));
  await page.route('**/api/v1/documents/pdf/file*', (route) => route.fulfill({ contentType: 'application/pdf', path: 'tests/fixtures/preview.pdf' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'شبكة', exact: true }).click();
  const thumbnail = page.locator('img[alt="Preview.pdf"]');
  await expect(thumbnail).toBeVisible({ timeout: 15000 });
  expect(await thumbnail.getAttribute('src')).toMatch(/^data:image\/png/);
  expect(await thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(100);
  await expect(page.getByText('WORD', { exact: true })).toBeVisible();
  await expect(page.getByText('EXCEL', { exact: true })).toBeVisible();
});

test('English dark workspace preserves layout and hidden shortcut', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockApi(page);
  const englishUser = { ...user, preferred_language: 'en', preferred_theme: 'dark' };
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: englishUser }));
  await page.addInitScript(({ user }) => {
    localStorage.setItem('archive-pref-lang', 'en'); localStorage.setItem('archive-pref-lang-chosen', '1');
    sessionStorage.setItem('archive-system-session', JSON.stringify({ token: 'test-token', user }));
  }, { user: englishUser });
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('tbody tr')).toHaveCount(40);
  await expect(page.locator('kbd')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.locator('input[type="search"]')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function preferenceApi(page: Page, initialAccount = { ...user }, rejectPreferences = false) {
  let account = { ...initialAccount };
  const updates: Record<string, string>[] = [];
  await mockApi(page);
  await page.route('**/api/v1/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/login')) return route.fulfill({ json: { access_token: 'test-token', user: account } });
    if (path.endsWith('/preferences')) {
      const patch = route.request().postDataJSON();
      updates.push(patch);
      if (rejectPreferences) return route.fulfill({ status: 503, json: { detail: 'Try later' } });
      account = { ...account, ...patch };
    }
    return route.fulfill({ json: path.endsWith('/logout') ? { ok: true } : account });
  });
  return { updates, account: () => account };
}
async function selectLanguage(page: Page, currentLabel: string, choice: string, confirm: string) {
  await page.getByRole('button', { name: currentLabel, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: choice }).click();
  await page.getByRole('dialog').getByRole('button', { name: confirm, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('login choices override old account and workspace changes survive logout and reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const api = await preferenceApi(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('fixture-seeded')) {
      localStorage.setItem('archive-pref-lang', 'ar');
      localStorage.setItem('archive-pref-theme', 'light');
      localStorage.setItem('fixture-seeded', '1');
    }
  });
  await page.goto('/');
  await selectLanguage(page, 'لغة الواجهة', 'English', 'Save & Continue');
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.locator('#login-username').fill('tester');
  await page.locator('#login-password').fill('test-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(40);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(api.updates[0]).toEqual({ preferred_language: 'en', preferred_theme: 'dark' });
  await selectLanguage(page, 'Interface Language', 'العربية', 'حفظ والمتابعة');
  await page.getByRole('button', { name: 'المظهر', exact: true }).click();
  await expect.poll(() => api.account().preferred_theme).toBe('light');
  await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
  await expect(page.locator('#login-username')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('#login-username')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  expect(api.account()).toMatchObject({ preferred_language: 'ar', preferred_theme: 'light' });
});

test('new browser inherits account language and theme without resetting either', async ({ page }) => {
  const account = { ...user, preferred_language: 'en', preferred_theme: 'dark' };
  const api = await preferenceApi(page, account);
  await page.addInitScript((user) => {
    sessionStorage.setItem('archive-system-session', JSON.stringify({ token: 'test-token', user }));
  }, account);
  await page.goto('/');
  await expect(page.locator('tbody tr')).toHaveCount(40);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(api.updates).toEqual([]);
  expect(await page.evaluate(() => [localStorage.getItem('archive-pref-lang'), localStorage.getItem('archive-pref-theme')])).toEqual(['en', 'dark']);
});

test('preference precedence is per field, not an all-or-nothing account overwrite', async ({ page }) => {
  const account = { ...user, preferred_language: 'en', preferred_theme: 'dark' };
  const api = await preferenceApi(page, account);
  await page.addInitScript((user) => {
    localStorage.setItem('archive-pref-lang', 'ar');
    sessionStorage.setItem('archive-system-session', JSON.stringify({ token: 'test-token', user }));
  }, account);
  await page.goto('/');
  await expect(page.locator('tbody tr')).toHaveCount(40);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(api.updates[0]).toEqual({ preferred_language: 'ar', preferred_theme: 'dark' });
});

test('failed account sync does not discard locally saved login choices', async ({ page }) => {
  await preferenceApi(page, { ...user }, true);
  await page.addInitScript((user) => {
    localStorage.setItem('archive-pref-lang', 'en');
    localStorage.setItem('archive-pref-theme', 'dark');
    sessionStorage.setItem('archive-system-session', JSON.stringify({ token: 'test-token', user }));
  }, user);
  await page.goto('/');
  await expect(page.locator('tbody tr')).toHaveCount(40);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(page.locator('#login-username')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
  test(`new login remains usable ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApi(page);
    await page.addInitScript(() => localStorage.setItem('archive-pref-lang', 'ar'));
    await page.goto('/');
    await expect(page.locator('#login-username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('img[src="/brand/archive-mark.svg"]').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const portal = await page.locator('.login-portal').boundingBox();
    expect(portal!.x).toBe(0);
    expect(portal!.y).toBe(0);
    expect(portal!.width).toBe(viewport.width);
    expect(portal!.height).toBeGreaterThanOrEqual(viewport.height);
    await expect(page.locator('.login-heading-rule, .vault-art, .vault-seal')).toHaveCount(0);
  });
}

test('rapid theme changes are saved to account in the same order', async ({ page }) => {
  const api = await preferenceApi(page);
  await loginFixture(page);
  let requests = 0;
  await page.route('**/api/v1/auth/preferences', async (route) => {
    requests += 1;
    // A slow first request must not overwrite the newer second choice.
    if (requests === 1) await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fallback();
  });
  await page.goto('/');
  await expect(page.locator('tbody tr')).toHaveCount(40);
  const toggle = page.getByRole('button', { name: 'المظهر', exact: true });
  await toggle.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await toggle.click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect.poll(() => api.updates.length).toBe(2);
  expect(api.updates.map((patch) => patch.preferred_theme)).toEqual(['dark', 'light']);
  expect(api.account().preferred_theme).toBe('light');
});

test('storage restrictions do not crash login or lose an in-memory choice', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const api = await preferenceApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Save & Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.locator('#login-username').fill('tester');
  await page.locator('#login-password').fill('test-password');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(40);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(api.updates[0]).toEqual({ preferred_language: 'en', preferred_theme: 'dark' });
  expect(errors).toEqual([]);
});

for (const language of ['ar', 'en']) {
  test(`fullscreen login keeps pointer interaction without bottom controls (${language})`, async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 864 });
    await mockApi(page);
    const errors: string[] = [];
    const authRequests: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (request.url().includes('/auth/')) authRequests.push(request.url()); });
    await page.addInitScript((lang) => localStorage.setItem('archive-pref-lang', lang), language);
    await page.goto('/');
    await expect(page.locator('#login-username')).toBeVisible();
    const showcase = page.locator('.login-showcase');
    await expect(showcase).toBeVisible();
    await expect(showcase.locator('button')).toHaveCount(0);
    await expect(page.locator('.showcase-controls, .showcase-description, #login-demo-description')).toHaveCount(0);
    await expect(showcase).not.toContainText(language === 'ar' ? 'مجلدات منظّمة' : 'Organized folders');
    const stage = page.locator('.showcase-stage');
    const bounds = await stage.boundingBox();
    await page.mouse.move(bounds!.x + 20, bounds!.y + 20);
    await expect.poll(() => stage.evaluate((element) => element.style.getPropertyValue('--tilt-x'))).not.toBe('0deg');
    await page.mouse.move(0, 0);
    await expect.poll(() => stage.evaluate((element) => element.style.getPropertyValue('--tilt-x'))).toBe('0deg');
    // The illustration is not connected to account or document services.
    expect(authRequests).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(864);
    expect(await page.locator('.login-portal').evaluate((element) => getComputedStyle(element).borderRadius)).toBe('0px');
    await page.getByRole('button', { name: language === 'ar' ? 'المظهر' : 'Theme', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(showcase.locator('button')).toHaveCount(0);
  });
}

test('reduced motion disables decorative pointer tilt', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem('archive-pref-lang', 'en'));
  await page.goto('/');
  const stage = page.locator('.showcase-stage');
  await expect(stage).toBeVisible();
  const bounds = await stage.boundingBox();
  await page.mouse.move(bounds!.x + 10, bounds!.y + 10);
  expect(await stage.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await expect(page.locator('.showcase-controls')).toHaveCount(0);
  expect(await stage.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
});

test('compact desktop login fills the viewport without clipping its controls', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem('archive-pref-lang', 'en'));
  await page.goto('/');
  await expect(page.locator('#login-username')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeInViewport();
  await expect(page.locator('.showcase-emblem')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(600);
});

test('archive has three equal summary cards and a navy header matching its sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockApi(page); await loginFixture(page); await page.goto('/');
  await expect(page.locator('tbody tr')).toHaveCount(40);
  const cards = page.locator('.archive-summary > .card');
  await expect(cards).toHaveCount(3);
  await expect(page.getByText('الموظفون المرتبطون', { exact: true })).toHaveCount(0);
  const sizes = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(1);
  const background = () => page.evaluate(() => [getComputedStyle(document.querySelector('.workspace-header')!).backgroundImage, getComputedStyle(document.querySelector('.workspace-sidebar')!).backgroundImage]);
  let colors = await background(); expect(colors[0]).toBe(colors[1]);
  expect(await page.locator('.workspace-header h1').evaluate((element) => getComputedStyle(element).color)).toBe('rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'المظهر', exact: true }).click();
  colors = await background(); expect(colors[0]).toBe(colors[1]);
});

test('rename locks the extension, works for folders, and is hidden for viewers', async ({ page }) => {
  await mockApi(page); await loginFixture(page);
  const folder = { id: 'folder-1', name: 'مجلد الاختبار', can_manage: true, parent_id: null };
  await page.route('**/api/v1/folders', (route) => route.fulfill({ json: [folder] }));
  let patch: any;
  await page.route('**/api/v1/documents/doc-0/rename', (route) => { patch = route.request().postDataJSON(); return route.fulfill({ json: {} }); });
  await page.goto('/');
  await page.getByRole('button', { name: `إعادة تسمية: ${documents[0].file_name}`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('.png', { exact: true })).toBeVisible();
  const input = dialog.getByRole('textbox');
  await expect(input).toHaveValue('وثيقة تجريبية 1');
  await input.fill('اسم جديد');
  await dialog.getByRole('button', { name: 'إعادة تسمية', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(patch).toEqual({ name: 'اسم جديد' });
  await page.locator('.folder-tile').first().hover();
  await page.getByRole('button', { name: 'إعادة تسمية: مجلد الاختبار', exact: true }).click();
  await expect(dialog.getByRole('textbox')).toHaveValue('مجلد الاختبار');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: { ...user, role: 'viewer' } }));
  await page.reload();
  await expect(page.locator('tbody tr')).toHaveCount(40);
  await expect(page.getByRole('button', { name: /^إعادة تسمية:/ })).toHaveCount(0);
});

test('archive slider and Ctrl+wheel resize icons and save an account-specific size', async ({ page }) => {
  await mockApi(page); await loginFixture(page);
  const saved: any[] = [];
  await page.route('**/api/v1/auth/preferences', (route) => {
    saved.push(route.request().postDataJSON()); return route.fulfill({ json: { ...user, ...route.request().postDataJSON() } });
  });
  await page.goto('/');
  await expect(page.locator('tbody tr')).toHaveCount(40);
  const size = page.getByRole('slider', { name: 'حجم العرض' });
  await size.fill('240');
  await expect.poll(() => page.evaluate((id) => localStorage.getItem(`archive-item-size:${id}`), user.id)).toBe('240');
  const icon = page.locator('.file-list-scroll tbody td:nth-child(2) > div > span').first();
  expect((await icon.boundingBox())!.width).toBe(48);
  await page.locator('.archive-items').dispatchEvent('wheel', { ctrlKey: true, deltaY: -100 });
  await expect(size).toHaveValue('250');
  await expect.poll(() => saved.some((patch) => patch.preferred_item_size === 250)).toBe(true);
  await page.reload();
  await expect(size).toHaveValue('250');
  await page.getByRole('button', { name: 'شبكة', exact: true }).click();
  const thumb = page.locator('.archive-thumbnail').first();
  expect((await thumb.boundingBox())!.height).toBeCloseTo(187.5);
  await size.fill('100');
  expect((await thumb.boundingBox())!.height).toBe(90);
  await size.fill('160');
  await expect.poll(() => saved.some((patch) => patch.preferred_item_size === 160)).toBe(true);
});

async function uploadMock(page: Page, failOnce = false) {
  const sessions: any[] = [], chunks: number[] = [];
  let failed = false;
  await page.route('**/api/v1/uploads**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === 'POST' && path.endsWith('/uploads')) {
      const session = { ...route.request().postDataJSON(), id: String(sessions.length + 1), received: 0, chunk_size: 4194304 };
      sessions.push(session); return route.fulfill({ status: 201, json: session });
    }
    const session = sessions.find((item) => item.id === path.split('/')[4]);
    if (path.endsWith('/complete')) return route.fulfill({ json: { ...documents[0], id: session.id, file_name: session.file_name, folder_id: session.folder_id } });
    if (route.request().method() === 'PUT') {
      if (failOnce && !failed && session.received > 0) { failed = true; return route.fulfill({ status: 503, json: { detail: 'Temporary interruption' } }); }
      const length = route.request().postDataBuffer()!.length;
      chunks.push(length); session.received += length;
    }
    return route.fulfill({ json: session });
  });
  return { sessions, chunks };
}

test('multi-file Office/TXT upload applies shared metadata and retries interrupted chunks', async ({ page }) => {
  await mockApi(page); await loginFixture(page);
  const uploads = await uploadMock(page, true);
  await page.goto('/');
  await page.getByRole('button', { name: 'رفع مستند', exact: true }).click();
  const picker = page.locator('input[type="file"]').first();
  await expect(picker).toHaveAttribute('multiple', '');
  const accept = await picker.getAttribute('accept');
  for (const ext of ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt']) expect(accept).toContain(ext);
  await picker.setInputFiles([
    { name: 'Workbook.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.alloc(5 * 1024 * 1024, 65) },
    { name: 'Notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') },
  ]);
  await page.getByLabel('القسم', { exact: true }).fill('Finance');
  await page.locator('button[type="submit"]').click();
  await expect.poll(() => uploads.sessions.length).toBe(2);
  await expect(page.locator('p[role="status"]')).toContainText('2');
  expect(uploads.sessions.map((item) => item.department)).toEqual(['Finance', 'Finance']);
  expect(uploads.chunks).toEqual([4194304, 1048576, 5]);
  await expect(page.getByText(/40 MB|40 ميجابايت/)).toHaveCount(0);
});

test('directory picker recreates the directory tree below the selected destination', async ({ page }) => {
  await mockApi(page); await loginFixture(page);
  const uploads = await uploadMock(page);
  await page.route('**/api/v1/folders', (route) => route.fulfill({ json: [{ id: 'folder-target', name: 'الوجهة', can_manage: true }] }));
  const paths: any[] = [];
  await page.route('**/api/v1/folders/import-path', route => {
    paths.push(route.request().postDataJSON()); return route.fulfill({ json: { folder_id: 'import-root' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'رفع مستند', exact: true }).click();
  await page.getByRole('combobox', { name: 'المجلد', exact: true }).selectOption('folder-target');
  await page.locator('input[webkitdirectory]').setInputFiles('tests/fixtures/import-folder');
  await expect(page.getByText('import-folder/first.txt')).toBeVisible();
  await expect(page.getByText('import-folder/second.txt')).toBeVisible();
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('p[role="status"]')).toContainText('2');
  expect(uploads.sessions.map((item) => item.folder_id)).toEqual(['import-root', 'import-root']);
  expect(paths).toEqual([{ parent_id: 'folder-target', owner_id: null, parts: ['import-folder'] }, { parent_id: 'folder-target', owner_id: null, parts: ['import-folder'] }]);
});


test('dropping a directory consumes every reader batch, not only its first entries', async ({ page }) => {
  await mockApi(page); await loginFixture(page); await page.goto('/');
  await page.getByRole('button', { name: 'رفع مستند', exact: true }).click();
  await page.locator('.border-dashed').evaluate((element) => {
    const entries = Array.from({ length: 105 }, (_, index) => ({ isFile: true, isDirectory: false,
      file: (resolve: (file: File) => void) => resolve(new File(['text'], `document-${index}.txt`, { type: 'text/plain' })) }));
    let batch = 0;
    const directory = { isDirectory: true, isFile: false, createReader: () => ({ readEntries: (resolve: (entries: any[]) => void) => {
      resolve(batch++ === 0 ? entries.slice(0, 100) : batch === 2 ? entries.slice(100) : []);
    } }) };
    const transfer = new DataTransfer();
    transfer.items.add(new File([''], 'folder'));
    Object.defineProperty(transfer, 'items', { value: [{ kind: 'file', webkitGetAsEntry: () => directory }] });
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(page.locator('li')).toHaveCount(105);
  await expect(page.locator('button[type="submit"]')).toContainText('105');
});

test('upload works on HTTP LAN installations without WebCrypto.subtle', async ({ page }) => {
  await mockApi(page); await loginFixture(page); const uploads = await uploadMock(page);
  await page.addInitScript(() => Object.defineProperty(crypto, 'subtle', { value: undefined }));
  await page.goto('/');
  await page.getByRole('button', { name: 'رفع مستند', exact: true }).click();
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'local.txt', mimeType: 'text/plain', buffer: Buffer.from('local') });
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('p[role="status"]')).toContainText('1');
  expect(uploads.chunks).toEqual([5]);
});

const teamPeers = [
  { id: 'peer-b', username: 'badr', display_name: 'بدر أحمد', job_title: 'المحاسبة', access: 'read' },
  { id: 'peer-c', username: 'jamal', display_name: 'جمال علي', job_title: 'الموارد البشرية', access: 'full' },
];
async function mockTeam(page: Page) {
  await mockApi(page); await loginFixture(page);
  await page.route('**/api/v1/relationships/team', route => route.fulfill({ json: teamPeers }));
  await page.route('**/api/v1/folders?**', route => {
    const owner = new URL(route.request().url()).searchParams.get('owner_id');
    return route.fulfill({ json: [{ id: `${owner}-folder`, name: 'العقود', parent_id: null, owner_id: owner, can_manage: owner === 'peer-c' }] });
  });
  const searches: string[] = [];
  await page.route('**/api/v1/search?**', route => {
    const params = new URL(route.request().url()).searchParams, owner = params.get('owner_id');
    if (!owner) return route.fulfill({ json: documents });
    searches.push(owner);
    return route.fulfill({ json: [{ id: `${owner}-doc`, file_name: owner === 'peer-b' ? 'حسابات.txt' : 'موظفون.txt', owner_id: owner, folder_id: params.get('folder_id'), file_size: 5, mime_type: 'text/plain', can_manage: owner === 'peer-c' }] });
  });
  return searches;
}

test('team workspaces stay separate and copying targets the personal archive', async ({ page }) => {
  const searches = await mockTeam(page);
  let copied: any;
  await page.route('**/api/v1/documents/peer-b-doc/copy', route => { copied = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { id: 'copy' } }); });
  await page.goto('/');
  await page.getByRole('button', { name: 'ملفات الفريق', exact: true }).click();
  await expect(page.getByText('المساحات المتاحة')).toBeVisible();
  await page.getByRole('button', { name: /بدر أحمد/ }).click();
  await expect(page.getByRole('button', { name: 'حسابات.txt', exact: true })).toBeVisible();
  await expect(page.getByText('موظفون.txt', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'إضافة إلى هذه المساحة' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'مجلد جديد', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'نسخ لأرشيفي', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'نسخ لأرشيفي' });
  await dialog.getByLabel('الاسم الجديد').fill('نسخة حسابات.txt');
  await dialog.getByRole('button', { name: 'إنشاء نسخة' }).click();
  await expect(dialog).toHaveCount(0);
  expect(copied).toEqual({ name: 'نسخة حسابات.txt', folder_id: null });
  await page.getByRole('button', { name: 'العقود', exact: true }).click();
  await expect(page.getByRole('button', { name: /العقود/ })).toBeVisible();
  await page.getByRole('button', { name: 'كل مساحات الفريق' }).click();
  await page.getByRole('button', { name: /جمال علي/ }).click();
  await expect(page.getByRole('button', { name: 'موظفون.txt', exact: true })).toBeVisible();
  await expect(page.getByText('حسابات.txt', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'إضافة إلى هذه المساحة' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'مجلد جديد', exact: true })).toBeVisible();
  expect(searches).toContain('peer-b'); expect(searches).toContain('peer-c');
  await page.getByRole('button', { name: 'الأرشيف', exact: true }).click();
  await expect(page.getByText('حسابات.txt', { exact: true })).toHaveCount(0);
  await expect(page.getByText('موظفون.txt', { exact: true })).toHaveCount(0);
});

test('supervised employee sees an ordinary empty team area with no supervisor identity', async ({ page }) => {
  await mockApi(page); await loginFixture(page);
  await page.route('**/api/v1/relationships/team', route => route.fulfill({ json: [] }));
  await page.goto('/'); await page.getByRole('button', { name: 'ملفات الفريق', exact: true }).click();
  await expect(page.getByText('لا توجد مساحات فريق متاحة حاليًا.')).toBeVisible();
  await expect(page.getByText(/المشرف|ربط إشرافي|إشعار بالربط/)).toHaveCount(0);
});

test('admin creates, edits and revokes an independent supervisory relationship', async ({ page }) => {
  await mockApi(page); await loginFixture(page);
  const employees = [{ id: 'person-a', username: 'ahmed', full_name: 'أحمد', role: 'archiver' }, { id: 'person-b', username: 'badr', full_name: 'بدر', role: 'archiver' }];
  await page.route('**/api/v1/users', route => route.fulfill({ json: employees }));
  let rows: any[] = []; const changes: any[] = [];
  await page.route(/\/api\/v1\/relationships(?:\/[^/?]+)?$/, route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: rows });
    if (route.request().method() === 'DELETE') { rows = []; return route.fulfill({ status: 204 }); }
    const body = route.request().postDataJSON(); changes.push(body);
    rows = [{ id: 'rel-1', ...body, user_a: { display_name: 'أحمد' }, user_b: { display_name: 'بدر' } }];
    return route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, json: rows[0] });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'الإعدادات', exact: true }).click();
  await page.getByRole('button', { name: 'إدارة النظام', exact: true }).click();
  await page.getByRole('button', { name: 'ربط بيانات الموظفين', exact: true }).click();
  await page.getByRole('radio', { name: /ربط إشرافي/ }).check();
  await page.getByRole('combobox', { name: 'المدير / المشرف', exact: true }).selectOption('person-a');
  await page.getByRole('combobox', { name: 'الموظف', exact: true }).selectOption('person-b');
  await page.getByRole('combobox', { name: 'مستوى الوصول', exact: true }).selectOption('full');
  await page.getByRole('button', { name: 'حفظ التغييرات', exact: true }).click();
  await expect(page.getByText('تم حفظ العلاقة والصلاحيات.')).toBeVisible();
  expect(changes[0]).toEqual({ user_a_id: 'person-a', user_b_id: 'person-b', mode: 'supervisory', access: 'full' });
  const panel = page.getByRole('region', { name: 'الروابط الحالية' });
  await panel.getByRole('button', { name: 'تعديل', exact: true }).click();
  await page.getByRole('combobox', { name: 'مستوى الوصول', exact: true }).selectOption('read');
  await page.getByRole('button', { name: 'حفظ التغييرات', exact: true }).click();
  await expect.poll(() => changes.length).toBe(2);
  expect(changes[1].access).toBe('read');
  await panel.getByRole('button', { name: 'إلغاء الرابط', exact: true }).click();
  await panel.getByRole('button', { name: 'تأكيد الإلغاء' }).click();
  await expect(page.getByText('تم إلغاء الرابط. لم تُحذف أي ملفات.')).toBeVisible();
  await expect(panel.getByText('أحمد', { exact: true })).toHaveCount(0);
});

test('directory drop preserves nested paths and equal file names in different subfolders', async ({ page }) => {
  await mockApi(page); await loginFixture(page); const uploads = await uploadMock(page);
  const paths: any[] = [];
  await page.route('**/api/v1/folders/import-path', route => {
    const body = route.request().postDataJSON(); paths.push(body);
    return route.fulfill({ json: { folder_id: body.parts.join('/') } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'رفع مستند', exact: true }).click();
  await page.locator('.border-dashed').evaluate(element => {
    const file = () => ({ name: 'same.txt', isFile: true, isDirectory: false, file: (ok: any) => ok(new File(['hello'], 'same.txt', { type: 'text/plain' })) });
    const dir = (name: string, children: any[]) => ({ name, isFile: false, isDirectory: true, createReader: () => { let read = false; return { readEntries: (ok: any) => { ok(read ? [] : children); read = true; } }; } });
    const root = dir('المشروع', [dir('تقارير', [file()]), dir('عقود', [file()])]);
    const dataTransfer = new DataTransfer(); Object.defineProperty(dataTransfer, 'items', { value: [{ kind: 'file', webkitGetAsEntry: () => root }] });
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
  });
  await expect(page.getByText('المشروع/تقارير/same.txt')).toBeVisible();
  await expect(page.getByText('المشروع/عقود/same.txt')).toBeVisible();
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('p[role="status"]')).toContainText('2');
  expect(paths.map(p => p.parts)).toEqual([['المشروع', 'تقارير'], ['المشروع', 'عقود'], ['المشروع', 'تقارير'], ['المشروع', 'عقود']]);
  expect(uploads.sessions.map(s => s.folder_id)).toEqual(['المشروع/تقارير', 'المشروع/عقود']);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`team area remains usable ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await mockTeam(page); await page.goto('/');
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Menu', exact: true }).first().click();
    await page.getByRole('button', { name: 'ملفات الفريق', exact: true }).click();
    await page.getByRole('button', { name: /جمال علي/ }).click();
    await expect(page.getByRole('button', { name: 'موظفون.txt', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test('dropping an empty directory creates it without an upload session', async ({ page }) => {
  await mockApi(page); await loginFixture(page); const uploads = await uploadMock(page);
  const paths: any[] = [];
  await page.route('**/api/v1/folders/import-path', route => {
    paths.push(route.request().postDataJSON()); return route.fulfill({ json: { folder_id: 'empty' } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'رفع مستند', exact: true }).click();
  await page.locator('.border-dashed').evaluate(element => {
    const root = { name: 'فارغ', isDirectory: true, isFile: false, createReader: () => ({ readEntries: (ok: any) => ok([]) }) };
    const dataTransfer = new DataTransfer(); Object.defineProperty(dataTransfer, 'items', { value: [{ kind: 'file', webkitGetAsEntry: () => root }] });
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
  });
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.locator('button[type="submit"]').click();
  await expect.poll(() => paths.length).toBe(1);
  expect(paths[0].parts).toEqual(['فارغ']);
  expect(uploads.sessions).toEqual([]);
});

test('team preview keeps download in the opened preview and hides write actions for read access', async ({ page }) => {
  await mockTeam(page); await page.goto('/'); await page.getByRole('button', { name: 'ملفات الفريق', exact: true }).click();
  await page.getByRole('button', { name: /بدر أحمد/ }).click();
  await page.getByRole('button', { name: 'حسابات.txt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'تحميل', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'حذف', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'مشاركة آمنة', exact: true })).toHaveCount(0);
});

async function mockFolderGrid(page: Page) {
  await mockApi(page); await loginFixture(page);
  const folders = Array.from({ length: 12 }, (_, i) => ({ id: `folder-${i}`, name: i === 11 ? 'اسم مجلد طويل لاختبار الالتفاف دون قص الأزرار أو خروج المحتوى عن عرض الشاشة' : `مجلد ${i + 1}`, parent_id: null, item_count: i, subfolder_count: 0, can_manage: true }));
  await page.route('**/api/v1/folders', route => route.fulfill({ json: folders }));
}

test('folders use an unframed responsive icon grid in both archive document modes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockFolderGrid(page); await page.goto('/');
  const grid = page.locator('.folder-icon-grid');
  await expect(grid.locator('.folder-tile')).toHaveCount(12);
  const columns = () => grid.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
  expect(await columns()).toBe(5);
  await expect(grid.locator('.folder-tile-count').first()).toHaveText('0 عنصر');
  await expect(grid.locator('svg[data-folder-shape="layered"]')).toHaveCount(12);
  expect(await grid.locator('.folder-tile').first().evaluate(node => ({ background: getComputedStyle(node).backgroundColor, border: getComputedStyle(node).borderTopColor }))).toEqual({ background: 'rgba(0, 0, 0, 0)', border: 'rgba(0, 0, 0, 0)' });
  await page.getByRole('button', { name: 'شبكة', exact: true }).click();
  expect(await columns()).toBe(5);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(columns).toBe(6);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(columns).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const name = grid.locator('.folder-tile-name').first(), icon = grid.locator('svg').first();
  expect((await name.boundingBox())!.y).toBeGreaterThan((await icon.boundingBox())!.y + (await icon.boundingBox())!.height);
});

test('folder tools appear on hover and keyboard focus without wrapping the icon in a card', async ({ page }) => {
  await mockFolderGrid(page); await page.goto('/');
  const tile = page.locator('.folder-tile').first(), actions = tile.locator('.folder-tile-actions');
  await expect(actions).toHaveCSS('opacity', '0');
  await tile.hover(); await expect(actions).toHaveCSS('opacity', '1');
  await page.getByRole('heading', { name: 'الأرشيف', exact: true }).hover();
  await expect(actions).toHaveCSS('opacity', '0');
  await tile.locator('.folder-tile-open').focus();
  await expect(actions).toHaveCSS('opacity', '1');
  await page.keyboard.press('Tab');
  await expect(tile.getByRole('button', { name: 'إعادة تسمية: مجلد 1', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('مجلد 1');
  await page.keyboard.press('Escape');
  await tile.locator('.folder-tile-open').click();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('button', { name: 'مجلد 1', exact: true })).toBeVisible();
});

test('folder SVG gradients follow light/dark primary theme colors with unique paint IDs', async ({ page }) => {
  await mockFolderGrid(page); await page.goto('/');
  const color = () => page.locator('.folder-tile svg stop').first().evaluate(node => getComputedStyle(node).stopColor);
  await expect(page.locator('.folder-tile')).toHaveCount(12);
  const light = await color();
  await page.getByRole('button', { name: 'المظهر', exact: true }).click();
  await expect.poll(color).not.toBe(light);
  const ids = await page.locator('.folder-tile linearGradient').evaluateAll(nodes => nodes.map(node => node.id));
  expect(new Set(ids).size).toBe(24);
  const dark = await color();
  await page.evaluate(() => document.documentElement.style.setProperty('--brand-primary', '#7356bd'));
  await expect.poll(color).not.toBe(dark);
});

test('folder icon drop targets still move selected documents', async ({ page }) => {
  await mockFolderGrid(page); await page.goto('/');
  let move: any;
  await page.route('**/api/v1/documents/bulk/move', route => { move = route.request().postDataJSON(); return route.fulfill({ json: { moved: 1, skipped: 0 } }); });
  await page.locator('.folder-tile').first().evaluate(node => {
    const dataTransfer = new DataTransfer(); dataTransfer.setData('application/x-archive-doc-ids', JSON.stringify(['doc-0']));
    node.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
  });
  await expect.poll(() => move).toEqual({ document_ids: ['doc-0'], folder_id: 'folder-0' });
});
