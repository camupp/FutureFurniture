import { expect, test, type Page } from '@playwright/test'

const roomWalls = [
  { id: 'top', start: { x: 0, y: 0 }, end: { x: 3600, y: 0 }, thickness: 100 },
  { id: 'right', start: { x: 3600, y: 0 }, end: { x: 3600, y: 3000 }, thickness: 100 },
  { id: 'bottom', start: { x: 3600, y: 3000 }, end: { x: 0, y: 3000 }, thickness: 100 },
  { id: 'left', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, thickness: 100 },
]

const cabinetParams = { width: 600, height: 820, depth: 560, facadeColor: '#d6c09a' }

async function openProject(page: Page, state?: Record<string, unknown>) {
  await page.goto('/')
  await page.evaluate((projectState) => {
    localStorage.clear()
    if (projectState) {
      localStorage.setItem('future-furniture-project', JSON.stringify({ state: projectState, version: 0 }))
    }
  }, state)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Замер кухни' })).toBeVisible()
}

async function planSurface(page: Page) {
  const surface = page.getByTestId('room-editor').locator('.konvajs-content')
  await expect(surface).toBeVisible()
  return surface
}

test('opens the floor menu and persists a floor sewer outlet', async ({ page }) => {
  await openProject(page)
  const surface = await planSurface(page)
  const box = await surface.boundingBox()
  expect(box).not.toBeNull()

  await surface.click({ button: 'right', position: { x: box!.width / 2, y: box!.height / 2 } })
  await expect(page.getByRole('menu', { name: 'Добавить на пол' })).toBeVisible()
  await page.getByRole('menuitem', { name: /Канализация/ }).click()

  await expect(page.locator('aside')).toContainText('Крепление: пол')
  await page.reload()
  const outputCount = page.getByText('Выводов', { exact: true }).locator('xpath=following-sibling::dd[1]')
  await expect(outputCount).toHaveText('1')
})

