#!/bin/bash

# Check if backup directory exists
if [ ! -d "docker-backups/volumes" ]; then
  echo "Backup directory not found!"
  exit 1
fi

# Restore MongoDB data
echo "Restoring MongoDB data..."
docker cp docker-backups/volumes/mongodb_backup infocloud-mongodb:/data/restore
docker exec infocloud-mongodb mongorestore --username superadmin --password supersecret --authenticationDatabase admin /data/restore

# Restore PostgreSQL data
echo "Restoring PostgreSQL data..."
cat docker-backups/volumes/miniflux_backup.sql | docker exec -i infocloud-db psql -U miniflux miniflux

echo "Docker volumes restore completed!" 