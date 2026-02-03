# Structure

web - The Face - React Vite PWA
        It lives in the browser. It doesn't talk to the database; it only talks to the API

Api - The Brain - Node/express Prisma
        It holds the database connection and the business logic

packages shared DNA
        You define your Zod Schemas and Types here ONCE.

infra - the armor?
        Nginx: A "Reverse Proxy" that sits in front of your app to handle traffic.
        Cloudflare Tunnel: The secure "pipe" that connects your local Docker to the internet.
        Scripts: Any .sh files for backing up the database or deploying to a server live here.



If you want to add a new feature (e.g., a "Post" model for a blog), your workflow is now:
    Shared: Add PostSchema to packages/shared.

    API: Add model Post to apps/api/prisma/schema.prisma.

    Sync: Run docker compose exec api ... npx prisma db push.

    Backend: Create a GET /api/posts route in apps/api/src/index.ts.

    Frontend: Use fetch('/api/posts') in apps/web/src/App.tsx.


# Setup

## Step x

docker compose build

docker compose up -d

docker-compose ps

## Initialize the Database (The Prisma "Sync")

docker-compose exec api pnpm exec prisma migrate dev --name init

some force fix:
docker-compose exec api pnpm --filter @relay/api exec prisma migrate dev --name init --url "postgresql://postgres:pass@db:5432/postgres"


# 3. Run the Migration (The Prisma 7 way):
Since Prisma 7 requires the config to find the URL, we pass the environment variable explicitly into the exec command to be 100% sure:

docker-compose exec api /bin/sh -c "DATABASE_URL=postgresql://postgres:pass@db:5432/postgres pnpm --filter @relay/api exec prisma migrate dev --name init"



cd /home/paul/projects/Relay/apps/api
pnpm exec prisma studio


### sdsd

docker compose exec -w /Relay/apps/api api /bin/sh -c "DATABASE_URL=postgresql://postgres:pass@db:5432/postgres npx prisma db push"

curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"name":"Paul","email":"paul@relay.dev"}'

docker compose exec db psql -U postgres -d postgres -c "SELECT * FROM \"User\";"

docker compose logs -f api



## Update DB
docker compose exec -w /Relay/apps/api api npx prisma db push



docker compose -f docker-compose.dev.yml exec api sh -lc   "cd /app/apps/api && pnpm exec prisma migrate deploy"


docker compose -f docker-compose.prod.yml pull


docker compose -f docker-compose.prod.yml up -d --force-recreate
