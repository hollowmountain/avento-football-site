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
  // Игра открытая: записаться сможет любой из ленты
  await hostPage.getByRole('button', { name: 'Публичная' }).click();

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
  // Галочка «я тоже играю» включена по умолчанию: создатель сразу в составе.
  // Счётчик выводится как «1 / 10»; полная фраза живёт в aria-label
  // прогресс-бара, поэтому проверяем её — заодно стережём доступность
  await expect(hostPage.getByLabel('1 из 10 игроков')).toBeVisible();
  await expect(hostPage.getByText('@e2e_host')).toBeVisible();

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
  await expect(playerPage.getByLabel('2 из 10 игроков')).toBeVisible();

  // --- Организатор видит игрока БЕЗ перезагрузки (SSE) ---
  await expect(hostPage.getByText('e2e-player')).toBeVisible({ timeout: 10_000 });
  await expect(hostPage.getByLabel('2 из 10 игроков')).toBeVisible();

  // --- Игрок отказывается ---
  playerPage.once('dialog', (dialog) => void dialog.accept());
  await playerPage.getByRole('button', { name: 'Не смогу прийти' }).click();
  await expect(playerPage.getByRole('button', { name: 'Я иду!' })).toBeVisible();

  // Организатор снова видит в составе только себя (SSE)
  await expect(hostPage.getByLabel('1 из 10 игроков')).toBeVisible({ timeout: 10_000 });

  await hostContext.close();
  await playerContext.close();
});

/**
 * Матч-день внутри обычной игры: организатор запускает протокол,
 * записывает гол на конкретного игрока, завершает матч и день.
 * Второй участник видит тот же протокол, но без кнопок управления.
 */
