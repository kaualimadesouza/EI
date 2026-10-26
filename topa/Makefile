.PHONY: run down logs test test-web test-api lint lint-web lint-api

# postgres + api + web with reload; the kiosk opens at http://localhost:5180
run: ; docker compose up --build
down: ; docker compose down
logs: ; docker compose logs -f

test: test-web test-api
test-web: ; cd web && npm test
# the api suite runs against the compose postgres (host port 5435)
test-api: ; docker compose up -d --wait db && $(MAKE) -C api test

lint: lint-web lint-api
lint-web: ; cd web && npm run lint && npm run typecheck
lint-api: ; $(MAKE) -C api lint
