# Cyncly Spaces Flex — подробный конкурентный teardown для FutureFurniture

**Дата исследования:** 25 сентября 2026  
**Цель:** понять, какие продуктовые и архитектурные решения Cyncly Spaces Flex особенно важны для развития FutureFurniture, какие функции уже реализованы у сильного международного аналога, что имеет смысл перенять, а что не стоит тащить в MVP.

> Этот документ основан прежде всего на официальном сайте Cyncly, официальном Support Centre, release notes 2025–2026, официальных case studies и публичных видео Cyncly/Vimeo. Где я делаю вывод об архитектуре или предлагаю решение для FutureFurniture, это явно помечено как **вывод / рекомендация**, а не как подтверждённый внутренний факт о Cyncly.

---

## 0. Короткий вывод: что самое важное у Cyncly

Если сократить весь анализ до нескольких идей, то у Cyncly особенно важны следующие решения.

### 🔥 1. Auto Design — не «нейросеть рисует кухню», а генератор поверх правил и каталога

Spaces Flex описывает Auto Design как генерацию планировки по встроенным правилам кухонного/ванного проектирования. Сгенерированный проект остаётся **полностью редактируемым**, а пользователь может запросить другой вариант через **Try Another Suggestion**.

Это очень близко к правильной архитектуре FutureFurniture:

```text
пожелания / пресет / AI
        ↓
структурированные требования
        ↓
детерминированный генератор
        ↓
геометрические + каталоговые проверки
        ↓
редактируемый обычный проект
```

**Для FutureFurniture это P0.** Не давать LLM самостоятельно принимать точные геометрические решения.

Официальный источник:  
https://is.support.cyncly.com/hc/en-us/articles/32394405806097-Spaces-Flex-Auto-Design

Публичная видео-демонстрация Auto Design:  
https://player.vimeo.com/video/1053441693

---

### 🔥 2. Каталог у Cyncly — это не просто 3D-модели

Одна из самых важных идей Cyncly: реальный товарный каталог участвует практически во всём продукте.

Каталог содержит не только изображение/3D-объект, но используется для:

- допустимой конфигурации;
- размеров;
- placement / insertion offsets;
- выбора реальных товаров при генерации;
- pricing;
- live inventory/availability;
- определения снятых с производства товаров;
- автоматической замены устаревшего товара;
- построения item list / BOM;
- дальнейшей передачи в производство.

Cyncly называет облачный слой контента **Content in Cloud (CiC)**.

**Главный вывод для FutureFurniture:** твои `семейства модулей + размерная политика + конфигурации + совместимость + оформление` — это не вспомогательная структура. Это потенциально главный moat продукта.

Источник о Content in Cloud и каталожной модели:  
https://www.cyncly.com/en-GB/resources/news/cyncly-spaces-flex-launch

---

### 🔥 3. Перед генерацией пользователь фиксирует действительно важные вещи

В R48 Cyncly существенно изменил Auto Design: система ведёт пользователя пошагово и предлагает **до генерации** разместить utilities и appliances именно там, где они должны находиться.

То есть они ушли от магической кнопки:

```text
комната → Generate
```

к более надёжной схеме:

```text
комната
→ важные неподвижные условия
→ техника/коммуникации
→ генерация
```

Это прямо соответствует твоей идее `mandatory requirements + fixed items`.

**Для FutureFurniture это P0:** не пытаться всё узнать чатом. Перед первой генерацией дать очень короткий слой обязательных ограничений.

Release notes R48:  
https://is.support.cyncly.com/hc/en-us/articles/50254919530129--Spaces-Flex-R48-Release-Notes-August-2026

Демо utilities/appliances перед Auto Design:  
https://player.vimeo.com/video/1221765869

---

### 🔥 4. Отдельный positioning engine очень важен

В R47 Cyncly пишет, что они **перестроили positioning engine**. При добавлении объекта система автоматически:

- выбирает подходящую стену / пол / угол;
- снапит объект;
- выравнивает шкафы и панели;
- ориентирует остров относительно помещения.

Это важный продуктовый урок: даже при наличии глобального генератора локальная ручная расстановка должна быть почти «магически» удобной.

В FutureFurniture уже есть привязки и smart placement. Их не стоит считать промежуточной функцией, которую позже заменит AI. Наоборот, это самостоятельный фундамент редактора.

Release notes R47:  
https://is.support.cyncly.com/hc/en-us/articles/49666250210833--Spaces-Flex-R47-Release-Notes-August-2026

Демо placement engine:  
https://player.vimeo.com/video/1216994673

---

### 🔥 5. Валидатор — отдельная система, а не часть AI

К сентябрю 2026 Spaces Flex умеет проверять проект по NKBA guidelines и, что особенно интересно, позволяет **прямо в 3D найти конкретный объект**, вызывающий проблему.

То есть сообщение не должно быть просто:

> Kitchen design has errors.

А ближе к:

> Этот шкаф нарушает правило X.  
> Выделить объект → показать конфликт → объяснить, как исправить.

Для FutureFurniture это одна из самых ценных идей.

**Рекомендация:** валидатор должен возвращать структурированный объект:

```ts
interface ValidationIssue {
  id: string
  ruleId: string
  severity: 'error' | 'warning' | 'info'
  objectIds: string[]
  message: string
  explanation: string
  suggestedActions?: ActionSuggestion[]
}
```

Release notes R49:  
https://is.support.cyncly.com/hc/en-us/articles/51016853317137--Spaces-Flex-R49-Release-Notes-September-2026

Демо NKBA validation:  
https://player.vimeo.com/video/1228011336

---

### 🔥 6. Генератор создаёт варианты, а не объявляет одно решение «правильным»

Auto Design позволяет получить другой вариант через `Try Another Suggestion`.

Для кухни это очень важно: часто существует несколько допустимых решений, и оптимальность субъективна.

FutureFurniture уже планирует несколько осмысленно различающихся кандидатов. Это стоит сохранить.

Правильный UX:

```text
Вариант A — больше рабочей поверхности
Вариант B — больше хранения
Вариант C — меньше нестандартных модулей
```

а не:

```text
AI построил идеальную кухню.
```

---

### 🔥 7. Автоматические fillers / доборы — маленькая фича с огромной ценностью

В R48:

- элементы можно resize прямо в Workbox;
- fillers автоматически подгоняются под оставшийся зазор.

Это очень близко к твоей гибридной размерной политике.

Для реального кухонного проектирования остаток ряда нельзя просто «размазать» по шкафам. Система должна понимать:

- какие модули разрешено менять;
- какие нельзя;
- сколько отдать добору;
- где добор допустим;
- когда решение надо признать плохим.

Источник R48:  
https://is.support.cyncly.com/hc/en-us/articles/50254919530129--Spaces-Flex-R48-Release-Notes-August-2026

---

### 🔥 8. AI у Cyncly больше работает с намерением и вдохновением, чем с точной геометрией

Cyncly использует AI, например, чтобы:

- анализировать inspiration image;
- находить похожие реальные товары из каталога;
- определять стили/отделки;
- определять плитку стен и пола;
- сформировать moodboard;
- beautify render;
- добавить декоративные элементы.

