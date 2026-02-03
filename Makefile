.PHONY: up down reindex clean help

# Default target
help:
	@echo "Available commands:"
	@echo "  make up      - Start all services (Postgres, indexer, web)"
	@echo "  make down    - Stop all services"
	@echo "  make reindex - Reset indexer state and reprocess from START_BLOCK"
	@echo "  make clean   - Stop services and remove volumes"

# Start all services
up:
	@echo "Starting analytics dashboard stack..."
	@docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5
	@echo "Running database migrations..."
	@docker-compose exec web npx prisma migrate deploy || docker-compose exec web npx prisma db push
	@echo ""
	@echo "✓ Stack is running!"
	@echo "  - Web app: http://localhost:3000"
	@echo "  - Postgres: localhost:5432"
	@echo "  - Indexer: running in background"

# Stop all services
down:
	@echo "Stopping analytics dashboard stack..."
	@docker-compose down

# Reindex: reset indexer state and reprocess from START_BLOCK
reindex:
	@echo "Reindexing from START_BLOCK..."
	@docker-compose exec -T indexer node scripts/reindex.js || docker-compose exec indexer node scripts/reindex.js
	@echo "Restarting indexer..."
	@docker-compose restart indexer
	@echo "✓ Indexer will begin from START_BLOCK"

# Clean: stop services and remove volumes
clean:
	@echo "Stopping services and removing volumes..."
	@docker-compose down -v
	@echo "✓ Cleaned up"
