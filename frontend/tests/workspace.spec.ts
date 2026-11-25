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
    if (viewport.width >= 768) {
      const key = await page.locator('kbd').boundingBox();
      const input = await search.boundingBox();
      expect(key!.x + key!.width).toBeLessThanOrEqual(input!.x);
    }
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

test('English dark workspace preserves layout and shortcut spacing', async ({ page }) => {
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
  const input = await page.locator('input[type="search"]').boundingBox();
  const key = await page.locator('kbd').boundingBox();
  expect(input!.x + input!.width).toBeLessThanOrEqual(key!.x);
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