А точная планировка остаётся в Auto Design / rules / placement / catalog system.

Это ещё одно подтверждение архитектурного решения FutureFurniture:

**LLM/vision понимает намерение → структурированный движок изменяет проект.**

---

## 1. Что такое Cyncly и где находится Spaces Flex

Cyncly — большой международный поставщик программного обеспечения для kitchen/bath/furniture retail и manufacturing.

В их экосистеме есть несколько разных уровней:

- **Spaces Flex** — более простой web/SaaS слой inspiration + design + sales;
- **Design Flex / Winner Flex** — профессиональные дизайнерские инструменты;
- **Flex Platform** — проекты, leads, документы, workflow;
- **Content in Cloud (CiC)** — каталоги производителей и product metadata;
- **Insight** и другие продукты — manufacturing / ERP / производство;
- **3CAD** — CPQ / configurable products / sales-to-production.

Это важно, потому что Spaces Flex не пытается быть всей производственной системой внутри одного редактора.

### Очень полезная аналогия для FutureFurniture

Возможная будущая схема:

```text
FutureFurniture
  = быстрый front-end замерщика / дизайнера / продавца

БАЗИС / К3 / собственная ERP фабрики
  = подробное техническое проектирование + производство
```

Cyncly фактически использует похожее разделение между Spaces Flex и более тяжёлыми downstream-продуктами.

Источник:  
https://www.cyncly.com/products/spaces-flex

Запуск Spaces Flex:  
https://www.cyncly.com/en-GB/resources/news/cyncly-spaces-flex-launch

---

## 2. Для кого сделан Spaces Flex

Spaces Flex позиционируется не как обычный consumer floor planner, а как retail platform.

Основные сценарии:

### 2.1. Online self-service

Клиент начинает сам:

1. выбирает вдохновение;
2. задаёт пространство;
3. получает варианты;
4. сохраняет проект;
5. дальше переходит к продавцу/дизайнеру.

### 2.2. In-store assisted design

Продавец работает вместе с клиентом. Cyncly отдельно подчёркивает, что интерфейс рассчитан даже на сотрудника **без полноценного дизайнерского опыта**.

### 2.3. Professional design

Проект и собранные предпочтения передаются профессиональному дизайнеру или в более профессиональный Cyncly-инструмент.

### Урок для FutureFurniture

Твой текущий основной пользователь — замерщик. Я бы сформулировал чуть шире:

> **выездной дизайнер-замерщик / продавец-дизайнер кухни**

И сделал две UI-роли уже архитектурно, даже если MVP показывает только одну:

```text
PRO MODE
- все размеры
- предупреждения
- коммуникации
- фиксации
- detailed controls

CLIENT/PRESENTATION MODE
- минимум технической информации
- крупный 3D
- варианты
- стили
- выбор понравившегося решения
```

Cyncly уже поддерживает role-based feature availability: администратор может показывать упрощённый интерфейс shopper'у и расширенный professional-пользователю без отдельного deployment.

Источник R48:  
https://is.support.cyncly.com/hc/en-us/articles/50254919530129--Spaces-Flex-R48-Release-Notes-August-2026

---

## 3. Полный продуктовый flow Cyncly

Очень упрощённо Spaces Flex строится вокруг следующей цепочки:

```text
INSPIRATION
    ↓
STYLE / PRODUCT MATCHING
    ↓
ROOM DEFINITION / SCAN
    ↓
IMPORTANT CONSTRAINTS
    ↓
AUTO DESIGN
    ↓
TRY ANOTHER / SELECT
    ↓
MANUAL EDIT
    ↓
VALIDATION
    ↓
ITEM LIST + PRICE
    ↓
SAVE / SHARE / PDF / LEAD
    ↓
PRO DESIGN / ORDER / MANUFACTURING
```

### Почему это важно

FutureFurniture сейчас преимущественно описан вокруг:

```text
room → requirements → generator → editable sketch
```

Это хорошее ядро.

Но Cyncly показывает, что вокруг него позже можно построить ещё два слоя:

```text
до проекта:
lead + inspiration + qualification

после проекта:
quote + handoff + production integration
```

В MVP оба слоя можно оставить очень маленькими.

---

# 4. Auto Design — самая важная функция для анализа

## 4.1. Основная модель

Официальное описание Cyncly:

- генерирует kitchen/bathroom layout;
- использует built-in rules;
- основывается на planning guidelines;
- генерирует функциональный вариант;
- результат можно полностью редактировать;
- можно запросить новый suggestion.

Источник:  
https://is.support.cyncly.com/hc/en-us/articles/32394405806097-Spaces-Flex-Auto-Design

### Что это означает архитектурно — вывод

Публичная документация не раскрывает внутренний solver.

Однако внешнее поведение очень похоже на:

```text
Room model
+ Product catalog
+ Planning rules
+ User preferences
+ Layout template/preset
          ↓
Candidate generation
          ↓
Validation / scoring
          ↓
Editable design
```

Это почти один в один та модель, к которой идёт FutureFurniture.

---

## 4.2. Layout families

Cyncly явно показывает следующие семейства:

- U-shape;
- L-shape;
- I-shape;
- Galley;
- варианты с island.

В R45 добавили специальную логику island:

- отдельный toggle `Add an Island to Your Design`;
- состояние может приходить из preset;
- при включении острова набор предлагаемых layouts меняется;
- отображаются только релевантные варианты.

Источник:  
https://is.support.cyncly.com/hc/en-us/articles/47511122519057--Spaces-Flex-R45-Release-Notes-June-2026

Видео:  
https://player.vimeo.com/video/1200146770

### Что перенять

Не делать одну кнопку:

> Сгенерировать кухню

Лучше:

```text
Форма кухни
[ Авто ] [ Прямая ] [ Г-образная ] [ П-образная позже ]

Остров
[ нет ] [ если помещается ]
```

Но не заставлять человека принимать 20 решений перед генерацией.

---

## 4.3. Utilities & appliances first

В R48 Auto Design начинает направлять пользователя перед генерацией.

Пользователь сначала задаёт/размещает важную технику и utilities, а уже после этого строится layout.

Это очень сильная идея для FutureFurniture.

### Предлагаемая модель FutureFurniture

Перед запуском генератора собрать **минимальный constraint sheet**:

```ts
interface KitchenRequirements {
  layoutPreference?: 'auto' | 'linear' | 'l_shape'

  requiredAppliances: ApplianceRequirement[]

  fixedObjects: {
    objectId: string
    lockPosition?: boolean
    lockType?: boolean
    lockSize?: boolean
  }[]

  utilities: UtilityPoint[]

  movableUtilities: Record<UtilityId, 'no' | 'maybe' | 'yes'>

  priorities: {
    storage?: number
    worktop?: number
    symmetry?: number
    standardModules?: number
  }
}
```

AI может заполнить эту структуру из диалога, но пользователь должен видеть критические assumptions.

---

## 4.4. Try Another Suggestion

Это важнее, чем кажется.

Auto Design не ставит пользователя перед бинарным выбором:

```text
AI result / manual work
```

Вместо этого:

```text
Suggestion 1
Suggestion 2
Suggestion 3
```

### Как улучшить это в FutureFurniture

