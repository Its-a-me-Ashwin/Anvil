SHELL := /bin/bash
VENV := .venv

# Windows venv paths use Scripts/, Unix uses bin/.
ifeq ($(OS),Windows_NT)
	PY := $(VENV)/Scripts/python.exe
else
	PY := $(VENV)/bin/python
endif

# Prefer an explicit python3.12, then python3, then python.
PYTHON := $(shell command -v python3.12 2>/dev/null || command -v python3 2>/dev/null || command -v python 2>/dev/null || true)

.PHONY: help setup install recreate-venv test-all test-filesystem test-search test-cad test-circuit test-printer test-state serve clean

help:
	@echo "Make targets:"
	@echo "  setup          Create virtualenv and install requirements"
	@echo "  install        Alias for setup"
	@echo "  recreate-venv  Remove venv and run setup"
	@echo "  test-*         Run per-adapter test (e.g. make test-filesystem)"
	@echo "  test-all       Run all adapter tests"
	@echo "  serve          Run the server with uvicorn"
	@echo "  clean          Remove venv and pycache"

install: setup

setup:
	@if [ -z "$(PYTHON)" ]; then \
		echo "No suitable python found. Install python3.12 or set PYTHON in environment."; \
		exit 1; \
	fi
	$(PYTHON) -m venv $(VENV)
	$(PY) -m pip install -q --upgrade pip
	$(PY) -m pip install -q -r requirements.txt

recreate-venv: clean setup

# Adapter tests
test-filesystem:
	$(PY) -m adapters.filesystem.test_adapter

test-cad:
	$(PY) -m adapters.cad.test_adapter

test-circuit:
	$(PY) -m adapters.circuit.test_adapter

test-printer:
	$(PY) -m adapters.printer.test_adapter

test-state:
	$(PY) -m adapters.state.test_adapter

test-all: test-filesystem test-cad test-circuit test-printer test-state

# Run app locally (use uvicorn from venv)
serve:
	$(PY) -m uvicorn server:app --app-dir backend --host 0.0.0.0 --port 8080

clean:
	rm -rf $(VENV)
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -name "*.pyc" -delete
