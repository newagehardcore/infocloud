# Use Node.js LTS version
FROM node:20-alpine as build

# Set working directory
WORKDIR /app

# Set environment variable for API base URL - using localhost for browser access
ENV REACT_APP_API_BASE_URL=http://localhost:5001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy the build output from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["nginx", "-g", "daemon off;"] 