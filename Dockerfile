# 1. Use Node.js (Alpine Linux is smaller and faster)
FROM node:20-alpine

# 2. Enable pnpm (It comes with Node 20, just needs enabling)
RUN corepack enable

# 3. Set the working directory inside the container
WORKDIR /app

# 4. Copy package files first (better caching)
COPY package.json pnpm-lock.yaml ./

# 5. Install dependencies
RUN pnpm install --frozen-lockfile

# 6. Copy the rest of your source code
COPY . .

# 7. Build the NestJS app
RUN pnpm run build

# 8. Expose the port your app runs on
EXPOSE 3000

# 9. Start the app
CMD ["node", "dist/main"]