test('матч-день: протокол, гол на игрока, таблица дня', async ({ browser }) => {
  const soon = new Date(Date.now() + 30 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startsAtLocal = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(
    soon.getDate(),
  )}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`;

  const hostContext = await browser.newContext();
  await hostContext.addInitScript(() => localStorage.setItem('avento_welcome_v2_never', '1'));
  const hostPage = await hostContext.newPage();

  await hostPage.goto('/me');
  await hostPage.locator('#profile-name').fill('Менеджер Дня');
  await hostPage.locator('#profile-tag').fill('e2e_day_host');
  await hostPage.getByRole('button', { name: 'Создать профиль' }).click();
  await expect(hostPage.getByText('Ваш личный код')).toBeVisible();

  await hostPage.goto('/games/new');
  await hostPage.getByLabel('Название').fill('E2E: матч-день');
  await hostPage.getByLabel('Площадка').fill('Манеж Матч-дня');
  await hostPage.getByLabel('Адрес').fill('Протокольная улица, 7');
  await hostPage.getByRole('button', { name: 'Публичная' }).click();
  await hostPage.locator('#cg-starts').fill(startsAtLocal);
  await hostPage.waitForTimeout(2300);
  await hostPage.getByRole('button', { name: 'Создать игру' }).click();
  await expect(hostPage.getByText('Игра создана!')).toBeVisible();
  const code = (await hostPage
    .getByText(/^AVA-[A-HJ-NP-Z2-9]{4}$/)
    .first()
    .textContent())!;

  // Второй игрок: без него в дне будет одна команда
  const playerContext = await browser.newContext();
  await playerContext.addInitScript(() => localStorage.setItem('avento_welcome_v2_never', '1'));
  const playerPage = await playerContext.newPage();
  await playerPage.goto(`/games/${code}`);
  await playerPage.getByRole('button', { name: 'Я иду!' }).click();
  await playerPage.getByLabel('Имя', { exact: true }).fill('Игрок Дня');
  await playerPage.getByLabel('Никнейм').fill('e2e-day-player');
  await playerPage.waitForTimeout(2300);
  await playerPage.getByRole('button', { name: 'Записаться' }).click();
  await expect(playerPage.getByText('Вы записаны', { exact: true })).toBeVisible();

  // --- Организатор ведёт протокол ---
  await hostPage.goto(`/games/${code}/day`);
  await hostPage.getByRole('button', { name: 'Начать матч-день' }).click();
  await expect(hostPage.getByText('Кто за кого играет')).toBeVisible();

  await hostPage.getByRole('button', { name: 'Начать матч', exact: true }).click();
  // Таймер идёт — матч начался
  await expect(hostPage.locator('time')).toBeVisible();

  // Гол хозяев с выбором автора из записавшихся
  await hostPage
    .getByRole('button', { name: /^Гол: / })
    .first()
    .click();
  await expect(hostPage.getByText('Кто забил?')).toBeVisible();
  const scorers = hostPage.locator('fieldset').first().locator('button');
  await scorers.nth((await scorers.count()) > 1 ? 1 : 0).click();
  await hostPage.getByRole('button', { name: 'Записать гол' }).click();

  // Счёт живёт на сервере: второй участник видит тот же гол, но кнопок нет.
  // Селекторы ограничены main: React оставляет копию разметки в скрытом
  // буфере стриминга (div#S:0) вне main, а Playwright считает и скрытое
  await playerPage.goto(`/games/${code}/day`);
  await expect(playerPage.locator('main').getByText('Голы', { exact: true })).toBeVisible();
  await expect(
    playerPage.locator('main').getByRole('button', { name: 'Завершить матч' }),
  ).toHaveCount(0);

  await hostPage.getByRole('button', { name: 'Завершить матч' }).click();
  await expect(hostPage.getByText('Подтвердить результат?')).toBeVisible();
  await hostPage.getByRole('button', { name: 'Подтвердить' }).click();

  // Таблица дня: победитель забрал три очка
  await expect(hostPage.getByText('Таблица дня')).toBeVisible();
  await expect(hostPage.getByText('Сыгранные матчи')).toBeVisible();
  await expect(hostPage.getByText('1:0').first()).toBeVisible();

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

  // Только main: копия разметки в скрытом буфере стриминга (div#S:0)
  // лежит вне main, но в подсчёт локатора попадает
  const cardLink = 'main a[href^="/games/AVA-"]';
  const cards = await page.locator(cardLink).count();

  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(cards);

  await page.getByRole('button', { name: 'Список', exact: true }).click();
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  await expect(page.locator(cardLink)).toHaveCount(cards);
});

/**
 * Приватная игра «по ссылке»: в ленте видна, но записаться можно только
 * с ключом из ссылки организатора. Заодно проверяем выход из кабинета
 * и редактирование игры владельцем.
 */
test('приватная игра: запись только по ссылке, правка и выход', async ({ browser }) => {
  const hostContext = await browser.newContext();
  await hostContext.addInitScript(() => localStorage.setItem('avento_welcome_v2_never', '1'));
  const hostPage = await hostContext.newPage();

  await hostPage.goto('/me');
  await hostPage.locator('#profile-name').fill('Приватный Хост');
  await hostPage.locator('#profile-tag').fill('e2e_priv');
  await hostPage.getByRole('button', { name: 'Создать профиль' }).click();
  await expect(hostPage.getByText('Ваш личный код')).toBeVisible();

  await hostPage.goto('/games/new');
  await hostPage.getByLabel('Название').fill('E2E: только для своих');
  await hostPage.getByLabel('Площадка').fill('Закрытый манеж');
  await hostPage.getByLabel('Адрес').fill('Приватный переулок, 3');
  await hostPage.getByRole('button', { name: 'По ссылке' }).click();
  await hostPage.waitForTimeout(2300);
  await hostPage.getByRole('button', { name: 'Создать игру' }).click();
  await expect(hostPage.getByText('Игра создана!')).toBeVisible();
  const code = (await hostPage
    .getByText(/^AVA-[A-HJ-NP-Z2-9]{4}$/)
    .first()
    .textContent())!;

  // Организатор видит подсказку про приватность и ссылку с ключом
  await expect(hostPage.getByText('Игра приватная', { exact: false })).toBeVisible();

  // --- Чужой человек без ключа записаться не может ---
  const strangerContext = await browser.newContext();
  await strangerContext.addInitScript(() => localStorage.setItem('avento_welcome_v2_never', '1'));
  const strangerPage = await strangerContext.newPage();
  await strangerPage.goto(`/games/${code}`);
  await expect(strangerPage.locator('main').getByText('Приватная')).toBeVisible();
  await strangerPage.getByRole('button', { name: 'Я иду!' }).click();
  await strangerPage.getByLabel('Имя', { exact: true }).fill('Чужой Человек');
  await strangerPage.getByLabel('Никнейм').fill('e2e-stranger');
  await strangerPage.waitForTimeout(2300);
  await strangerPage.getByRole('button', { name: 'Записаться' }).click();
  // Сервер отказал — человек остался вне состава
  await expect(strangerPage.getByText('приватная игра', { exact: false })).toBeVisible();

  // --- По ссылке с ключом запись проходит ---
  const friendContext = await browser.newContext();
  await friendContext.addInitScript(() => localStorage.setItem('avento_welcome_v2_never', '1'));
  const friendPage = await friendContext.newPage();
  // Ключ берём из ссылки-приглашения на странице игры у организатора
  await hostPage.goto(`/games/${code}`);
  const key = await hostPage.evaluate(async (gameCode) => {
    const response = await fetch(`/api/games/${gameCode}`);
    const payload = (await response.json()) as { data?: { inviteKey?: string | null } };
    return payload.data?.inviteKey ?? '';
  }, code);
  expect(key).not.toBe('');

  await friendPage.goto(`/games/${code}?key=${key}`);
  await friendPage.getByRole('button', { name: 'Я иду!' }).click();
  await friendPage.getByLabel('Имя', { exact: true }).fill('Друг Хоста');
  await friendPage.getByLabel('Никнейм').fill('e2e-friend');
  await friendPage.waitForTimeout(2300);
  await friendPage.getByRole('button', { name: 'Записаться' }).click();
  await expect(friendPage.getByText('Вы записаны', { exact: true })).toBeVisible();

  // --- Организатор правит игру и убирает участника ---
  await hostPage.reload();
  await hostPage.getByRole('button', { name: 'Редактировать' }).click();
  await hostPage.getByLabel('Название').fill('E2E: только для своих (правка)');
  await hostPage.getByRole('button', { name: 'Сохранить' }).click();
  await expect(
    hostPage.getByRole('heading', { name: 'E2E: только для своих (правка)' }),
  ).toBeVisible();

  hostPage.once('dialog', (dialog) => void dialog.accept());
  await hostPage.getByRole('button', { name: 'Убрать из состава' }).first().click();
  await expect(hostPage.getByText('e2e-friend')).toHaveCount(0);

  // --- Выход из кабинета: профиль отвязан от браузера ---
  await hostPage.goto('/me');
  await hostPage.getByRole('button', { name: 'Выйти из аккаунта' }).click();
  await expect(hostPage.getByText('Точно хотите выйти?')).toBeVisible();
  await hostPage.getByRole('button', { name: 'Выйти из аккаунта' }).last().click();
  await expect(hostPage.getByRole('button', { name: 'Создать профиль' })).toBeVisible();

  await hostContext.close();
  await strangerContext.close();
  await friendContext.close();
});

test('несуществующая игра показывает 404-страницу', async ({ page }) => {
  // Из-за стриминга metadata Next отдаёт браузеру 200 + noindex + 404-разметку
  // (краулерам с блокирующей metadata уходит настоящий 404) — проверяем UI.
  await page.goto('/games/AVA-XXXX');
  await expect(page.getByText('404')).toBeVisible();
  await expect(page.getByText('Игра не найдена')).toBeVisible();
});
