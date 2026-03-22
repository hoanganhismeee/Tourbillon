COMPOSE := docker compose

.PHONY: up down reset dev logs frontend \
        up-cpu up-nvidia detect-gpu gpu-detect seed-editorial help

# ---- Auto-detect GPU and start the right stack ----

up:
	@GPU=$$($(MAKE) -s detect-gpu); \
	echo "==> Detected GPU: $$GPU"; \
	if [ "$$GPU" = "nvidia" ]; then \
		$(MAKE) up-nvidia; \
	else \
		$(MAKE) up-cpu; \
	fi

up-cpu:
	@echo "==> Starting stack (CPU only)..."
	$(COMPOSE) up -d --build

up-nvidia:
	@echo "==> Starting stack with NVIDIA GPU support..."
	$(COMPOSE) -f docker-compose.yml -f docker-compose.nvidia.yml up -d --build

down:
	$(COMPOSE) down

# Tear down, rebuild, bring up docker stack, then start frontend dev server.
reset:
	$(COMPOSE) down
	@GPU=$$($(MAKE) -s detect-gpu); \
	echo "==> Detected GPU: $$GPU"; \
	if [ "$$GPU" = "nvidia" ]; then \
		$(COMPOSE) -f docker-compose.yml -f docker-compose.nvidia.yml up --build -d; \
	else \
		$(COMPOSE) up --build -d; \
	fi
	cd frontend && npm run dev

# ---- Combo: start docker stack + frontend together ----

dev:
	@GPU=$$($(MAKE) -s detect-gpu); \
	if [ "$$GPU" = "nvidia" ]; then \
		$(COMPOSE) -f docker-compose.yml -f docker-compose.nvidia.yml up -d; \
	else \
		$(COMPOSE) up -d; \
	fi
	cd frontend && npm run dev

# ---- GPU detection ----

detect-gpu:
	@if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then \
		echo "nvidia"; \
	else \
		echo "cpu"; \
	fi

# Verbose GPU verification — shows driver, CUDA version, VRAM, and Docker runtime status
gpu-detect:
	@echo "=== Host GPU ==="
	@if command -v nvidia-smi >/dev/null 2>&1; then \
		nvidia-smi --query-gpu=name,driver_version,memory.total,utilization.gpu --format=csv,noheader; \
		echo ""; \
		echo "=== CUDA Version ==="; \
		nvidia-smi | grep "CUDA Version" || echo "CUDA info not available"; \
	else \
		echo "nvidia-smi not found — NVIDIA drivers not installed or not in PATH"; \
	fi
	@echo ""
	@echo "=== Docker NVIDIA Runtime ==="
	@if docker info 2>/dev/null | grep -i nvidia >/dev/null 2>&1; then \
		echo "NVIDIA runtime: available"; \
		docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi -L 2>/dev/null || echo "GPU passthrough test failed — check NVIDIA Container Toolkit"; \
	else \
		echo "NVIDIA runtime: not found in Docker (install NVIDIA Container Toolkit)"; \
	fi
	@echo ""
	@echo "=== Ollama GPU Usage (if running) ==="
	@if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "qwen2.5-7b"; then \
		docker exec qwen2.5-7b ollama ps 2>/dev/null || echo "Ollama not responding"; \
	else \
		echo "ai-service container not running"; \
	fi

# ---- Editorial seeding ----

# Stop qwen, start gemma2:9b (GPU), seed editorial content, restore qwen.
# Run once before deploy. Stack (db + backend) must be up first.
seed-editorial:
	@echo "==> Starting editorial seed (gemma2:9b)..."
	bash scripts/seed_editorial.sh

# ---- Other helpers ----

# Follow logs for all services. Pass service= to filter, e.g.:  make logs service=backend
logs:
	$(COMPOSE) logs -f $(service)

frontend:
	cd frontend && npm run dev

# ---- Help ----

help:
	@echo ""
	@echo "  make up          Auto-detect GPU and start docker stack"
	@echo "  make up-nvidia   Start stack with NVIDIA GPU (explicit)"
	@echo "  make up-cpu      Start stack CPU-only (explicit)"
	@echo "  make down        Stop docker stack"
	@echo "  make reset       Rebuild docker stack + start frontend"
	@echo "  make dev         Start docker stack then frontend (same terminal)"
	@echo "  make gpu-detect  Verbose GPU check (driver, CUDA, Docker runtime, Ollama)"
	@echo "  make logs        Follow all logs  (service=backend to filter)"
	@echo "  make frontend    Start Next.js dev server only"
	@echo "  make seed-editorial  Swap to gemma2:9b, seed story content, restore qwen"
	@echo ""