Не генерировать три визуально почти одинаковых решения.

Создавать diversity constraints:

```text
Variant A
максимум рабочей поверхности

Variant B
максимум хранения

Variant C
минимум нестандартных размеров
```

То есть различия должны быть объяснимыми.

---

# 5. Smart placement — отдельный фундамент

Cyncly последовательно улучшал snapping/placement.

В release notes ноября 2025 описано, что drag/drop учитывает X/Y/Z insertion offset из каталога, а разные типы объектов ведут себя по-разному:

- base units сохраняют правильный отступ;
- wall items знают свою стартовую высоту;
- floor items остаются на полу;
- wall items остаются прикреплёнными к стене.

Источник:  
https://is.support.cyncly.com/hc/fr/articles/43017172535697-Notes-de-version-Spaces-Flex-R39-Novembre-2025

В R47 placement engine ещё раз был переработан:

- автоматический snap к стене;
- floor/corner awareness;
- cabinet alignment;
- panel alignment;
- island orientation.

Источник:  
https://is.support.cyncly.com/hc/en-us/articles/49666250210833--Spaces-Flex-R47-Release-Notes-August-2026

Видео:  
https://player.vimeo.com/video/1216994673

### Урок для FutureFurniture

**Генератор и ручное размещение должны пользоваться одними геометрическими примитивами.**

Нужны функции примерно такого уровня:

```ts
findPlacementSurface(item, cursor, room)
snapToWall(item, wall)
snapToNeighbor(item, neighbor)
resolveInsertionOffset(item)
validatePlacement(item, scene)
findGapFillCandidates(gap, catalog)
```

Не писать отдельную геометрию внутри AI-generator.

---

# 6. Resizable items + smart fillers

В R48 Cyncly отдельно выделил:

> Resizable Items, Smarter Fillers

Элементы можно менять по размеру, а filler автоматически занимает оставшийся gap.

### Почему это особенно важно тебе

У FutureFurniture уже выбран гибрид:

- типовые размеры предпочтительны;
- часть шкафов допускает изменение;
- техника не растягивается;
- filler может адаптироваться.

Cyncly подтверждает продуктовую ценность такого подхода.

### Что стоит добавить в модель

```ts
interface DimensionPolicy {
  width: {
    preferred: number[]
    min?: number
    max?: number
    step?: number
    resizeMode: 'fixed' | 'catalog_options' | 'bounded'
  }
}
```

И отдельно:

```ts
interface GapResolutionRule {
  allowedFillers: CatalogFamilyId[]
  minFiller: number
  maxFiller: number
  preferredSide: 'left' | 'right' | 'split' | 'any'
}
```

---

# 7. Validation engine

## 7.1. NKBA validation

R49 добавляет более умную проверку kitchen design guidelines.

Особенно полезный UX:

- validation понимает, что проект изменился и результаты проверки могли устареть;
- предупреждает об unsaved changes;
- позволяет перейти от ошибки прямо к соответствующим объектам в 3D.

Источник:  
https://is.support.cyncly.com/hc/en-us/articles/51016853317137--Spaces-Flex-R49-Release-Notes-September-2026

Видео:  
https://player.vimeo.com/video/1228011336

### Что стоит перенять в FutureFurniture

Каждое правило должно иметь:

```ts
interface RuleDefinition {
  id: string
  version: string
  title: string
  description: string
  scope: RuleScope
  severity: RuleSeverity
  validate(ctx: ValidationContext): ValidationIssue[]
}
```

А issue должен быть связан с объектами сцены.

### Важно

FutureFurniture правильно не обещает строительную/производственную нормативную проверку.

Поэтому UI можно разделить:

```text
✓ Проверено редактором
! Требует подтверждения специалистом
? Недостаточно данных
× Известный конфликт
```

Это лучше, чем зелёная галочка `Valid kitchen`.

---

# 8. Работа с реальными товарами

Это один из главных competitive advantages Cyncly.

Auto Design и Inspire работают не только с абстрактными кубами.

Cyncly пытается довести проект до **shoppable design** — проект содержит реальные продукты retailer/manufacturer.

В августе 2026 для bathroom Auto Design Cyncly специально улучшил matching с реальными catalog products, чтобы generated fixtures не появлялись как дубликаты и результат был сразу пригоден для quote/sale.

Источник:  
https://is.support.cyncly.com/hc/en-us/articles/49666250210833--Spaces-Flex-R47-Release-Notes-August-2026

### Для FutureFurniture

В российском MVP необязательно иметь SKU каждого производителя.

Можно сделать три уровня каталога:

```text
Level 1 — Generic Profile
типовые семейства для пилота

Level 2 — Factory Profile
правила и размеры конкретной фабрики

Level 3 — Commercial Catalog
SKU + price + availability + production/export mapping
```

Ключевая задача сейчас — сделать Level 1 так, чтобы архитектура спокойно позволила перейти к Level 2.

---

# 9. Discontinued products и автоматическая замена

Очень зрелая функция Cyncly.

В феврале 2026 система уже:

- проверяла item availability через CiC API;
- показывала unavailable status;
- показывала причину;
- предупреждала пользователя.

В сентябре 2026 Cyncly пошёл дальше: система может предложить **автоматическую замену discontinued item на подходящую альтернативу**, показать preview и применить замену после подтверждения.

Release notes R49:  
https://is.support.cyncly.com/hc/en-us/articles/51016853317137--Spaces-Flex-R49-Release-Notes-September-2026

Видео:  
https://player.vimeo.com/video/1228011337

### Почему это важно стратегически

Если FutureFurniture однажды подключит реальные фабричные каталоги, нужно хранить не только ID объекта, а его lifecycle.

Например:

```ts
interface CatalogItemLifecycle {
  status: 'active' | 'deprecated' | 'discontinued'
  validFrom?: string
  validTo?: string
  replacements?: CatalogItemId[]
}
```

Это не MVP-фича, но data model лучше не проектировать так, будто catalog item вечен.

---

# 10. Inspire / AI Showroom / Moodboard

## 10.1. Image → products

При запуске Spaces Flex Cyncly описал `Inspire Image to Auto-Design`.

Пользователь загружает понравившееся изображение кухни/ванной, после чего AI ищет подходящие реальные товары в каталоге retailer'а и использует их в дизайне нового помещения.

Источник:  
https://www.cyncly.com/en-GB/resources/news/cyncly-spaces-flex-launch

### Почему идея сильная

AI не пытается создать неизвестный шкаф.

Он делает semantic mapping:

```text
reference image
    ↓
visual attributes
    ↓
known catalog attributes/products
    ↓
actual editable/shoppable design
```

Это намного полезнее, чем image generation.

---

## 10.2. Moodboard

В 2026 Cyncly добавил Moodboard flow для kitchens.

AI может предложить:

- door style;
- worktop;
- products;
- appliances.

Источник: R41 release notes:  
https://is.support.cyncly.com/hc/es/articles/44864217901841-Notas-de-la-versi%C3%B3n-Spaces-Flex-R41-Febrero-2026

### FutureFurniture

Это **не P0**.

Но позже можно сделать очень простую функцию:

> «Покажи фотографию кухни, которая нравится»

и получить:

