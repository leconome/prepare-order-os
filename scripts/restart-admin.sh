docker compose -f docker-compose.prod.yml --env-file .env.production build admin
docker compose -f docker-compose.prod.yml --env-file .env.production up -d admin