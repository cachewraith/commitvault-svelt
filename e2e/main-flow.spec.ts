import { randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { credentials } from './credentials';

/**
 * The main user journey against the real stack (database + backend + UI):
 * login → project → environments → commits (on the default branch and on a
 * branch added from the form) → branch page → deployment → history and its
 * side panel → release → note (create, autosave, read) → search → logout.
 *
 * Sign-in expects a backend without outgoing email (password only). With
 * SMTP configured, a new browser is asked for an emailed code instead.
 *
 * Records are uniquely named per run and the project (which owns everything
 * created here) is deleted at the end, so the suite is repeatable on a
 * database that already contains data.
 */
const run = randomBytes(3).toString('hex');
const project = `E2E Shop ${run}`;
const commitMessage = `feat: e2e checkout ${run}`;
const fixMessage = `fix: e2e rounding ${run}`;
const commitHash = randomBytes(20).toString('hex');
const fixHash = randomBytes(20).toString('hex');
const noteTitle = `E2E runbook ${run}`;

let projectId = '';

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  // Safety net: remove the project even when a step failed half-way.
  if (projectId) {
    const csrf = await page.request.get('/api/v1/auth/csrf');
    if (csrf.ok()) {
      const token = (await csrf.json()).data.csrf_token as string;
      await page.request.delete(`/api/v1/projects/${projectId}`, { headers: { 'X-CSRF-Token': token } });
    }
  }
  await page.close();
});

const dialog = () => page.getByRole('dialog');

async function recordCommit(hash: string, message: string, newBranch?: string) {
  await page.getByRole('button', { name: 'Record commit' }).first().click();
  await expect(dialog().getByRole('heading', { name: 'Record commit' })).toBeVisible();
  // New commits start on the project's default branch.
  const branch = dialog().getByRole('combobox', { name: /^Branch/ });
  await expect(branch).toHaveText(/main/);
  if (newBranch) {
    await branch.click();
    await page.getByPlaceholder('Search branches…').fill(newBranch);
    await page.getByRole('option', { name: `Add branch “${newBranch}”` }).click();
    await expect(branch).toHaveText(new RegExp(newBranch));
  }
  // Pasted in upper case on purpose: the form normalises it.
  await dialog().getByLabel('Commit hash').fill(hash.toUpperCase());
  await dialog().getByLabel('Message').fill(message);
  await dialog().getByRole('button', { name: 'Record commit' }).click();
  await expect(dialog()).toBeHidden();
  await expect(page.getByText(`Commit ${hash.slice(0, 7)} recorded`)).toBeVisible();
}

test('1 · signs in', async () => {
  const { email, password } = credentials();
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.locator('button[type=submit]').click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
});

test('2 · creates a project', async () => {
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'New project' }).first().click();
  await dialog().getByLabel('Name').fill(project);
  await dialog().getByLabel(/^Description/).fill('Created by the end-to-end suite.');
  await dialog().getByRole('button', { name: 'Create project' }).click();
  await expect(dialog()).toBeHidden();

  if (!/\/projects\/[0-9a-f-]{36}$/.test(page.url())) {
    await page.getByRole('link', { name: project }).first().click();
  }
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: project, level: 1 })).toBeVisible();
  projectId = new URL(page.url()).pathname.split('/').pop() ?? '';
});

