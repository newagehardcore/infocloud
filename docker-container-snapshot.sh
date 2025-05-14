#!/bin/bash

# Create timestamp for snapshot
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p docker-backups/snapshots/$TIMESTAMP

# Commit running containers as new images
echo "Creating snapshots of running containers..."

# Frontend
docker commit infocloud-frontend infocloud-frontend-snapshot:$TIMESTAMP
docker save infocloud-frontend-snapshot:$TIMESTAMP -o docker-backups/snapshots/$TIMESTAMP/frontend.tar
echo "Frontend snapshot saved"

# Backend
docker commit infocloud-backend infocloud-backend-snapshot:$TIMESTAMP
docker save infocloud-backend-snapshot:$TIMESTAMP -o docker-backups/snapshots/$TIMESTAMP/backend.tar
echo "Backend snapshot saved"

# MongoDB
docker commit infocloud-mongodb infocloud-mongodb-snapshot:$TIMESTAMP
docker save infocloud-mongodb-snapshot:$TIMESTAMP -o docker-backups/snapshots/$TIMESTAMP/mongodb.tar
echo "MongoDB snapshot saved"

# PostgreSQL
docker commit infocloud-db infocloud-db-snapshot:$TIMESTAMP
docker save infocloud-db-snapshot:$TIMESTAMP -o docker-backups/snapshots/$TIMESTAMP/postgres.tar
echo "PostgreSQL snapshot saved"

# Miniflux
docker commit infocloud-miniflux infocloud-miniflux-snapshot:$TIMESTAMP
docker save infocloud-miniflux-snapshot:$TIMESTAMP -o docker-backups/snapshots/$TIMESTAMP/miniflux.tar
echo "Miniflux snapshot saved"

# Ollama
docker commit infocloud-ollama infocloud-ollama-snapshot:$TIMESTAMP
docker save infocloud-ollama-snapshot:$TIMESTAMP -o docker-backups/snapshots/$TIMESTAMP/ollama.tar
echo "Ollama snapshot saved"

# Create snapshot info file
echo "Snapshot created at $TIMESTAMP" > docker-backups/snapshots/$TIMESTAMP/snapshot_info.txt
echo "Docker container snapshots completed!" 