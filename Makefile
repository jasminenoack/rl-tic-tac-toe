.PHONY: build up down logs lint format type-check

build:
	@echo "Building Docker images..."
	docker-compose build

up:
	@echo "Starting all services in detached mode..."
	docker-compose up -d

down:
	@echo "Stopping and removing all services..."
	docker-compose down

logs:
	@echo "Tailing logs from all services..."
	docker-compose logs -f

lint:
	@echo "Running ruff check..."
	docker-compose exec agent ruff check .

format:
	@echo "Running ruff format..."
	docker-compose exec agent ruff format .

type-check:
	@echo "Running pyright..."
	docker-compose exec agent pyright