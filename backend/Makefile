VENV := .venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

.PHONY: setup test-all test-filesystem clean

setup:
	python3 -m venv $(VENV)
	$(PIP) install -q --upgrade pip
	$(PIP) install -q -r requirements.txt

# Add one target per adapter as it's built, and list it under test-all below.
test-filesystem:
	$(PY) -m adapters.filesystem.test_adapter

test-search:
	$(PY) -m adapters.search.test_adapter

test-all: test-filesystem test-search

clean:
	rm -rf $(VENV)
	find . -type d -name __pycache__ -exec rm -rf {} +
