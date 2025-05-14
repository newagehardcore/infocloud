# INFOCLOUD - Deployment Guide

This document provides instructions for deploying the "INFOCLOUD" real-time news tag cloud application using Docker.

## Prerequisites

- Docker and Docker Compose
- Git for cloning the repository
- A server with sufficient resources to run all containers:
  - At least 4GB RAM recommended
  - At least 20GB free disk space
  - Linux-based OS recommended (Ubuntu 20.04+ or similar)

## Deployment Options

### Option 1: Local Deployment

1. Clone the repository:
```
git clone <repository-url>
cd infocloud
```

2. Start all containers:
```
docker-compose up -d
```

3. Access the application:
   - Frontend: http://localhost:3000
   - Admin interface: http://localhost:5001/admin.html
   - Miniflux interface: http://localhost:8080 (Default credentials: admin/adminpass)

4. Generate a Miniflux API key:
   - Log in to Miniflux at http://localhost:8080
   - Go to Settings > API Keys
   - Create a new API key
   - Update the API key in docker-compose.yml under the backend service environment variables

5. Restart the backend container to apply the API key:
```
docker-compose restart backend
```

### Option 2: Production Server Deployment

1. Clone the repository on your server:
```
git clone <repository-url>
cd infocloud
```

2. Configure environment variables for production:
   - Create a `.env` file in the project root with the following variables:
   ```
   POSTGRES_USER=miniflux
   POSTGRES_PASSWORD=<secure-password>
   MONGO_INITDB_ROOT_USERNAME=superadmin
   MONGO_INITDB_ROOT_PASSWORD=<secure-password>
   MINIFLUX_ADMIN_PASSWORD=<secure-password>
   ```

3. Update the docker-compose.yml file for production:
   - Add or update the following in the frontend service:
   ```yaml
   environment:
     - NODE_ENV=production
   ```
   - Add or update the following in the backend service:
   ```yaml
   environment:
     - NODE_ENV=production
     - MONGODB_URI=mongodb://superadmin:${MONGO_INITDB_ROOT_PASSWORD}@mongodb:27017/infocloud?authSource=admin
   ```

4. Set up a reverse proxy (Nginx recommended):
   - Install Nginx: `apt-get install nginx`
   - Create a configuration file in `/etc/nginx/sites-available/infocloud`:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       
       location /api {
           proxy_pass http://localhost:5001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       
       location /admin.html {
           proxy_pass http://localhost:5001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   - Enable the site: `ln -s /etc/nginx/sites-available/infocloud /etc/nginx/sites-enabled/`
   - Test and restart Nginx: `nginx -t && systemctl restart nginx`

5. Set up SSL with Let's Encrypt:
   - Install Certbot: `apt-get install certbot python3-certbot-nginx`
   - Obtain certificate: `certbot --nginx -d yourdomain.com`

6. Start the application:
```
docker-compose up -d
```

7. Follow steps 4-5 from the Local Deployment section to set up the Miniflux API key.

### Option 3: Kubernetes Deployment

For larger scale deployments, Kubernetes is recommended. Here's a basic outline:

1. Create Kubernetes manifests for each service:
   - Convert docker-compose.yml to Kubernetes manifests using tools like Kompose:
   ```
   kompose convert -f docker-compose.yml
   ```

2. Apply the manifests:
```
kubectl apply -f k8s/
```

3. Set up an Ingress controller for external access.

## Data Management

### Volumes and Persistence

The application uses Docker volumes for data persistence:

- MongoDB data: `./docker/mongodb:/data/db`
- PostgreSQL data: `./docker/postgres:/var/lib/postgresql/data`
- Ollama models: `./docker/ollama_data:/root/.ollama`

### Backup Strategy

1. MongoDB backup:
```
docker exec infocloud-mongodb mongodump --username superadmin --password <password> --authenticationDatabase admin --db infocloud --out /data/backup
docker cp infocloud-mongodb:/data/backup ./backup/mongodb_$(date +%Y%m%d)
```

2. PostgreSQL backup:
```
docker exec infocloud-db pg_dump -U miniflux miniflux > ./backup/miniflux_$(date +%Y%m%d).sql
```

3. Automate backups with a cron job:
```
0 2 * * * /path/to/backup-script.sh
```

## Monitoring and Maintenance

### Logs

View container logs:
```
# All containers
docker-compose logs -f

# Specific container
docker logs infocloud-backend -f
```

### Container Health

Check container status:
```
docker-compose ps
```

### Resource Usage

Monitor resource usage:
```
docker stats
```

### Updates

1. Pull the latest code:
```
git pull
```

2. Rebuild and restart containers:
```
docker-compose up -d --build
```

## Troubleshooting

### Common Issues

1. **Container fails to start**:
   - Check logs: `docker logs <container-name>`
   - Verify environment variables are set correctly
   - Ensure required volumes exist and have proper permissions

2. **Backend can't connect to MongoDB or Miniflux**:
   - Ensure all containers are running: `docker-compose ps`
   - Check network connectivity: `docker network inspect infocloud_default`
   - Verify credentials in environment variables

3. **Frontend shows blank page or can't connect to backend**:
   - Check browser console for errors
   - Verify the API URL is set correctly in the frontend environment
   - Check CORS configuration

4. **Ollama container crashes or has high resource usage**:
   - Ensure your server has sufficient RAM (at least 4GB)
   - Check if GPU acceleration is available and configured
   - Consider using a smaller LLM model

### Restarting Services

Restart a specific service:
```
docker-compose restart <service-name>
```

Restart all services:
```
docker-compose restart
```

## Performance Optimization

1. **Frontend Optimization**:
   - Enable production mode in the frontend build
   - Consider using a CDN for static assets

2. **Backend Optimization**:
   - Adjust MongoDB connection pool size based on load
   - Implement caching for frequently accessed data

3. **LLM Optimization**:
   - Use a smaller model if performance is an issue
   - Consider GPU acceleration for Ollama if available

4. **Container Resource Limits**:
   - Add resource constraints to containers in docker-compose.yml:
   ```yaml
   services:
     backend:
       # ...
       deploy:
         resources:
           limits:
             cpus: '0.5'
             memory: 512M
   ```
