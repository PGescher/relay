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



docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml exec api sh -lc "BROWSER=none pnpm exec prisma studio --hostname 0.0.0.0 --port 5555"

cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/relay" pnpm exec prisma studio


## Update DB
docker compose exec -w /Relay/apps/api api npx prisma db push



docker compose -f docker-compose.dev.yml exec api sh -lc "pnpm exec prisma migrate dev --name add_workout_templates --schema prisma/schema.prisma"
docker compose -f docker-compose.dev.yml exec api sh -lc "pnpm exec prisma generate --schema prisma/schema.prisma"


HarD Reset Prisma generated Artifacts:
"
rm -rf apps/api/node_modules/.prisma
rm -rf apps/api/node_modules/@prisma/client
pnpm --filter @relay/api install
pnpm --filter @relay/api exec prisma generate
"

or 
ctrl+shift+P and Restart TS Server

docker compose -f docker-compose.dev.yml exec api sh -lc   "cd /app/apps/api && pnpm exec prisma migrate deploy"


docker compose -f docker-compose.prod.yml pull


docker compose -f docker-compose.prod.yml up -d --force-recreate


visu database: docker exec -it relay-api-1 sh -lc \
  'cd /app/apps/api && pnpm exec prisma studio'

Default starts on:
http://localhost:5555

Open from NAS:
ssh -L 5555:localhost:5555 user@your-nas



1️⃣ Export DATABASE_URL (same as docker-compose)

Use the same connection string as your db service:

export DATABASE_URL="postgresql://postgres:password@localhost:5432/postgres"


If Postgres is only exposed inside Docker, forward it:

# docker-compose.prod.yml
db:
  ports:
    - "5432:5432"

2️⃣ Start Prisma Studio

From apps/api:

pnpm exec prisma studio


You’ll see:

Prisma Studio is running on http://localhost:5555


Useful if DB is not exposed to localhost.

1️⃣ Exec into API container
docker exec -it relay-api-1 sh

2️⃣ Run Studio and bind all interfaces
pnpm exec prisma studio --hostname 0.0.0.0


Studio now listens on port 5555 inside the container.

3️⃣ Expose the port

In docker-compose.prod.yml:

api:
  ports:
    - "3000:3000"
    - "5555:5555"


Restart:

docker compose -f docker-compose.prod.yml up -d


Now open:
Useful if DB is not exposed to localhost.

1️⃣ Exec into API container
docker exec -it relay-api-1 sh

2️⃣ Run Studio and bind all interfaces
pnpm exec prisma studio --hostname 0.0.0.0


Studio now listens on port 5555 inside the container.

3️⃣ Expose the port

In docker-compose.prod.yml:

api:
  ports:
    - "3000:3000"
    - "5555:5555"


Restart:

docker compose -f docker-compose.prod.yml up -d


Now open:
http://NAS-IP:5555


# Build index.ts:

pnpm --filter @relay/shared build

or

cd packages/shared
pnpm build

# Prisma

Prisma ist ein ORM + Schema + Migration Tool
Prisma generiert und nutzt SQL

## Regenerate Prisma Client:

pnpm --filter @relay/api exec prisma generate
pnpm --filter @relay/api exec prisma migrate dev

docker compose -f docker-compose.dev.yml exec -w /Relay/apps/api api pnpm exec prisma generate
docker compose -f docker-compose.dev.yml exec -w /Relay/apps/api api pnpm exec prisma migrate dev

## Hard reset old artifacts:

rm -rf apps/api/node_modules/.prisma
rm -rf apps/api/node_modules/@prisma/client
pnpm --filter @relay/api install
pnpm --filter @relay/api exec prisma generate

## Migrations entfernen & DB clean neu aufsetzten

Migrations Squashen:
1. DB Reset (Dev)
2. migration dateien löschen
3. prisma migrate dev --name init -> neue Base
4. optional seed

### Seed
Seed skript füllt die DB mit Startdaten
- Built in Exercises
- Standard-Templates
- Demo User?

prisma/seed.ts
```
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.exercise.createMany({
    data: [
      {
        id: 'ex_builtin_bench_press',
        name: 'Bench Press',
        muscleGroup: 'Chest',
        // ... rest
      },
      // ...
    ],
    skipDuplicates: true,
  });
}

main()
  .finally(async () => prisma.$disconnect());

```
package.json
```
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```
Und CLI:
```
pnpm exec prisma db seed
```

### Lokal Dev
pnpm exec prisma migrate reset

#### Alternativ
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate
pnpm exec prisma db seed




#### Fresh Baseline
cd ~/projects/Relay/apps/api



pnpm exec prisma format
pnpm exec prisma migrate dev --name init
pnpm exec prisma generate

dann seed:
pnpm exec prisma db seed

### In prod (NAS)
docker compose -f docker-compose-prod.yml down
docker volume rm <dein_db_data_volume_name>
docker compose -f docker-compose-prod.yml up -d

#### or:

docker compose -f docker-compose.prod.yml run --rm migrate npx prisma migrate reset --force

Find Schema:

docker compose -f docker-compose.prod.yml run --rm migrate find / -name "schema.prisma"

insert found here:
docker compose -f docker-compose.prod.yml run --rm migrate npx prisma migrate reset --schema=[FOUND PATH] --force

# Datenbank

Displayname - nicht unique
Username Unique - identifiziert nutzer.
Email Unique - alternative identifiziert nutzer.

## Multi Module

Workout als Base:
- userId
- module
- startTime
- endTime
- status

### GYM Modul

WorkoutGym
WorkoutGymExercise
WorkoutGymSet

### Run Modul

WorkoutRun

## Dev:

docker compose -f docker-compose.dev.yml exec api sh 
pnpm exec prisma studio --port 5555 --browser none

## Prod (NAS)

Per SSH zu NAS
docker compose -f docker-compose.prod.yml exec api sh
pnpm exec prisma studio --hostname 0.0.0.0 --port 5555 --browser none

Vom PC einen SSH Tunnel öffnen
ssh -L 5555:127.0.0.1:5555 <user>@<nas-host>

### Alternativ:
Prisma Studio als compose service für lokal mit ssh

## To Learn:
pgAdmin
Metabase

## Sync:

Während Workout - Lokaler Draft (Crash Save)
Finish Workout - Completed Speichern und zur API Syncen
App Start / Login / Pull/Refresh Button - von API pullen (time since lastSync)
Lokal Cachen - Refreshbar/Syncen

Daten auf dem Handy (offline verfügbar)
Daten online (neues Gerät alles da)
keinen Schalter nötig

### Local vs API Toggle als Dev Tool

## Admin Reset Passwörter Hash
```
import { prisma } from '../src/index.js'; // ggf. Pfad anpassen
import { hashPassword } from '../src/auth.js';

async function main() {
  const username = process.argv[2];
  const newPassword = process.argv[3];

  if (!username || !newPassword) {
    console.error('Usage: pnpm tsx scripts/resetPassword.ts <username> <newPassword>');
    process.exit(1);
  }

  const passwordHash = await hashPassword(newPassword);

  const user = await prisma.user.update({
    where: { username },
    data: { passwordHash },
    select: { id: true, username: true },
  });

  console.log('Password reset for:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Auf NAS / Container:
```
pnpm tsx scripts/resetPassword.ts paul NeuesPasswort123
```

# Dev Tool / Dev Account

# Tester Account

