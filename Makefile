.PHONY: up down reset logs frontend dev help

# ---- Docker (backend + db + ai-service) ----

up:
	docker compose up -d

down:
	docker compose down

# Tear down, then bring everything back up, then start the frontend dev server.
# The frontend runs in a new terminal window so it doesn't block this shell.
reset:
	docker compose down
	docker compose up -d
	$(MAKE) frontend

# Follow logs for all services. Pass service= to filter, e.g.:
#   make logs service=backend
logs:
	docker compose logs -f $(service)

# ---- Frontend ----

frontend:
	cd frontend && npm run dev

# ---- Combo: start docker stack + frontend together ----
# Uses & to run both concurrently in the same terminal.
# Ctrl-C kills both.
dev:
	docker compose up -d && cd frontend && npm run dev

# ---- Help ----

help:
	@echo ""
	@echo "  make up          Start docker stack (detached)"
	@echo "  make down        Stop docker stack"
	@echo "  make reset       down + up + frontend dev server"
	@echo "  make dev         Start docker stack then frontend (same terminal)"
	@echo "  make logs        Follow all logs  (service=backend to filter)"
	@echo "  make frontend    Start Next.js dev server only"
	@echo ""
