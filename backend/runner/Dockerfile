FROM node:20-bullseye

# Install necessary tools for node-pty and bash
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Port for WebSocket
EXPOSE 8080

# Run the runner
CMD ["npm", "start"]
