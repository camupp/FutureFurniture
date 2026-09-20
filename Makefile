TXT_BOLD := \033[1m
TXT_MAGENTA := \033[35m
TXT_CYAN := \033[36m
TXT_RESET := \033[0m

.DEFAULT_GOAL := help

.PHONY: help setup setup-e2e setup-all dev start preview build typecheck lint lint-fix format format-check test test-watch test-coverage test-e2e check ci audit

define section
@printf '$(TXT_BOLD)$(TXT_MAGENTA)========================= %-16s =========================$(TXT_RESET)\n' '$(1)'
endef

help:
	@printf '$(TXT_BOLD)$(TXT_CYAN)FutureFurniture — доступные команды$(TXT_RESET)\n\n'
	@printf '  $(TXT_BOLD)make setup$(TXT_RESET)          Установить npm-зависимости из lock-файла\n'
	@printf '  $(TXT_BOLD)make setup-e2e$(TXT_RESET)      Установить Chromium для Playwright\n'
	@printf '  $(TXT_BOLD)make setup-all$(TXT_RESET)      Полностью подготовить окружение\n'
	@printf '  $(TXT_BOLD)make dev$(TXT_RESET)            Запустить dev-сервер\n'
	@printf '  $(TXT_BOLD)make preview$(TXT_RESET)        Открыть локальную production-сборку\n'
	@printf '  $(TXT_BOLD)make build$(TXT_RESET)          Собрать приложение\n'
	@printf '  $(TXT_BOLD)make lint$(TXT_RESET)           Запустить Oxlint и TypeScript\n'
	@printf '  $(TXT_BOLD)make lint-fix$(TXT_RESET)       Исправить безопасные lint-ошибки\n'
	@printf '  $(TXT_BOLD)make format$(TXT_RESET)         Отформатировать код через Prettier\n'
	@printf '  $(TXT_BOLD)make format-check$(TXT_RESET)   Проверить форматирование без изменений\n'
	@printf '  $(TXT_BOLD)make test$(TXT_RESET)           Запустить быстрые тесты Vitest\n'
	@printf '  $(TXT_BOLD)make test-watch$(TXT_RESET)     Запустить Vitest в watch-режиме\n'
	@printf '  $(TXT_BOLD)make test-coverage$(TXT_RESET)  Построить отчёт покрытия\n'
	@printf '  $(TXT_BOLD)make test-e2e$(TXT_RESET)       Запустить Playwright в Chromium\n'
	@printf '  $(TXT_BOLD)make check$(TXT_RESET)          Lint, формат, типы, тесты и сборка\n'
	@printf '  $(TXT_BOLD)make ci$(TXT_RESET)             Полная проверка, включая E2E\n'
	@printf '  $(TXT_BOLD)make audit$(TXT_RESET)          Проверить npm-зависимости\n'

setup:
	$(call section,NPM INSTALL)
	@npm ci

setup-e2e:
	$(call section,PLAYWRIGHT)
	@npx playwright install chromium

setup-all:
	@$(MAKE) setup
	@$(MAKE) setup-e2e

dev:
	$(call section,DEV SERVER)
	@npm run dev

start: dev

preview:
	$(call section,PREVIEW)
	@npm run preview

build:
	$(call section,BUILD)
	@npm run build

typecheck:
	$(call section,TYPESCRIPT)
	@npm run typecheck

lint:
	$(call section,OXLINT)
	@npm run lint
	$(call section,TYPESCRIPT)
	@npm run typecheck

lint-fix:
	$(call section,OXLINT FIX)
	@npm run lint:fix

format:
	$(call section,PRETTIER)
	@npm run format

format-check:
	$(call section,FORMAT CHECK)
	@npm run format:check

test:
	$(call section,VITEST)
	@npm test

test-watch:
	$(call section,VITEST WATCH)
	@npm run test:watch

test-coverage:
	$(call section,COVERAGE)
	@npm run test:coverage

test-e2e:
	$(call section,PLAYWRIGHT)
	@npm run test:e2e

check:
	$(call section,CHECK)
	@npm run check

ci:
	$(call section,FULL CHECK)
	@npm run check:all

audit:
	$(call section,NPM AUDIT)
	@npm audit --audit-level=high