```json
{
  "doorStyle": "shaker",
  "palette": "warm_white_oak",
  "handles": "minimal_black",
  "worktop": "light_stone"
}
```

После чего применить только существующие опции каталога.

---

## 10.3. Tiling detection

В R46 AI Showroom умеет распознавать напольную/настенную плитку на inspiration image и переносить pattern/color/style в новый Auto Design.

Moodboard позволяет заменить автоматически найденный вариант другим реальным catalog reference.

Источник R46:  
https://is.support.cyncly.com/hc/en-us/articles/48464498050065--Spaces-Flex-R46-Release-Notes-July-2026

Видео AI Showroom tiling:  
https://player.vimeo.com/video/1207385234

Видео Moodboard:  
https://player.vimeo.com/video/1207385182

### Для FutureFurniture

Общий принцип важнее плитки:

> **AI output должен ссылаться на существующие catalog IDs, а не возвращать свободный текст.**

---

# 11. AI rendering: полезно, но не ядро

Cyncly также использует AI для `Beautify` render и добавления декоративных элементов.

Интересная деталь: AI-generated renders помечаются как AI-generated, а при сбое AI API предусмотрен fallback на обычный render pipeline.

Источник: R41 release notes.  
https://is.support.cyncly.com/hc/es/articles/44864217901841-Notas-de-la-versi%C3%B3n-Spaces-Flex-R41-Febrero-2026

### Что из этого полезно FutureFurniture

Не обязательно делать AI beautify сейчас.

Но стоит перенять архитектурный принцип:

```text
core design pipeline
не должен зависеть от AI
```

Если LLM/image API недоступен:

- проект открывается;
- 2D/3D работает;
- ручные изменения работают;
- проверки работают;
- проект сохраняется.

Это уже заложено в твоём PRODUCT.md и является правильным решением.

---

# 12. LiDAR / Cyncly Scan

Spaces Flex поддерживает отдельное приложение **Cyncly Scan**.

Flow:

1. в Spaces Flex выбрать LiDAR Scan;
2. получить QR;
3. открыть Cyncly Scan на iPhone;
4. просканировать помещение;
5. получить 3D room model;
6. передать скан обратно через QR;
7. импортировать помещение в Spaces Flex.

Официальная документация:  
https://is.support.cyncly.com/hc/en-us/articles/31871716566545-Spaces-Flex-LiDAR-Scans

При запуске продукта Cyncly также заявлял автоматическое исключение мебели/fixtures/cabinets во время room scan, чтобы получить стены, окна и двери.

Источник:  
https://www.cyncly.com/en-GB/resources/news/cyncly-spaces-flex-launch

### Нужно ли это FutureFurniture сейчас?

**Нет.**

Твой roadmap правильно исключает LiDAR из первого MVP.

### Почему всё равно важно предусмотреть

Сделай room model независимым от способа ввода:

```text
manual 2D drawing
JSON import
future LiDAR
future photo recognition
```

все должны превращаться в один тип:

```ts
RoomModel
```

Тогда LiDAR станет input adapter, а не переписыванием редактора.

---

# 13. Item List, quote и pricing

Spaces Flex умеет генерировать Item List с factory items.

Официальная инструкция:  
https://is.support.cyncly.com/hc/en-us/articles/24114872007825-Spaces-Flex-How-to-generate-a-shopping-list

На capabilities-странице Cyncly показывает:

- подробный bill of materials;
- SKU / product details;
- quantities;
- prices;
- total project price;
- integration с ERP/billing;
- structured data exchange.

Источник:  
https://www.cyncly.com/products/spaces-flex/spaces-flex-capabilities

Также Spaces Flex может использовать live inventory/pricing data через Cyncly ecosystem.

### Супер-важный вывод для FutureFurniture

Даже если ты **не делаешь pricing engine сейчас**, обязательно должен существовать `ProjectItemList`.

Минимальная структура:

```ts
interface ProjectLineItem {
  projectObjectId: string
  familyId: string
  configurationId: string
  catalogItemId?: string
  width: number
  height: number
  depth: number
  quantity: number
  notes?: string[]
}
```

Позже можно добавить:

```ts
sku
unitPrice
currency
availability
productionCode
```

Если вместо этого экспорт будет просто скриншотом 3D, переход к B2B интеграциям станет гораздо сложнее.

---

# 14. Elevations и минимальная документация

Spaces Flex может автоматически формировать Elevation по стенам с размерами и сохранять их в документах проекта.

Источник:  
https://is.support.cyncly.com/hc/en-us/articles/24113951546641-Spaces-Flex-How-to-generate-design-documentation

### Что стоит сделать в FutureFurniture

Твоего «минимального пакета передачи эскиза» достаточно, если он содержит:

```text
1. cover / 3D screenshot
2. floor plan
3. wall elevations
4. основные размеры
5. item/module list
6. warnings / assumptions
7. нестандартные размеры
8. неизвестные условия
```

Это намного полезнее, чем пытаться сделать производственный чертёж.

---

# 15. PDF как интеграционный артефакт

Интересный технический момент Cyncly R41:

- они сделали более лёгкий front-end PDF generator;
- PDF может генерироваться при Save;
- JavaScript event listener реагирует на save;
- полученный PDF может уходить в downstream partner integrations.

Источник:  
https://is.support.cyncly.com/hc/es/articles/44864217901841-Notas-de-la-versi%C3%B3n-Spaces-Flex-R41-Febrero-2026

### Для FutureFurniture

Очень разумный MVP-подход:

```text
Save project
    ↓
обновить project snapshot
    ↓
опционально сформировать lightweight share package
```

Не нужен сложный document service на первом этапе.

---

# 16. Design versions

Cyncly поддерживает несколько versions/designs внутри одного project.

В R41 описана передача нескольких design versions в Flex.

В R44 появилась возможность duplicate design и продолжить редактировать копию, сохраняя структуру и attachments.

Источник R44:  
https://is.support.cyncly.com/hc/en-us/articles/46653064321937--Spaces-Flex-R44-Release-Notes-May-2026

### Очень полезно для FutureFurniture

Не обязательно делать git-like history.

Достаточно пользовательской сущности:

```text
Project
 ├── Design A — «с островом»
 ├── Design B — «без острова»
 └── Design C — «вариант клиента»
```

Undo/redo решает одну задачу. Design variants решают другую.

**Я бы добавил variants раньше сложной AI-функциональности.**

---

# 17. Leads и handoff

Spaces Flex — не просто редактор.

Если клиент:

- сохраняет проект;
- или бронирует appointment;

система создаёт lead в Flex Platform.

Lead можно:

- assign сотруднику;
- перевести в Project;
- передать вместе с дизайном в профессиональное приложение.

Источник:  
https://is.support.cyncly.com/hc/en-us/articles/35063187761681-How-does-Spaces-Flex-generate-leads

### FutureFurniture в России

Не строить CRM.

Но можно предусмотреть минимальную сущность:

```ts
interface CustomerBrief {
  customerName?: string
  phone?: string
  projectAddress?: string
  notes?: string
  preferences?: Preference[]
}
```

И экспорт webhook/JSON в будущем.

---

# 18. Deep links / переход из inspiration прямо в конкретный design flow

