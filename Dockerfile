# Stage 1: Build Rust server
FROM rust:1.82-bookworm AS rust-builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src-tauri/ src-tauri/
# Build only the server binary, skip tauri desktop
RUN cd src-tauri && cargo build --release --bin promin-server 2>/dev/null || \
    cargo build --release --bin promin-server --manifest-path src-tauri/Cargo.toml

# Stage 2: Build frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production image
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy server binary
COPY --from=rust-builder /app/target/release/promin-server /usr/local/bin/promin-server
# Copy frontend static files
COPY --from=frontend-builder /app/dist /app/static

# Expose ports
EXPOSE 3001

# Environment
ENV PROMIN_ADDR=0.0.0.0:3001
ENV RUST_LOG=promin_server=info
ENV RAYON_NUM_THREADS=0

CMD ["promin-server"]
