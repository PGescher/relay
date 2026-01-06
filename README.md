# Relay

version 0.1 MVP:
- Open URL on phone
- Sign up (username/password)
- Create group → copy invite code
- Friend logs in → join group with invite code
- Both click Enable Notifications
- Press Start Fitness → others get push

## Startup

From Project root:
``docker compose -f infra/docker-compose.dev.yml up -d``
-d detach to run in background
up create/start containers

View Status:
``docker compose -f infra/docker-compose.dev.yml ps``

See Logs:
``docker compose -f infra/docker-compose.dev.yml logs -f``
or only API:
``docker compose -f infra/docker-compose.dev.yml logs -f api``

Stop gracefully:
``docker compose -f infra/docker-compose.dev.yml down``

Stop and Delete DB data too:
``docker compose -f infra/docker-compose.dev.yml down -v``
``rm -rf pgdata``

Restart single services:
``docker compose -f infra/docker-compose.dev.yml restart web``
or:
``docker compose -f infra/docker-compose.dev.yml restart api``


## Infrastrukture (/infra)

Docker compose and configs. Starts DB, API & Web dev server

Later for QNAP use docker.compose.prod.yml & Caddyfile for HTTPS routing & ngnix config

### docker compose
#### docker-compose.dev.yml
Starts Postgres DB
Start API server (api)
Starts Vite dev server (web)
Connects them on a docker network
Persists databse data in /pgdata

#### docker-compose.prod.yml

### Caddy files


## Frontend (/web)

React (PWA) Runs in the browser

### Deployment: Static Build (no vite):

1. On your dev machine, build the frontend:
``docker run --rm -it -v "$PWD/web:/app" -w /app node:20-alpine sh -lc "npm install && npm run build"``
creates web/dist

2. Copy project to QNAP

3. On QNAP, use a production docker compose

4. Point your domain / tunnel to QNAP, make HTTPS work

NEED docker compose prod and Caddyfile but figure out the port forward first

### node_modules



### public
static files like images

### src

#### App & Main
main.jsx App entry point: mounts React + defines routing.

#### lib
api.js - API Helper:
- stores token in localStorage
- makes fetch calls to backend
- attaches Authorization: Bearer ...
- uses VITE_API_BASE so dev/prod can differ

#### Pages

##### Group
UI + logic to call /groups and /groups/join
Stores groupId and invite code in localStorage

##### Home
“Enable Notifications” and “Start Fitness”
ubscribes to push (browser API)
POSTs subscription to backend
triggers /groups/:id/start

##### Login
UI + logic to call /signup and /login

### Other

#### package.json
dependencies
#### vite.config.js
Vite and PWA plugin config


## Backend (/api)

Node / Fastify. Business Logic, Handles Login, Groups, Permissions and push sending.

Currently Server listening on port 3000

### package.json
lists the dependencies and defines startup

### server.js

Connexts to Postgres 
Creates Tables automatically at startup
defines Http endpoints, verfies JWT auth and send push notifications

#### /signup 
stores a bcrypt hash, returns JWT

#### /login 
validates password, returns JWT

#### /groups 
creates group + invite code + membership

#### /groups/join 
adds membership

#### /push/subscribe 
stores the browser’s push subscription

#### /groups/:id/start 
sends push notifications to subscriptions

#### /health 
is a basic check


## Database (/pgdata)

Database files, created automatically.
Docker starts postgres and backend connects with database url

Stores Persistent Data:

Users
Groups
Group Memberships
Push Subscriptions


## Create a React app using Docker

From project root (~/projects/relay):

``docker run --rm -it -v "$PWD/web:/app" -w /app node:20-alpine sh ``

Inside the container:

``
npm create vite@latest . -- --template react
npm install
npm i react-router-dom
npm i vite-plugin-pwa
exit
``



