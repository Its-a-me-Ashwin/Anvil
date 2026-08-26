VENV := .venv

# Windows venv paths use Scripts/, Unix uses bin/.
ifeq ($(OS),Windows_NT)
	PY := $(VENV)/Scripts/python.exe
	PIP := $(VENV)/Scripts/python.exe -m pip
else
	PY := $(VENV)/bin/python
	PIP := $(VENV)/bin/pip
endif

# Prefer an explicit python3.12 if python3 is missing or too old.
PYTHON := $(shell command -v python3 2>/dev/null || command -v python3.12 2>/dev/null || command -v python 2>/dev/null)

.PHONY: setup test-all test-filesystem test-search test-cad test-circuit test-printer test-state clean

setup:
	$(PYTHON) -m venv $(VENV)
	$(PIP) install -q --upgrade pip
	$(PIP) install -q -r requirements.txt

# Add one target per adapter as it's built, and list it under test-all below.
test-filesystem:
	$(PY) -m adapters.filesystem.test_adapter

test-search:
	$(PY) -m adapters.search.test_adapter

test-cad:
	$(PY) -m adapters.cad.test_adapter

test-circuit:
	$(PY) -m adapters.circuit.test_adapter

test-printer:
	$(PY) -m adapters.printer.test_adapter

test-state:
	$(PY) -m adapters.state.test_adapter

test-all: test-filesystem test-cad test-search test-circuit test-printer test-state

serve:
	$(PY) server.py

clean:
	rm -rf $(VENV)
	find . -type d -name __pycache__ -exec rm -rf {} +