R45 позволяет retailer'у разместить URL на собственном сайте и открыть Spaces Flex сразу с нужным preset, минуя внутреннюю gallery.

То есть реклама/страница:

> «Кухня Nordic White»

может вести сразу в editor с этим style preset.

Источник R45:  
https://is.support.cyncly.com/hc/en-us/articles/47511122519057--Spaces-Flex-R45-Release-Notes-June-2026

### Возможное будущее FutureFurniture

Для фабрики:

```text
futurefurniture.app/new?factory=abc&preset=modern-white
```

Но это точно не P0.

---

# 19. Role-based configuration

В R48 администратор partnership может включать разные возможности для разных ролей без нового deployment.

Это особенно полезно enterprise-клиентам.

### Архитектурно стоит предусмотреть уже сейчас

Не писать в UI:

```ts
if (user === 'designer')
```

Лучше:

```ts
capabilities.canEditTechnicalConstraints
capabilities.canSeePricing
capabilities.canRunAutoDesign
capabilities.canEditCatalog
capabilities.canOverrideWarnings
```

Даже если MVP всегда возвращает один и тот же набор capabilities.

---

# 20. Kiosk mode

R47 добавляет secure kiosk mode для showroom devices:

- новая сессия для каждого посетителя;
- очистка данных между посетителями;
- устройство всегда готово к следующему клиенту.

Источник:  
https://is.support.cyncly.com/hc/en-us/articles/49666250210833--Spaces-Flex-R47-Release-Notes-August-2026

### Для FutureFurniture

Не нужно в MVP.

Но интересный потенциальный второй use case:

> планшет в кухонном салоне → клиент сам выбирает layout/style → сотрудник продолжает проект.

---

# 21. Что видно из реальных кейсов Cyncly

## 21.1. Divian

Divian — венгерский производитель кухонь.

По официальному case study:

- около 10 000 кухонь в год;
- сеть более 400 resellers;
- пилот Spaces Flex сначала на 5–10 магазинах;
- затем rollout примерно на 70 locations;
- дизайнеры осваивали инструмент примерно за 2–3 часа обучения;
- Spaces Flex интегрирован с Insight manufacturing system;
- дизайн превращается в BOM и production order;
- проект часто завершается за 1–2 часа одной встречи;
- Cyncly сообщает до 75% conversion rate у партнёров, использующих Spaces Flex;
- Cyncly сообщает manufacturing error rate ниже 1% после интеграции.

Важно: это **case study самого вендора**, поэтому цифры следует воспринимать как заявленные Cyncly/клиентом, а не как независимое исследование.

Источник:  
https://www.cyncly.com/products/spaces-flex/case-study/divian

### Главный урок

Они начали **не с rollout на всю сеть**, а с 5–10 магазинов.

Это полностью совпадает с тем, что нужно FutureFurniture:

```text
5–10 реальных дизайнеров
→ реальные кухни
→ исправление каталога и правил
→ только потом масштабирование
```

---

## 21.2. MadeiraMadeira

Бразильский retailer внедрил Spaces Flex сначала в 6 магазинах, потом расширил более чем на 50 locations.

По case study Cyncly:

- более 22 000 modular projects менее чем за 10 месяцев;
- время создания проекта снизилось примерно с двух часов до одного;
- сотрудники сами создают дизайн с клиентом вместо обращения к отдельной design team;
- вырос average order value;
- Spaces Flex стал частью onboarding новых consultants.

Источник:  
https://www.cyncly.com/products/spaces-flex/case-study/madeiramadeira

### Что особенно релевантно FutureFurniture

Cyncly здесь продаёт не «AI».

Реальная ценность:

> раньше продавец зависел от другого специалиста → теперь продавец делает проект прямо вместе с клиентом.

Для российского FutureFurniture это может быть гораздо сильнее любого AI marketing:

> **Менеджер/замерщик получает приемлемый эскиз сам, не ожидая дизайнера/конструктора для каждого первого варианта.**

---

# 22. Что показывает история релизов Cyncly

Очень полезно смотреть не только на текущий продукт, но и на то, **что большая команда вынуждена постоянно чинить**.

Это подсказка, где у FutureFurniture будут настоящие сложности.

## 22.1. Placement — сложнее, чем кажется

Cyncly многократно переписывал snapping/placement.

Known issues R47 включают:

- cabinet может попасть не в ту комнату;
- cabinet может сдвинуться при изменении камеры;
- wall cabinet может потерять attachment после добавления door/opening.

Источник: R47.

### Урок

Нужны property-based / scenario tests для placement.

---

## 22.2. Geometry dependencies быстро становятся сложными

Known issues:

- изменение толщины стены может сломать tiling;
- изменение длины стены может сдвинуть floor zones;
- transparent wall state может неправильно восстановиться после reload.

### Урок

FutureFurniture должен иметь явные dependencies:

```text
wall changes
  → openings
  → attached objects
  → zones
  → worktops
  → validations
```

а не набор UI side effects.

---

## 22.3. Generated state и manual state нужно аккуратно синхронизировать

Cyncly отдельно стабилизировал:

- presets;
- Inspire-to-Design transitions;
- Auto Design pipeline;
- project duplication;
- save synchronization;
- stale/unsaved validation state.

### Урок

Твой механизм `project version` перед применением позднего AI-response очень правильный.

Его стоит расширить до всех async операций:

```ts
request.baseProjectRevision
currentProject.revision
```

Если они различаются, результат нельзя молча применять.

---

# 23. Observability и analytics

В R44 Cyncly отдельно говорит об observability для Inspire2Design и Auto Design stability.

В релизах также видно множество telemetry events и сегментацию Consumer vs Professional.

### FutureFurniture: минимальная telemetry схема для пилота

Не нужен тяжёлый analytics stack.

Но нужны события:

```text
project_created
room_input_started
room_input_completed
first_manual_module_added
auto_design_started
auto_design_completed
auto_design_failed
suggestion_viewed
suggestion_accepted
suggestion_rejected
manual_edit_after_generation
validation_error_created
validation_error_resolved
project_exported
project_reopened
```

И времена:

```text
time_room_input
time_to_first_suggestion
time_to_accepted_design
manual_edit_count_after_generation
```

Это напрямую поддерживает метрики из твоего текущего PRODUCT.md.

---

# 24. Public API / integration possibilities

## Что подтверждено публичными источниками

Cyncly публично говорит про:

- API integrations;
- ERP/billing integration;
- live pricing integration;
- Flex Platform integration;
- Content in Cloud API / availability validation;
- structured data files;
- downstream production systems.

Примеры источников:

https://www.cyncly.com/en-GB/industries/kitchen/diy-kitchen-retailers/

https://www.cyncly.com/products/spaces-flex/spaces-flex-capabilities

https://is.support.cyncly.com/hc/es/articles/44864217901841-Notas-de-la-versi%C3%B3n-Spaces-Flex-R41-Febrero-2026

## Чего я не нашёл

На момент исследования я **не нашёл публичной developer documentation для Spaces Flex**, сопоставимой, например, с открытым Stripe/OpenAI API portal, где можно зарегистрироваться и получить полный API reference.

Публичные материалы показывают существование интеграций, но значительная их часть выглядит partnership/customer-specific.

