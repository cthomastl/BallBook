# ─────────────────────────────────────────────
# Stage 1: Build the React application
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile || npm install

# Copy source files
COPY public ./public
COPY src ./src

# Build for production
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Serve with a lightweight static server
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install 'serve' globally
RUN npm install -g serve

# Copy the built output from the builder stage
COPY --from=builder /app/build ./build

EXPOSE 3000

# Serve the build directory on port 3000
CMD ["serve", "-s", "build", "-l", "3000"]
