import 'dotenv/config';
import { getRequiredEnv, launchBrowser, loginAsSuperadmin, startLocalServer } from './_playwright-worker-local.js';

const LOCAL_PORT = Number(process.env.SMOKE_UX_BUILDER_DESKTOP_PORT || 8903);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return '';
  return String(process.argv[index + 1] || '').trim();
}

function buildBaseUrl() {
  const fromArg = getArgValue('--base-url');
  if (fromArg) return fromArg.replace(/\/+$/, '');
  const fromEnv = String(process.env.SMOKE_UX_BUILDER_DESKTOP_BASE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function createAssertions() {
  const failures = [];
  return {
    failures,
    pass(label, detail = '') {
      console.log(`[PASS] ${label}${detail ? ` -> ${detail}` : ''}`);
    },
    fail(label, detail = '') {
      const message = `${label}${detail ? ` -> ${detail}` : ''}`;
      failures.push(message);
      console.error(`[FAIL] ${message}`);
    },
    expect(label, condition, detailOnFail = '') {
      if (condition) {
        this.pass(label);
        return true;
      }
      this.fail(label, detailOnFail);
      return false;
    },
  };
}

async function resolveTargetQuestionnaire(baseUrl) {
  const tenantsRes = await fetch(`${baseUrl}/forms/api/tenants/public`);
  if (!tenantsRes.ok) {
    throw new Error(`Gagal ambil tenant publik: ${tenantsRes.status}`);
  }
  const tenantsPayload = await tenantsRes.json().catch(() => ({}));
  const tenants = toArray(tenantsPayload?.data);
  if (!tenants.length) {
    throw new Error('Tenant publik kosong.');
  }

  for (const tenant of tenants) {
    const tenantSlug = String(tenant?.slug || '').trim();
    if (!tenantSlug) continue;
    const questionnairesRes = await fetch(`${baseUrl}/forms/${tenantSlug}/api/questionnaires/public`);
    if (!questionnairesRes.ok) continue;
    const questionnairesPayload = await questionnairesRes.json().catch(() => ({}));
    const questionnaires = toArray(questionnairesPayload?.data);
    const questionnaire = questionnaires.find((item) => String(item?.slug || '').trim());
    if (questionnaire) {
      return {
        tenantSlug,
        questionnaireSlug: String(questionnaire.slug).trim(),
      };
    }
  }

  throw new Error('Tidak ada tenant dengan questionnaire publik.');
}

async function run() {
  const assertions = createAssertions();
  const externalBaseUrl = buildBaseUrl();
  const isExternal = Boolean(externalBaseUrl);

  if (!isExternal) {
    getRequiredEnv('DATABASE_URL');
    getRequiredEnv('SESSION_SECRET');
  }
  const email = getRequiredEnv('SUPERADMIN_EMAIL');
  const password = getRequiredEnv('SUPERADMIN_PASSWORD');

  const local = isExternal ? null : await startLocalServer(LOCAL_PORT);
  const baseUrl = isExternal ? externalBaseUrl : local.baseUrl;
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  try {
    assertions.pass('mode', isExternal ? `external (${baseUrl})` : `local (${baseUrl})`);
    await loginAsSuperadmin(page, { baseUrl, email, password });

    const target = await resolveTargetQuestionnaire(baseUrl);
    const builderUrl = `${baseUrl}/forms/${target.tenantSlug}/admin/questionnaires/${target.questionnaireSlug}/builder/`;
    await page.goto(builderUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#question-list', { timeout: 30000, state: 'attached' });
    await page.waitForFunction(
      () => {
        const status = document.querySelector('#status');
        return Boolean(status && /builder siap dipakai/i.test(status.textContent || ''));
      },
      { timeout: 30000 }
    );
    await page.locator('[data-step-target=\"pertanyaan\"]').first().click({ force: true });
    await page.waitForSelector('.builder-question-card', { timeout: 30000, state: 'attached' });

    const labels = await page.evaluate(() => {
      const composer = Array.from(document.querySelectorAll('#new-question-type option')).map((option) =>
        String(option.textContent || '').trim()
      );
      const cardType = Array.from(
        document.querySelectorAll('.builder-question-card .field--type select option')
      ).map((option) => String(option.textContent || '').trim());
      return { composer, cardType };
    });
    const expectedLabels = ['Teks bebas', 'Pilihan tunggal', 'Pilihan ganda (centang)', 'Skala 1-5'];
    assertions.expect(
      'composer type labels updated',
      expectedLabels.every((label) => labels.composer.includes(label)),
      `labels composer: ${labels.composer.join(', ')}`
    );
    assertions.expect(
      'card type labels updated',
      expectedLabels.every((label) => labels.cardType.includes(label)),
      `labels card: ${labels.cardType.join(', ')}`
    );

    const structure = await page.evaluate(() => {
      const issues = [];
      const firstCard = document.querySelector('.builder-question-card');
      if (!firstCard) {
        issues.push('first question card tidak ditemukan');
        return { issues };
      }

      const rectOf = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };

      const intersectArea = (a, b) => {
        if (!a || !b) return 0;
        const left = Math.max(a.left, b.left);
        const right = Math.min(a.right, b.right);
        const top = Math.max(a.top, b.top);
        const bottom = Math.min(a.bottom, b.bottom);
        return Math.max(0, right - left) * Math.max(0, bottom - top);
      };

      const actions = firstCard.querySelector('.builder-question-card__actions');
      const editorGrid = firstCard.querySelector('.builder-question-card__editor-grid');
      const dynamic = firstCard.querySelector('.builder-question-card__dynamic');
      const actionsRect = rectOf(actions);
      const editorRect = rectOf(editorGrid);
      const dynamicRect = rectOf(dynamic);
      if (intersectArea(actionsRect, editorRect) > 8) {
        issues.push('action group overlap dengan editor grid');
      }
      if (intersectArea(actionsRect, dynamicRect) > 8) {
        issues.push('action group overlap dengan dynamic section');
      }

      const editorChildren = editorGrid
        ? Array.from(editorGrid.children).filter((child) => {
            const r = child.getBoundingClientRect();
            const cs = getComputedStyle(child);
            return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
          })
        : [];
      for (let i = 0; i < editorChildren.length; i += 1) {
        for (let j = i + 1; j < editorChildren.length; j += 1) {
          const area = intersectArea(rectOf(editorChildren[i]), rectOf(editorChildren[j]));
          if (area > 8) {
            issues.push(
              `editor element overlap (${editorChildren[i].className || editorChildren[i].tagName} vs ${editorChildren[j].className || editorChildren[j].tagName})`
            );
          }
        }
      }

      const fields = Array.from(firstCard.querySelectorAll('.builder-question-card__editor-grid .field'));
      for (const field of fields) {
        const label = field.querySelector(':scope > span');
        const control = field.querySelector(':scope > input, :scope > select, :scope > textarea');
        if (!label || !control) continue;
        const labelRect = label.getBoundingClientRect();
        const controlRect = control.getBoundingClientRect();
        if (labelRect.bottom > controlRect.top + 1) {
          issues.push(`label tidak berada di atas control pada field "${field.className}"`);
        }
      }

      return { issues };
    });
    assertions.expect('desktop card structure no overlap', structure.issues.length === 0, structure.issues.join(' | '));

    const beforeCount = await page.locator('.builder-question-card').count();
    const uniqueLabel = `Smoke desktop ${Date.now()}`;
    await page.selectOption('#new-question-type', 'radio');
    await page.fill('#new-question-label', uniqueLabel);
    await page.fill('#new-question-options', 'A, B');
    await page.click('#add-question-btn');
    await page.waitForTimeout(350);
    const afterType = await page.$eval('#new-question-type', (el) => el.value);
    const afterCount = await page.locator('.builder-question-card').count();
    assertions.expect('composer remembers selected type', afterType === 'radio', `type=${afterType}`);
    assertions.expect('question added successfully', afterCount === beforeCount + 1, `before=${beforeCount}, after=${afterCount}`);

    if (assertions.failures.length) {
      throw new Error(`UX builder desktop smoke gagal (${assertions.failures.length} issue).`);
    }

    console.log('[PASS] smoke-ux-builder-desktop selesai tanpa pelanggaran UX desktop builder.');
  } finally {
    await context.close();
    await browser.close();
    if (local) {
      await local.close();
    }
  }
}

run().catch((error) => {
  console.error('[FAIL] smoke-ux-builder-desktop');
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