test('opens the wall menu and creates an opening', async ({ page }) => {
  await openProject(page, {
    room: {
      walls: [{ id: 'wall', start: { x: 1000, y: 1500 }, end: { x: 3000, y: 1500 }, thickness: 100 }],
      wallHeight: 2700,
      openings: [],
      utilities: [],
    },
    furniture: [],
    viewMode: '2d',
  })
  const surface = await planSurface(page)
  const box = await surface.boundingBox()
  expect(box).not.toBeNull()

  await surface.click({ button: 'right', position: { x: box!.width / 2, y: box!.height / 2 } })
  await expect(page.getByRole('menu', { name: 'Добавить на стену' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Дверь' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Окно' }).click()
  await expect(page.locator('aside')).toContainText('Окно')
  await expect(page.locator('aside')).toContainText('Низ от пола')
})

test('keeps utility requirements on the lower sink host only', async ({ page }) => {
  const upper = {
    id: 'upper',
    type: 'cabinet',
    position: { x: 1800, y: 330 },
    elevation: 1200,
    rotation: 0,
    params: { ...cabinetParams, height: 700, depth: 320 },
    wallAnchor: { wallId: 'top', side: 'left', offset: 1800, distance: 0 },
  }
  const sink = {
    id: 'sink',
    type: 'sink',
    position: { x: 1800, y: 330 },
    elevation: 690,
    rotation: 0,
    params: { width: 600, height: 180, depth: 500, facadeColor: '#aeb4bd' },
  }
  const lower = {
    id: 'lower',
    type: 'cabinet',
    position: { x: 1800, y: 330 },
    elevation: 0,
    rotation: 0,
    params: cabinetParams,
    wallAnchor: { wallId: 'top', side: 'left', offset: 1800, distance: 0 },
  }
  const utilities = ['water', 'sewer'].map((type) => ({
    id: type,
    type,
    point: { x: 1800, y: 100 },
    height: 0,
    mount: { kind: 'floor' },
  }))

  await openProject(page, {
    room: { walls: roomWalls, wallHeight: 2700, openings: [], utilities },
    furniture: [upper, sink, lower],
    viewMode: '2d',
  })

  const surface = await planSurface(page)
  const box = await surface.boundingBox()
  expect(box).not.toBeNull()
  const scale = Math.min(box!.width / 4800, box!.height / 4200)
  await surface.click({
    position: {
      x: box!.width / 2,
      y: box!.height / 2 - 1000 * scale,
    },
  })
  await expect(page.locator('aside')).toContainText('Подключения совместимы: Вода, Канализация')

  await page.getByRole('button', { name: 'Фасад стены', exact: true }).click()
  const elevation = page.getByTestId('elevation-editor').locator('.konvajs-content')
  await expect(elevation).toBeVisible()
  const elevationBox = await elevation.boundingBox()
  expect(elevationBox).not.toBeNull()
  const elevationScale = Math.min(elevationBox!.width / 4800, elevationBox!.height / 3900)
  await elevation.click({
    position: {
      x: elevationBox!.width / 2,
      y: elevationBox!.height / 2 - 200 * elevationScale,
    },
  })
  await expect(page.locator('aside')).toContainText('Шкаф')
  await expect(page.locator('aside')).not.toContainText('Для мойки')
  await expect(page.locator('aside')).not.toContainText('Подключения совместимы')
})

test('exposes and toggles smart placement', async ({ page }) => {
  await openProject(page)
  const toggle = page.getByLabel('Умная расстановка')
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await expect(toggle).not.toBeChecked()
})

test('opens the selected wall elevation and switches between walls', async ({ page }) => {
  await openProject(page, {
    room: { walls: roomWalls, wallHeight: 2700, openings: [], utilities: [] },
    furniture: [],
    viewMode: '2d',
    elevationWallId: 'right',
  })

  await page.getByRole('button', { name: 'Фасад стены', exact: true }).click()
  await expect(page.getByText('Стена 2 из 4 · 3000 мм')).toBeVisible()
  await page.getByRole('button', { name: '›', exact: true }).click()
  await expect(page.getByText('Стена 3 из 4 · 3600 мм')).toBeVisible()
})

test('creates a row countertop, follows resizing, persists and switches to manual editing', async ({ page }) => {
  await openProject(page, {
    room: { walls: roomWalls, wallHeight: 2700, openings: [], utilities: [] },
    furniture: [1200, 1800].map((offset, index) => ({
      id: `base-${index}`,
      type: 'cabinet',
      position: { x: offset, y: 330 },
      elevation: 0,
      rotation: 0,
      params: cabinetParams,
      wallAnchor: { wallId: 'top', side: 'left', offset, distance: 0 },
    })),
    viewMode: '2d',
  })

  const selectBase = async (offset: number) => {
    const surface = await planSurface(page)
    const box = (await surface.boundingBox())!
    const scale = Math.min(box.width / 4800, box.height / 4200)
    await surface.click({
      position: { x: box.width / 2 + (offset - 1800) * scale, y: box.height / 2 + (330 - 1500) * scale },
    })
  }

  await selectBase(1200)
  await page.getByRole('button', { name: 'Столешница на ряд', exact: true }).click()
  const length = page.getByRole('spinbutton', { name: /^Длина/ })
  await expect(page.getByText('Автоподгон по ряду', { exact: true })).toBeVisible()
  await expect(length).toHaveValue('1200')
  await expect(length).toBeDisabled()
  await expect(page.getByRole('spinbutton', { name: /^Глубина/ })).toHaveValue('600')

  // Опоры остаются доступны на плане даже под автоматической столешницей.
  await selectBase(1800)
  await page.getByRole('spinbutton', { name: /^Ширина/ }).fill('800')
  await page.getByRole('spinbutton', { name: /^Ширина/ }).press('Enter')
  await page.getByRole('button', { name: 'Выбрать столешницу', exact: true }).click()
  await expect(length).toHaveValue('1400')

  await page.reload()
  await selectBase(1200)
  await page.getByRole('button', { name: 'Выбрать столешницу', exact: true }).click()
  await expect(length).toHaveValue('1400')
  await expect(length).toBeDisabled()
  await page.getByRole('button', { name: 'Редактировать вручную', exact: true }).click()
  await expect(length).toBeEnabled()
  await length.fill('1600')
  await length.press('Enter')
  await expect(length).toHaveValue('1600')
  await expect(page.getByText('Автоподгон по ряду', { exact: true })).toHaveCount(0)
})