### Практический вывод

Не стоит рассчитывать, что можно изучить внутреннюю архитектуру Spaces Flex по public API.

Их самые полезные открытые материалы для reverse product research сейчас:

1. Support Centre;
2. release notes;
3. Vimeo demos внутри release notes;
4. customer case studies;
5. product/capabilities pages;
6. webinars.

---

# 25. Исходный код Cyncly / Spaces Flex

## Результат поиска

Я отдельно искал:

- официальный Cyncly GitHub;
- Spaces Flex source code;
- Cyncly npm packages/SDK;
- публичный repository Auto Design;
- developer portal.

**Официального публичного исходного кода Spaces Flex или Auto Design я не обнаружил.**

Также не обнаружен публичный SDK, раскрывающий их генератор или geometry engine.

### Важно

Это не означает, что у Cyncly вообще нет GitHub/внутренних SDK. Это означает только:

> среди доступных публичных источников на дату исследования не найден официальный open-source repository с кодом Spaces Flex.

### Неофициальные проекты

В GitHub встречаются сторонние проекты вокруг других продуктов/форматов экосистемы Cyncly/Promob, но они **не являются исходным кодом Spaces Flex** и не должны использоваться как доказательство внутренней архитектуры Cyncly.

---

# 26. Где посмотреть живые демо

Ниже — самые полезные найденные публичные демонстрации.

## Главное

### Auto Design

https://player.vimeo.com/video/1053441693

Официальная статья:  
https://is.support.cyncly.com/hc/en-us/articles/32394405806097-Spaces-Flex-Auto-Design

### R48 — utilities & appliances → Auto Design

https://player.vimeo.com/video/1221765869

Статья:  
https://is.support.cyncly.com/hc/en-us/articles/50254919530129--Spaces-Flex-R48-Release-Notes-August-2026

### R47 — smart item placement

https://player.vimeo.com/video/1216994673

### R45 — island Auto Design

https://player.vimeo.com/video/1200146770

### R49 — NKBA validation

https://player.vimeo.com/video/1228011336

### R49 — automatic replacement of discontinued product

https://player.vimeo.com/video/1228011337

### R46 — AI Showroom tiling detection

https://player.vimeo.com/video/1207385234

### R46 — Moodboard

https://player.vimeo.com/video/1207385182

### R46 — 3D preview with sloped ceiling/tiling

https://player.vimeo.com/video/1208380921

---

## Официальный request demo

https://spaces.cyncly.com/spaces-flex-demo.html

Это sales demo, нужно оставить контакты.

---

## On-demand webinars

### Spaces Flex: Powering the Connected Kitchen & Bath Journey — 30 min

https://spaces.cyncly.com/webinar-KBFr-spaces-flex-kitchen-bathroom-EN.html

Темы:

- consumer journey;
- lead generation;
- project management;
- quoting;
- связь с Cyncly ecosystem.

### Meeting Customers Where They Are: Transforming Kitchen Sales with Spaces Flex — 48 min

https://spaces.cyncly.com/webinar-Transform-Your-Kitchen-Retail-Experience-with-Spaces-Flex.html

Темы:

- online → showroom;
- assisted sales;
- professional design;
- retail workflow.

---

# 27. Сравнение FutureFurniture и Cyncly Spaces Flex

| Область                                | FutureFurniture сейчас / план | Cyncly Spaces Flex                        | Что делать                                 |
| -------------------------------------- | ----------------------------- | ----------------------------------------- | ------------------------------------------ |
| 2D room editor                         | Уже есть                      | Есть                                      | Дорабатывать UX, не переписывать           |
| 3D derived scene                       | Уже есть                      | Есть                                      | Достаточно для MVP                         |
| Parametric cabinets                    | Частично / roadmap            | Сильный catalog-driven слой               | **P0 усилить**                             |
| Smart placement                        | Уже есть основа               | Очень развит                              | **P0**                                     |
| Auto worktops                          | Уже есть                      | Есть advanced geometry                    | Сохранить                                  |
| Fillers                                | Планируется                   | Smart fillers                             | **P0/P1**                                  |
| Auto layout                            | Roadmap                       | Production feature                        | **P0**                                     |
| Alternative suggestions                | Планируется                   | Try Another Suggestion                    | **P0**                                     |
| Appliances/utilities before generation | Планируется через constraints | Явный guided flow                         | **P0**                                     |
| Lock/fix manual decisions              | Планируется подробно          | Публично менее акцентировано              | **Возможное преимущество FutureFurniture** |
| Partial regeneration                   | Планируется                   | Не нашёл столь явного публичного описания | **Возможное преимущество**                 |
| AI natural-language edits              | Ключевой план                 | В Spaces Flex не выглядит ядром           | **Потенциальный differentiator**           |
| Rule validator                         | Уже частично                  | NKBA + object highlighting                | **P0**                                     |
| Real manufacturer catalog              | Нет                           | Центральная часть                         | Позже factory profiles                     |
| Pricing                                | Out of MVP                    | Сильный                                   | Проверить на пилоте                        |
| Item list/BOM                          | Минимальный handoff planned   | Есть                                      | **P0 минимальная версия**                  |
| Elevations/PDF                         | Минимальный пакет planned     | Есть                                      | **P1**                                     |
| LiDAR                                  | Out of MVP                    | Есть                                      | Не добавлять сейчас                        |
| Inspiration image → catalog            | Нет                           | Есть                                      | P2                                         |
| AI beautify render                     | Нет                           | Есть                                      | P3                                         |
| Leads / CRM                            | Нет                           | Есть                                      | Не строить сейчас                          |
| ERP/manufacturing integration          | Out of MVP                    | Сильный                                   | экспортный контракт на будущее             |
| Role-based UX                          | Нет                           | Есть                                      | Архитектурно предусмотреть                 |
| Kiosk                                  | Нет                           | Есть                                      | Позже                                      |

---

# 28. Где FutureFurniture потенциально может быть лучше Cyncly

Это особенно важный раздел: не нужно просто копировать лидера.

## 28.1. Natural-language локальные правки

В публичной документации Spaces Flex я не нашёл акцента на conversational workflow уровня:

> «мойку не двигай, сделай больше ящиков справа и перестрой только нижний ряд».

FutureFurniture может сделать это ядром.

Но правильная реализация:

```text
LLM
↓
typed command
↓
preview diff
↓
validation
↓
user confirms
↓
transaction applied
```

---

## 28.2. Явные locks/fixations

Твой подход с фиксацией позиции/размера/типа объекта особенно силён.

Это решает одну из главных проблем generative tools: AI не должен разрушать то, что клиент уже согласовал.

UX:

```text
🔒 position
🔒 module type
🔓 finish
```

И AI должен понимать lock как hard constraint.

---

## 28.3. Partial regeneration

Не:

> regenerate kitchen

а:

> regenerate selected run

или:

> перестрой только область между мойкой и холодильником.

Это может стать одной из самых сильных функций продукта.

---

## 28.4. Explainable tradeoffs

Cyncly даёт suggestions, но FutureFurniture может сделать их объяснение частью AI experience:

```text
Вариант 1
+ на 600 мм больше рабочей поверхности
- меньше верхнего хранения

Вариант 2
+ максимум стандартных модулей
+ меньше нестандартных элементов
- более короткая зона подготовки
```

---

# 29. Что я бы буквально добавил в roadmap FutureFurniture после изучения Cyncly

## P0 — до первого серьёзного пилота

### P0.1. Catalog semantics

Для каждого family/module:

```text
placement type
preferred dimensions
allowed resize
insertion offsets
mounting surface
front configuration
compatible appliances
compatibility constraints
style slots
```

---

### P0.2. Единый placement API

Ручное перемещение и генератор используют один engine.

---

### P0.3. Guided pre-generation constraints

До генерации показать 3–5 действительно критичных вопросов.

Например:

```text
Где холодильник?
[ выбрать на плане ] [ можно определить автоматически ]

Мойку можно переносить?
[ нет ] [ немного ] [ да ]

Нужна посудомойка?
[ 45 ] [ 60 ] [ нет ]
```

AI может предзаполнить ответы из диалога.

---

### P0.4. 2–3 alternative suggestions

С объяснением различий.

---

### P0.5. Validation issues, связанные с объектами

Клик по предупреждению → выделить объект/объекты.

---

### P0.6. Smart gap/filler policy

Не оставлять решение остатка стены на пользователя.

---

### P0.7. Minimal Item List

Даже без цены.

---

### P0.8. Design variants

`Duplicate as variant`.

---

## P1 — после первых реальных выездов

### P1.1. Factory Profile

Импорт JSON-конфига конкретной фабрики:

```json
{
  "factoryId": "demo_factory",
  "moduleFamilies": [],
  "dimensionProfiles": {},
  "styles": {},
  "rules": []
}
```

---

### P1.2. Pricing adapter

Интерфейс, а не полноценная ERP:

```ts
interface PricingProvider {
  price(project: Project): Promise<PricingResult>
}
```

Сначала может быть simple local price table.

---

### P1.3. Elevation export

---

### P1.4. Shareable customer view

Read-only web link/HTML/PDF.

---

### P1.5. Telemetry

Измерять реальное сокращение времени.

---

## P2 — когда core flow уже доказан

- inspiration image → style matching;
- semantic matching с factory catalog;
- LiDAR input adapter;
- lead integration;
- CRM webhook;
- richer pricing;
- role-based interface;
- discontinued catalog replacements.

---

## P3 — точно не сейчас

- AI beautified photorealistic renders;
- full showroom kiosk platform;
- собственная CRM;
- полноценный ERP;
- сложный e-commerce;
- универсальный интерьерный designer;
- собственный production CAD/CNC.

---

# 30. Предлагаемая архитектура с учётом уроков Cyncly

```text
┌────────────────────────────────────────────┐
│ UI                                         │
│ 2D / 3D / Catalog / AI chat / Validation   │
└──────────────────────┬─────────────────────┘
                       │
┌──────────────────────▼─────────────────────┐
│ Project Commands                           │
│ Add / Move / Resize / Replace / Lock       │
│ ApplyStyle / RegenerateRegion              │
└──────────────────────┬─────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌────▼─────────┐
│ Placement    │ │ Generator  │ │ Validator    │
│ Engine       │ │            │ │              │
└───────┬──────┘ └─────┬──────┘ └────┬─────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
┌──────────────────────▼─────────────────────┐
│ Catalog / Rule Model                       │
│ families / dimensions / compatibility      │
│ placement metadata / styles / replacements │
└──────────────────────┬─────────────────────┘
                       │
┌──────────────────────▼─────────────────────┐
│ Project State                              │
│ room / items / locks / assumptions         │
│ variants / revisions / warnings            │
└────────────────────────────────────────────┘

AI layer:

natural language / image
        ↓
Requirement parser / Command planner
        ↓
Typed commands ONLY
        ↓
Preview
        ↓
core engine above
```

### Почему эта схема хорошая

AI не знает геометрию сам.

Catalog не зависит от AI.

Manual editor и generator не расходятся.

Validator можно использовать:

- после drag;
- после generator;
- после AI command;
- перед export.

---

# 31. Какие тесты стоит добавить, посмотрев на known issues Cyncly

## Геометрия

```text
- изменить длину стены после размещения шкафов
- изменить толщину стены
- добавить окно после шкафов
- переместить дверь
- удалить стену
- создать внутреннюю перегородку
```

## Placement

```text
- floor cabinet не улетает со стены
- wall cabinet сохраняет высоту
- island не snaps к стене
- cabinet не попадает в соседнюю комнату
- drag при изменённой camera orientation
```

## Derived geometry

```text
- worktop regenerated after cabinet change
- cutout survives reload
- filler recalculates after row resize
```

## Async

```text
- AI request → пользователь изменил проект → старый ответ пришёл позже
- generate → cancel
- generate → network failure
- generate variant → undo
```

## Persistence

```text
- save/reload preserves locks
- save/reload preserves warnings
- project migration preserves catalog IDs
- missing catalog item opens project safely
```

## Catalog lifecycle

```text
- item no longer exists
- item changed dimensions
- item marked discontinued
- replacement suggested but rejected
```

---

# 32. Product metrics, которые можно перенять из философии Cyncly

Cyncly позиционирует Spaces Flex как инструмент ускорения conversion и design flow.

Для FutureFurniture лучше не измерять количество AI requests.

Измерять:

```text
T_room      — ввод комнаты
T_first     — до первого приемлемого варианта
T_accept    — до согласованного варианта
N_edits     — ручные правки после генерации
N_errors    — нарушения hard constraints
N_variants  — сколько вариантов просмотрено
Reuse       — использовал ли дизайнер продукт на следующем заказе
Export      — дошёл ли проект до передачи дальше
```

Самая сильная метрика:

> **повторное добровольное использование на следующем реальном выезде.**

---

# 33. Как я бы позиционировал FutureFurniture после анализа Cyncly

Не:

> AI kitchen generator

Не:

> российский аналог Cyncly

И не:

> новая CAD система для мебели

Лучше:

> **FutureFurniture — быстрый AI-assisted редактор для выездного дизайнера кухни: замер → несколько допустимых вариантов из правил фабрики → правки словами или вручную → согласованный эскиз → передача конструктору.**

### Возможное ключевое отличие от Cyncly

```text
Cyncly:
очень широкая retail ecosystem
+ catalog/content
+ lead/sales/ERP/manufacturing flow

FutureFurniture:
максимально быстрый field workflow
+ conversational editing
+ explicit locks
+ partial regeneration
+ российские factory profiles
```

---

# 34. Что НЕ надо делать только потому, что это есть у Cyncly

Очень важно.

Cyncly — большая зрелая платформа. Копировать scope нельзя.

### Не добавлять сейчас

- LiDAR;
- photorealistic AI render;
- e-commerce;
- appointment booking;
- CRM;
- payment;
- kiosk mode;
- многоязычную enterprise конфигурацию;
- полный pricing engine;
- inventory;
- discontinued product service;
- bathroom;
- wardrobes;
- multi-room;
- полноценную production integration.

### Почему

Твоя текущая гипотеза всё ещё гораздо уже:

