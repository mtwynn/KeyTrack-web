# KeyTrack analysis microservice.
# Bundles the native audio tools the analysis needs (ffmpeg, libKeyFinder/
# keyfinder-cli built from source, and madmom for tempo) — none of which install
# cleanly on Heroku buildpacks, which is exactly why this is its own container.
FROM node:20-bookworm-slim

# Runtime tools (ffmpeg) + build deps for libKeyFinder & keyfinder-cli + Python
# (for the madmom tempo venv).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      git cmake build-essential ca-certificates \
      libfftw3-dev \
      libavcodec-dev libavformat-dev libavutil-dev libswresample-dev \
      python3 python3-venv python3-dev \
 && rm -rf /var/lib/apt/lists/*

# libKeyFinder (GPL-3.0) — the key-detection library the Mixxx DJ app maintains.
RUN git clone --depth 1 https://github.com/mixxxdj/libkeyfinder.git /tmp/lkf \
 && cmake -S /tmp/lkf -B /tmp/lkf/build -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF \
 && cmake --build /tmp/lkf/build --parallel \
 && cmake --install /tmp/lkf/build \
 && ldconfig \
 && rm -rf /tmp/lkf

# keyfinder-cli (GPL-3.0) — a thin CLI over libKeyFinder. We shell out to it as a
# separate process, so KeyTrack stays MIT.
RUN git clone --depth 1 https://github.com/evanpurkhiser/keyfinder-cli.git /tmp/kfc \
 && c++ -std=c++17 /tmp/kfc/keyfinder_cli.cpp -o /usr/local/bin/keyfinder-cli \
      -lkeyfinder -lavcodec -lavformat -lavutil -lswresample \
 && rm -rf /tmp/kfc

# madmom (BSD/academic) in its own venv → band-constrained tempo (bpm_madmom.py).
# Pinned numpy<2 (madmom needs it); built from git master for current
# Python/numpy compatibility. Its model files ship inside the package.
RUN python3 -m venv /opt/madmom-venv \
 && /opt/madmom-venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel \
 && /opt/madmom-venv/bin/pip install --no-cache-dir "numpy<2" cython scipy mido \
 && /opt/madmom-venv/bin/pip install --no-cache-dir --no-build-isolation \
      "git+https://github.com/CPJKU/madmom.git"

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# No hardcoded PORT — the host (Heroku/Fly/Render) injects $PORT at runtime and
# server.js binds to it (falling back to 8899 for local `docker run`).
EXPOSE 8899
CMD ["node", "server.js"]
