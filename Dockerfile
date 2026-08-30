# Backend container for Cloud Run.
# Installs Python 3.12, Node 20 (for MCP servers), then the backend.
#
# Lives at the REPO ROOT deliberately, not backend/ — so a plain
# `gcloud run deploy --source .` or `docker build .` picks it up
# automatically, no --dockerfile flag needed. The filesystem MCP adapter
# (backend/adapters/filesystem/adapter.py) resolves its server script from
# node_modules one level above backend/, i.e. this repo-root node_modules
# populated by the top-level package.json — so the build context must stay
# the repo root regardless of where this file lives. Building from backend/
# alone as the context (the original setup) never saw that package.json,
# never ran npm install, and left backend/ flattened into /app with no real
# repo root above it — so that adapter silently failed to load and the agent
# hallucinated file writes instead of actually making them.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Install Node 20, curl, and libGL (build123d/OCP — the CAD adapter — needs
# it at import time; without it `from adapters.cad.assembly import Assembly`
# in server.py crashes the whole process on startup, not just that adapter).
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg2 \
    libgl1 \
    libglib2.0-0 \
    libxrender1 \
    libxext6 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node deps first for layer caching — this is what write_file/
# edit_file/etc. actually need at runtime (@modelcontextprotocol/server-filesystem).
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Install Python deps next, also cached independently of the app code copy.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy the rest of the repo — backend/ stays a real subfolder here, as a
# sibling of node_modules, matching PROJECT_ROOT's expectations.
COPY . .

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "server:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8080"]