test('3 · creates environments', async () => {
  await page.goto(`/projects/${projectId}/environments`);
  for (const name of ['Staging', 'Production']) {
    await page.getByRole('button', { name: /new environment/i }).first().click();
    await dialog().getByLabel('Name').fill(name);
    await dialog().getByRole('button', { name: /^(create|add|save)/i }).click();
    await expect(dialog()).toBeHidden();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
});

test('4 · records commits', async () => {
  await page.goto(`/projects/${projectId}`);
  await recordCommit(commitHash, commitMessage);
  await recordCommit(fixHash, fixMessage, `fix/${run}`);

  // The commit list shows both, with the normalised short hash.
  await page.goto(`/commits?project_id=${projectId}`);
  await expect(page.getByText(commitMessage)).toBeVisible();
  await expect(page.getByText(fixMessage)).toBeVisible();
  await expect(page.getByText(commitHash.slice(0, 7)).first()).toBeVisible();
});

test('4b · lists branches and opens one', async () => {
  // Project sections are tabs under the project header.
  await page.goto(`/projects/${projectId}`);
  const tabs = page.getByRole('navigation', { name: 'Project sections' });
  await tabs.getByRole('link', { name: 'Branches' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/branches$`));
  await expect(tabs.getByRole('link', { name: 'Branches' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Branches', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'main', exact: true })).toBeVisible();

  // Record links open in the side panel, over the list.
  await page.getByRole('link', { name: `fix/${run}`, exact: true }).click();
  await expect(page).toHaveURL(/[?&]panel=branch\.[0-9a-f-]{36}/);
  const panel = page.getByRole('dialog', { name: 'Branch' });
  await expect(panel.getByRole('heading', { name: `fix/${run}` })).toBeVisible();
  await expect(panel.getByText(fixMessage)).toBeVisible();
  await expect(panel.getByText(commitMessage)).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('5 · records a deployment', async () => {
  await page.goto(`/projects/${projectId}`);
  await page.getByRole('button', { name: 'Record deployment' }).first().click();
  await expect(dialog().getByRole('heading', { name: 'Record deployment' })).toBeVisible();

  await dialog().getByRole('combobox', { name: 'Environment' }).click();
  await page.getByRole('option', { name: 'Production' }).click();

  await dialog().getByRole('combobox', { name: 'Commit' }).click();
  await page.getByRole('option', { name: new RegExp(commitMessage) }).click();

  // A title is suggested from the two choices.
  await expect(dialog().getByLabel('Title')).toHaveValue(new RegExp(`${commitHash.slice(0, 7)}.*Production`));
  await dialog().getByLabel(/^Notes/).fill('sqlx migrate run\nsystemctl restart shop');
  await dialog().getByRole('button', { name: 'Record deployment' }).click();
  await expect(dialog()).toBeHidden();
});

test('6 · shows the deployment in the history and on the commit', async () => {
  await page.goto(`/deployments?project_id=${projectId}`);
  const entry = page.getByRole('link', { name: new RegExp(`Deploy ${commitHash.slice(0, 7)} to Production`) });
  await expect(entry.first()).toBeVisible();
  await expect(page.getByText('Successful').first()).toBeVisible();

  // A record opens in a side panel over the list, with its own URL…
  await entry.first().click();
  await expect(page).toHaveURL(/\/deployments\?.*panel=deployment\.[0-9a-f-]{36}/);
  const panel = page.getByRole('dialog', { name: 'Deployment record' });
  // Stored commands are shown as text to copy — never as something to run.
  await expect(panel.getByText('sqlx migrate run')).toBeVisible();
  // …that survives a reload and closes with Escape, keeping the list's filters.
  await page.reload();
  await expect(panel.getByText('sqlx migrate run')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/deployments\\?project_id=${projectId}$`));

  // The full page still exists.
  await entry.first().click();
  await page.getByRole('link', { name: 'Open full page' }).click();
  await expect(page).toHaveURL(/\/deployments\/[0-9a-f-]{36}$/);
  await expect(page.getByText('sqlx migrate run')).toBeVisible();

  // The other commit has no record: the UI says so without claiming it is not deployed.
  await page.goto(`/commits?project_id=${projectId}&deployment_status=none`);
  await expect(page.getByText(fixMessage)).toBeVisible();
  await expect(page.getByText(commitMessage)).toBeHidden();
});

test('6b · groups a date range by branch, deletes from the panel', async () => {
  // Default range is the last 7 days; the commits were recorded just now.
  await page.goto(`/timeline?project_id=${projectId}`);
  await expect(page.getByRole('region', { name: `Branch fix/${run}` }).getByText(fixMessage)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Branch main' }).getByText(commitMessage)).toBeVisible();

  // Deleting is optimistic: the panel closes and the row goes at once.
  await page.goto(`/commits?project_id=${projectId}`);
  await page.getByRole('link', { name: fixMessage }).click();
  const panel = page.getByRole('dialog', { name: 'Commit' });
  await panel.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete commit' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('link', { name: fixMessage })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('link', { name: commitMessage })).toBeVisible();
  await expect(page.getByRole('link', { name: fixMessage })).toBeHidden();
});

test('7 · creates a release with a commit', async () => {
  await page.goto(`/releases?project_id=${projectId}`);
  await page.getByRole('button', { name: 'New release' }).first().click();
  await dialog().getByLabel('Version').fill(`1.0.0-${run}`);
  await dialog().getByLabel('Title').fill('First release');

  // Opened from a project-filtered list, the dialog arrives with the project chosen.
  await expect(dialog().getByText(project)).toBeVisible();

  await dialog().getByRole('combobox', { name: /^Commits/ }).click();
  await page.getByRole('option', { name: new RegExp(commitMessage) }).click();
  await page.keyboard.press('Escape');

  await dialog().getByRole('button', { name: /create release/i }).click();
  await expect(dialog()).toBeHidden();

  // Saving opens the new release; fall back to the list link if it did not.
  if (!/\/releases\/[0-9a-f-]{36}$/.test(page.url())) {
    await page.getByRole('link', { name: /First release/ }).first().click();
  }
  await expect(page).toHaveURL(/\/releases\/[0-9a-f-]{36}$/);
  await expect(page.getByText(`1.0.0-${run}`).first()).toBeVisible();
  await expect(page.getByText(commitMessage)).toBeVisible();
});

test('8 · creates, autosaves and reads a technical note', async () => {
  // "New note" opens the editor — not a side panel for a note called "new".
  await page.goto('/notes');
  await page.getByRole('link', { name: 'New note' }).first().click();
  await expect(page).toHaveURL(/\/notes\/new$/);
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.goto(`/notes/new?project_id=${projectId}`);
  await page.getByLabel('Title').fill(noteTitle);

  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.type('Run the migration before restarting.');
  await page.getByRole('button', { name: 'Create note' }).click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}\/edit$/);

  // Editing an existing note saves by itself and says so.
  await page.locator('.ProseMirror').getByText('Run the migration before restarting.').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type(`Autosaved line ${run}`);
  await expect(page.getByText(/Saved \d/).first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: noteTitle, level: 1 })).toBeVisible();
  await expect(page.getByText('Run the migration before restarting.')).toBeVisible();

  // It survives a reload, i.e. it really was persisted.
  await page.reload();
  await expect(page.getByText(`Autosaved line ${run}`)).toBeVisible();
});

test('9 · finds records through global search', async () => {
  const search = page.getByRole('textbox', { name: 'Search everything' }).first();
  await search.fill(run);
  await search.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=/);

  await expect(page.getByRole('link', { name: new RegExp(commitMessage) })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(noteTitle) })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(project) }).first()).toBeVisible();

  // A hash prefix finds the commit as well.
  await page.goto(`/search?q=${commitHash.slice(0, 10)}`);
  await expect(page.getByRole('link', { name: new RegExp(commitMessage) })).toBeVisible();
});

test('10 · deletes the project and signs out', async () => {
  const csrf = await page.request.get('/api/v1/auth/csrf');
  const token = (await csrf.json()).data.csrf_token as string;
  const removed = await page.request.delete(`/api/v1/projects/${projectId}`, { headers: { 'X-CSRF-Token': token } });
  expect(removed.status()).toBe(204);
  projectId = '';

  await page.goto('/');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: /log out|sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);

  // The session is gone server-side, not just hidden in the UI.
  const me = await page.request.get('/api/v1/auth/me');
  expect(me.status()).toBe(401);
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login/);
});
