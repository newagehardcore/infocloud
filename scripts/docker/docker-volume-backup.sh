#!/bin/bash

# Create backup directory if it doesn't exist
mkdir -p docker-backups/volumes

# Backup MongoDB data
echo "Backing up MongoDB data..."
docker exec infocloud-mongodb mongodump --username superadmin --password supersecret --authenticationDatabase admin --db infocloud --out /data/backup
docker cp infocloud-mongodb:/data/backup docker-backups/volumes/mongodb_backup

# Backup PostgreSQL data
echo "Backing up PostgreSQL data..."
docker exec infocloud-db pg_dump -U miniflux miniflux > docker-backups/volumes/miniflux_backup.sql

# Create a timestamp for the backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
echo "Backup completed at $TIMESTAMP" > docker-backups/volumes/backup_info.txt

echo "Docker volumes backup completed!" 