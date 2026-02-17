# OJS Docker Installation - Quick Reference

## One-Command Setup (After Docker is Installed)

```powershell
# From your project directory
cd c:\Users\charl\Desktop\Conexus

# Start everything
docker-compose up -d

# Wait 2-3 minutes for initialization, then access:
# http://localhost:8080
```

## Key Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| OJS (Direct) | `http://localhost:8080` | Journal management |
| Nginx Proxy | `http://localhost` | Production proxy |
| PostgreSQL | `localhost:5432` | Database (internal only) |

## Default Credentials (Change for production!)

- **Database User**: ojs_user
- **Database Password**: ojs_password_change_me
- **Database Name**: ojs_db

## Most Used Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f ojs

# Check status
docker-compose ps

# Restart services
docker-compose restart
```

## Volumes (Data Persistence)

Your data is stored in Docker volumes:
- `ojs-data` - All OJS files and uploads
- `db-data` - PostgreSQL database

Data persists between container restarts!

## Troubleshooting Checklist

- [ ] Docker Desktop is running?
- [ ] 2-3 minutes waited for startup?
- [ ] Ports 80, 8080, 443 are available?
- [ ] Check logs: `docker-compose logs`

For more details, see **OJS-DOCKER-SETUP.md**