> помогает ли система дизайнеру/замерщику быстрее получить приемлемый редактируемый проект кухни на объекте?

Пока эта гипотеза не доказана, всё остальное увеличивает стоимость разработки, но не уменьшает главный риск.

---

# 35. Самые важные конкретные действия для FutureFurniture

Если выбирать только **10 действий**, я бы сделал их в таком порядке:

1. **Довести catalog family model до полноценной semantic model.**
2. **Выделить placement engine как самостоятельный reusable слой.**
3. **Реализовать прямую кухню end-to-end через generator.**
4. **Перед генерацией собирать обязательную технику/фиксации/коммуникации.**
5. **Делать минимум 2 осмысленно разных suggestion.**
6. **Добавить object-linked validation issues.**
7. **Добавить fillers/gap resolution как часть генератора.**
8. **Добавить design variants / duplicate design.**
9. **Сформировать item list независимо от визуальной сцены.**
10. **После этого подключать AI-команды поверх typed project commands.**

Только после этого я бы инвестировал в image inspiration, LiDAR и красивые renders.

---

# 36. Главный стратегический вывод

Cyncly является очень сильным подтверждением того, что базовая идея FutureFurniture имеет смысл.

Но также Cyncly показывает, что ценность профессионального продукта создаёт не сама кнопка **Generate**.

Она создаётся связкой:

```text
каталог
+ правила
+ умное ручное размещение
+ генератор
+ валидация
+ редактируемый результат
+ реальные продуктовые позиции
+ понятная передача проекта дальше
```

AI находится поверх этой системы и помогает преобразовать пользовательское намерение в действия.

### Поэтому для FutureFurniture главный технологический приоритет должен быть таким:

> **Сначала построить надёжную исполняемую модель кухни. Потом делать AI максимально удобным интерфейсом к этой модели.**

Не наоборот.

---

# 37. Источники

## Официальный продукт

- Cyncly Spaces Flex  
  https://www.cyncly.com/products/spaces-flex

- Spaces Flex Capabilities  
  https://www.cyncly.com/products/spaces-flex/spaces-flex-capabilities

- Launch announcement / architecture-level product description  
  https://www.cyncly.com/en-GB/resources/news/cyncly-spaces-flex-launch

## Support Centre

- Spaces Flex Support Centre  
  https://is.support.cyncly.com/hc/en-us

- Auto Design  
  https://is.support.cyncly.com/hc/en-us/articles/32394405806097-Spaces-Flex-Auto-Design

- LiDAR Scans  
  https://is.support.cyncly.com/hc/en-us/articles/31871716566545-Spaces-Flex-LiDAR-Scans

- Item List  
  https://is.support.cyncly.com/hc/en-us/articles/24114872007825-Spaces-Flex-How-to-generate-a-shopping-list

- Design documentation / Elevations  
  https://is.support.cyncly.com/hc/en-us/articles/24113951546641-Spaces-Flex-How-to-generate-design-documentation

- Lead generation  
  https://is.support.cyncly.com/hc/en-us/articles/35063187761681-How-does-Spaces-Flex-generate-leads

## Release notes

- R49 — September 2026: NKBA validation, discontinued item replacement  
  https://is.support.cyncly.com/hc/en-us/articles/51016853317137--Spaces-Flex-R49-Release-Notes-September-2026

- R48 — August 2026: guided Auto Design, utilities/appliances, fillers, role configuration  
  https://is.support.cyncly.com/hc/en-us/articles/50254919530129--Spaces-Flex-R48-Release-Notes-August-2026

- R47 — August 2026: positioning engine, kiosk, catalog-product matching  
  https://is.support.cyncly.com/hc/en-us/articles/49666250210833--Spaces-Flex-R47-Release-Notes-August-2026

- R46 — July 2026: AI Showroom/Moodboard tiling, previews  
  https://is.support.cyncly.com/hc/en-us/articles/48464498050065--Spaces-Flex-R46-Release-Notes-July-2026

- R45 — June 2026: island Auto Design, backsplash geometry, deep links  
  https://is.support.cyncly.com/hc/en-us/articles/47511122519057--Spaces-Flex-R45-Release-Notes-June-2026

- R44 — May 2026: Auto Design stabilization, variants/duplication  
  https://is.support.cyncly.com/hc/en-us/articles/46653064321937--Spaces-Flex-R44-Release-Notes-May-2026

- R41 — February 2026: Moodboard, PDF, design versions, discontinued status  
  https://is.support.cyncly.com/hc/es/articles/44864217901841-Notas-de-la-versi%C3%B3n-Spaces-Flex-R41-Febrero-2026

- R39 — November 2025: snapping/placement refactor  
  https://is.support.cyncly.com/hc/fr/articles/43017172535697-Notes-de-version-Spaces-Flex-R39-Novembre-2025

## Case studies

- Divian / design → manufacturing  
  https://www.cyncly.com/products/spaces-flex/case-study/divian

- MadeiraMadeira / in-store assisted design  
  https://www.cyncly.com/products/spaces-flex/case-study/madeiramadeira

## Demo / webinars

- Request a Spaces Flex demo  
  https://spaces.cyncly.com/spaces-flex-demo.html

- Connected Kitchen & Bath Journey webinar  
  https://spaces.cyncly.com/webinar-KBFr-spaces-flex-kitchen-bathroom-EN.html

- Transforming Kitchen Sales webinar  
  https://spaces.cyncly.com/webinar-Transform-Your-Kitchen-Retail-Experience-with-Spaces-Flex.html

## Vimeo feature demos

- Auto Design  
  https://player.vimeo.com/video/1053441693

- R48 Utilities & Appliances  
  https://player.vimeo.com/video/1221765869

- R47 Item Placement  
  https://player.vimeo.com/video/1216994673

- R45 Kitchen Island Auto Design  
  https://player.vimeo.com/video/1200146770

- R49 NKBA Validation  
  https://player.vimeo.com/video/1228011336

- R49 Automatic Replacement  
  https://player.vimeo.com/video/1228011337

- R46 AI Showroom Tiling  
  https://player.vimeo.com/video/1207385234

- R46 Moodboard  
  https://player.vimeo.com/video/1207385182

- R46 Sloped Ceiling / Tiling Preview  
  https://player.vimeo.com/video/1208380921

---

# 38. Приоритет чтения/просмотра, если времени мало

Если изучать Cyncly самостоятельно, я бы шёл так:

```text
1. Auto Design Vimeo
2. R48 Utilities & Appliances video
3. R47 Item Placement video
4. R49 NKBA Validation video
5. R45 Island Auto Design video
6. Divian case study
7. MadeiraMadeira case study
8. Spaces Flex launch article
9. R41/R44/R47/R48/R49 release notes
10. webinars
```

Первые пять материалов дадут больше всего полезных идей непосредственно для текущей разработки FutureFurniture.

---

**Итог:** не копировать Cyncly целиком. Копировать их зрелые принципы: catalog-driven model, rule-based generator, smart placement, editable alternatives, object-level validation, structured handoff и надёжное разделение AI и геометрического ядра. А отличаться FutureFurniture может conversational editing, explicit locks, partial regeneration, field-first UX и быстрым подключением правил конкретных российских мебельных производств.
