echo "Building and starting admin service..."
echo "----------------------------------------"
echo ""
echo "Building admin dashboard..."
echo "----------------------------------------"
echo ""
docker compose -f docker-compose.prod.yml --env-file .env.production build admin
docker compose -f docker-compose.prod.yml --env-file .env.production up -d admin

echo "Starting admin service..."
echo "----------------------------------------"
echo ""
docker compose -f docker-compose.prod.yml --env-file .env.production build api
docker compose -f docker-compose.prod.yml --env-file .env.production up -d api

  docker compose -f docker-compose.prod.yml --env-file .env.production restart api                                                                          