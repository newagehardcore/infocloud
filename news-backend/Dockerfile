# Use an appropriate Node.js version
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
# This layer is cached if package files don't change
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the application code
# This will be overwritten by the volume mount in compose, but good practice
COPY . .

# Expose the port the app runs on (ensure it matches PORT env var)
EXPOSE 5001

# Default command (can be overridden by compose)
# We use 'npm run dev' in compose, so this isn't strictly needed there,
# but good for building standalone.
CMD ["node", "src/app.js"] 