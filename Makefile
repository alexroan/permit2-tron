.PHONY: install-tronbox build-tronbox tron-node-up tron-node-down migrate-tronbox test-tronbox install-foundry build-foundry test-foundry

# start local TRON node using docker
tron-node-up:
	@echo "Starting local TRON node..."
	@docker compose --profile tron up -d tron-local
	@echo "Waiting for TRON node to be ready..."
	./scripts/wait-for-tron.sh
	@echo "TRON node is running on http://localhost:9095"

# stop local TRON node
tron-node-down:
	@echo "Stopping local TRON node..."
	@docker compose --profile tron stop tron-local
	@docker compose --profile tron rm -f tron-local
	@echo "TRON node stopped"

# install contract dependencies
install-tronbox:
	@echo "Installing contract dependencies..."
	@pnpm install
	@echo "Contract dependencies installed successfully"

# build contracts using tronbox
build-tronbox:
	@echo "Building contracts with tronbox..."
	@pnpm run compile
	@echo "Contracts built successfully"

# deploy contracts to local TRON node
migrate-tronbox: tron-node-up
	@echo "Deploying contracts to local TRON node..."
	pnpm run migrate:development
	@echo "Contracts deployed successfully"

# run TVM contract tests (starts node, deploys, runs tests, stops node)
test-tronbox: install-tronbox build-tronbox
	@echo "Running TVM contract tests..."
	@$(MAKE) tron-node-down || true
	@$(MAKE) tron-node-up
	@echo "Running tests (with deployment)..."
	@pnpm run test:tronbox || (EXITCODE=$$?; $(MAKE) tron-node-down; exit $$EXITCODE)
	@$(MAKE) tron-node-down
	@echo "TVM contract tests completed"

install-foundry:
	@echo "Installing foundry..."
	@if [ ! -d "lib/forge-std/src" ]; then \
		forge install; \
	else \
		echo "Submodules already present, skipping forge install"; \
	fi
	@echo "Foundry dependencies ready"

build-foundry:
	@echo "Building foundry..."
	@forge build --sizes
	@echo "Foundry built successfully"

test-foundry: install-foundry build-foundry
	@echo "Running foundry tests..."
	@forge test -vvv
	@echo "Foundry tests completed"