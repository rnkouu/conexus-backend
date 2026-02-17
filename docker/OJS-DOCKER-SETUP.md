# OJS Docker Installation Guide

## Prerequisites

- Docker Desktop installed and running
- Docker Compose installed
- At least 4GB RAM available for Docker

## Quick Start

### 1. Install Docker Desktop
If you haven't already:
- **Windows**: Download from [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
- Install and restart your computer
- Enable WSL 2 backend in Docker settings

### 2. Navigate to your project directory
```bash
cd c:\Users\charl\Desktop\Conexus
```

### 3. Generate SSL Certificates (for HTTPS)
```bash
bash generate-certs.sh
```
Or on Windows PowerShell:
```powershell
$cert_dir = ".\certs"
New-Item -ItemType Directory -Path $cert_dir -Force
openssl req -x509 -newkey rsa:4096 -nodes -out $cert_dir/cert.pem -keyout $cert_dir/key.pem -days 365 -subj "/C=US/ST=State/L=City/O=Conexus/CN=localhost"
```

### 4. Start the OJS Container
```bash
docker-compose up -d
```

This will:
- Pull the OJS image
- Create PostgreSQL database
- Start Nginx reverse proxy
- Launch all services in the background

### 5. Access OJS
- **HTTP**: `http://localhost:8080` (direct OJS access)
- **HTTPS**: `https://localhost` (through Nginx proxy)

Wait 2-3 minutes for OJS to fully initialize.

## Useful Commands

### View container logs
```bash
docker-compose logs -f ojs
```

### Stop all services
```bash
docker-compose down
```

### Stop and remove all data (WARNING: deletes database)
```bash
docker-compose down -v
```

### Restart services
```bash
docker-compose restart
```

### Check container status
```bash
docker-compose ps
```

### Access OJS container shell
```bash
docker-compose exec ojs bash
```

### Access database
```bash
docker-compose exec db psql -U ojs_user -d ojs_db
```

## Configuration

### Database Credentials
- **Database**: ojs_db
- **User**: ojs_user
- **Password**: ojs_password_change_me

⚠️ **IMPORTANT**: Change the password in `docker-compose.yml` and `config/ojs-config.php` for production!

### Volumes
- `ojs-data`: OJS application files
- `db-data`: PostgreSQL data

These persist even after stopping containers.

## Production Deployment

For production, you should:

1. **Change database password**:
   - Update `POSTGRES_PASSWORD` in `docker-compose.yml`
   - Update `password` in `config/ojs-config.php`

2. **Enable HTTPS**:
   - Replace self-signed certificates with real ones
   - Place them in the `certs/` directory

3. **Set proper domain**:
   - Update `SERVERNAME` in `docker-compose.yml`
   - Update `base_url` in `config/ojs-config.php`
   - Update `server_name` in `config/nginx.conf`

4. **Enable SSL**:
   - Set `force_ssl = On` in `config/ojs-config.php`

5. **Set environment variables**:
   ```bash
   docker-compose up -d --env-file .env
   ```

## Troubleshooting

### "Port 80 already in use"
```bash
# Find what's using port 80
netstat -ano | findstr :80

# Kill the process
taskkill /PID <PID> /F
```

### "Connection refused"
- Wait for containers to fully start (2-3 minutes)
- Check logs: `docker-compose logs ojs`

### "502 Bad Gateway"
- OJS container is still starting
- Check OJS logs: `docker-compose logs ojs`

### Database connection issues
- Check db container is running: `docker-compose ps`
- Verify credentials in config files

## Integrating with Your Existing Conexus Application

To integrate OJS with your attendance portal:

1. **Create an API bridge** in your frontend:
```javascript
// Example API call to OJS
fetch('http://localhost:8080/index.php/api/v1/journals')
  .then(res => res.json())
  .then(data => console.log(data));
```

2. **Create authentication endpoint** to sync users between systems

3. **Use OJS webhooks** for event notifications

## Support

For OJS documentation: https://docs.pkp.sfu.ca/ojs/

For Docker issues: https://docs.docker.com/
