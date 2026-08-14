import { expect, test } from '@playwright/test';

/**
 * Полный happy path: организатор создаёт игру и получает токен,
 * игрок из другого браузерного контекста присоединяется, организатор
 * видит его в составе без перезагрузки (SSE), игрок отказывается.
 */
test('создание игры → приглашение → вступление → live-обновление → отказ', async ({ browser }) => {
  // --- Организатор: сначала кабинет (без него создание закрыто) ---
  const hostContext = await browser.newContext();
  // Приветственное окно выбора «профиль или гость» в e2e не тестируем
  await hostContext.addInitScript(() => localStorage.setItem('avento_welcome_v2_never', '1'));
  const hostPage = await hostContext.newPage();

  await hostPage.goto('/me');
  await hostPage.locator('#profile-name').fill('Организатор E2E');
  await hostPage.locator('#profile-tag').fill('e2e_host');
  await hostPage.getByRole('button', { name: 'Создать профиль' }).click();
  await expect(hostPage.getByText('Ваш личный код')).toBeVisible();

  // --- Организатор создаёт игру ---
  await hostPage.goto('/games/new');
  await hostPage.getByLabel('Название').fill('E2E: вечерний матч');
  await hostPage.getByLabel('Площадка').fill('Стадион Тестовый');
  // Координаты не вводим: сервер определяет их по адресу.
  // Имя организатора не вводим: оно берётся из кабинета
  await hostPage.getByLabel('Адрес').fill('Тестовая улица, 1');

  // Time-trap: форма должна прожить минимум 2 секунды до сабмита
  await hostPage.waitForTimeout(2300);
  await hostPage.getByRole('button', { name: 'Создать игру' }).click();

  await expect(hostPage.getByText('Игра создана!')).toBeVisible();
  const code = (await hostPage
    .getByText(/^AVA-[A-HJ-NP-Z2-9]{4}$/)
    .first()
    .textContent())!;
  expect(code).toMatch(/^AVA-/);

  // Секретного токена больше нет: игра привязана к кабинету
  await expect(
    hostPage.getByText('Игра привязана к вашему кабинету', { exact: false }),
  ).toBeVisible();
  await expect(hostPage.getByText('Секретный токен управления')).toHaveCount(0);

  // --- Страница игры: панель организатора на месте ---
  await hostPage.getByRole('link', { name: 'К странице игры' }).click();
  await expect(hostPage.getByRole('heading', { name: 'E2E: вечерний матч' })).toBeVisible();
  await expect(hostPage.getByText('Управление игрой')).toBeVisible();
  // Счётчик состава выводится как «0 / 10»; полная фраза живёт в aria-label
  // прогресс-бара, поэтому проверяем её — заодно стережём доступность
  await expect(hostPage.getByLabel('0 из 10 игроков')).toBeVisible();

  // --- Игрок открывает ссылку в «другом браузере» ---
  const playerContext = await browser.newContext();
  await playerContext.addInitScript(() => localStorage.setItem('avento_welcome_v2_never', '1'));
  const playerPage = await playerContext.newPage();
  await playerPage.goto(`/games/${code}`);
  await expect(playerPage.getByRole('heading', { name: 'E2E: вечерний матч' })).toBeVisible();
  // У игрока нет панели организатора
  await expect(playerPage.getByText('Управление игрой')).toHaveCount(0);

  await playerPage.getByRole('button', { name: 'Я иду!' }).click();
  await playerPage.getByLabel('Имя', { exact: true }).fill('Игрок Первый');
  await playerPage.getByLabel('Никнейм').fill('e2e-player');
  await playerPage.waitForTimeout(2300);
  await playerPage.getByRole('button', { name: 'Записаться' }).click();

  await expect(playerPage.getByText('Вы записаны', { exact: true })).toBeVisible();
  await expect(playerPage.getByText('e2e-player')).toBeVisible();
  await expect(playerPage.getByLabel('1 из 10 игроков')).toBeVisible();

  // --- Организатор видит игрока БЕЗ перезагрузки (SSE) ---
  await expect(hostPage.getByText('e2e-player')).toBeVisible({ timeout: 10_000 });
  await expect(hostPage.getByLabel('1 из 10 игроков')).toBeVisible();

  // --- Игрок отказывается ---
  playerPage.once('dialog', (dialog) => void dialog.accept());
  await playerPage.getByRole('button', { name: 'Не смогу прийти' }).click();
  await expect(playerPage.getByRole('button', { name: 'Я иду!' })).toBeVisible();

  // Организатор снова видит пустой состав (SSE)
  await expect(hostPage.getByLabel('0 из 10 игроков')).toBeVisible({ timeout: 10_000 });

  await hostContext.close();
  await playerContext.close();
});

/**
 * Карта в ленте: те же игры, что и в списке, но точками на карте города.
 * Тайлы OSM здесь не нужны — проверяем переключатель и маркеры,
 * их число должно совпадать с числом карточек списка.
 */
test('лента переключается между списком и картой', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('avento_welcome_v2_never', '1'));
  await page.goto('/');

  const cards = await page.locator('a[href^="/games/AVA-"]').count();

  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(cards);

  await page.getByRole('button', { name: 'Список', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  await expect(page.locator('a[href^="/games/AVA-"]')).toHaveCount(cards);
});

test('несуществующая игра показывает 404-страницу', async ({ page }) => {
  // Из-за стриминга metadata Next отдаёт браузеру 200 + noindex + 404-разметку
  // (краулерам с блокирующей metadata уходит настоящий 404) — проверяем UI.
  await page.goto('/games/AVA-XXXX');
  await expect(page.getByText('404')).toBeVisible();
  await expect(page.getByText('Игра не найдена')).toBeVisible();
});
