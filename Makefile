PREFIX ?= /usr/local/bin

.PHONY: install uninstall test build lint help dev

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: build ## Build and install ghsecret to PREFIX (default: /usr/local/bin)
	@cp dist/cli.js $(PREFIX)/ghsecret
	@chmod +x $(PREFIX)/ghsecret
	@echo "✓ Installed to $(PREFIX)/ghsecret"

uninstall: ## Remove ghsecret from PREFIX
	@rm -f $(PREFIX)/ghsecret && echo "✓ Removed $(PREFIX)/ghsecret"

build: ## Build TypeScript
	@npm run build

dev: ## Watch mode
	@npm run dev

test: ## Run tests
	@npm test

lint: ## Type check
	@npm run lint
