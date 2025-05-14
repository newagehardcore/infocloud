#!/bin/bash

# Check if a timestamp is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <timestamp>"
  echo "Available snapshots:"
  ls -1 docker-backups/snapshots
  exit 1
fi

TIMESTAMP=$1

# Check if snapshot directory exists
if [ ! -d "docker-backups/snapshots/$TIMESTAMP" ]; then
  echo "Snapshot directory not found: docker-backups/snapshots/$TIMESTAMP"
  echo "Available snapshots:"
  ls -1 docker-backups/snapshots
  exit 1
fi

# Stop existing containers
echo "Stopping existing containers..."
docker-compose down

# Load snapshot images
echo "Loading snapshot images..."

# Frontend
docker load -i docker-backups/snapshots/$TIMESTAMP/frontend.tar
echo "Frontend snapshot loaded"

# Backend
docker load -i docker-backups/snapshots/$TIMESTAMP/backend.tar
echo "Backend snapshot loaded"

# MongoDB
docker load -i docker-backups/snapshots/$TIMESTAMP/mongodb.tar
echo "MongoDB snapshot loaded"

# PostgreSQL
docker load -i docker-backups/snapshots/$TIMESTAMP/postgres.tar
echo "PostgreSQL snapshot loaded"

# Miniflux
docker load -i docker-backups/snapshots/$TIMESTAMP/miniflux.tar
echo "Miniflux snapshot loaded"

# Ollama
docker load -i docker-backups/snapshots/$TIMESTAMP/ollama.tar
echo "Ollama snapshot loaded"

# Update docker-compose.yml to use snapshot images
echo "Updating docker-compose.yml to use snapshot images..."
cp docker-compose.yml docker-compose.yml.bak
sed -i '' "s|image: miniflux/miniflux:latest|image: infocloud-miniflux-snapshot:$TIMESTAMP|g" docker-compose.yml
sed -i '' "s|image: postgres:14-alpine|image: infocloud-db-snapshot:$TIMESTAMP|g" docker-compose.yml
sed -i '' "s|image: mongo:6.0|image: infocloud-mongodb-snapshot:$TIMESTAMP|g" docker-compose.yml

# Update build sections to use image instead
sed -i '' "s|build:|image: infocloud-frontend-snapshot:$TIMESTAMP\\n    # build:|g" docker-compose.yml
sed -i '' "s|context: ./news-backend|image: infocloud-backend-snapshot:$TIMESTAMP\\n      # context: ./news-backend|g" docker-compose.yml
sed -i '' "s|context: ./docker/ollama|image: infocloud-ollama-snapshot:$TIMESTAMP\\n      # context: ./docker/ollama|g" docker-compose.yml

# Start containers with snapshot images
echo "Starting containers with snapshot images..."
docker-compose up -d

echo "Docker container snapshots restored from $TIMESTAMP!" 