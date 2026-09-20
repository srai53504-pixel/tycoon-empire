# TYCOON EMPIRE — Render-ready multiplayer API

This package is prepared for deployment as a Render Web Service.

## Important database note

The current prototype uses a JSON file (`server/data/db.json`). This allows multiple players to share the same live server instance, but the data is **not durable on Render's ephemeral filesystem**. For a production game, migrate the persistence layer to PostgreSQL before relying on this deployment for permanent player accounts/economy data.

## Deploy with GitHub + Render

1. Create a GitHub repository, for example `tycoon-empire-server`.
2. Upload the contents of this folder, including `render.yaml`.
3. In Render choose **New → Web Service** and connect the repository.
4. If Render detects `render.yaml`, use the service settings from it.
5. The server listens on `process.env.PORT` and `0.0.0.0`, as required by Render.
6. After deployment, test `https://YOUR-SERVICE.onrender.com/health`.

Do not commit passwords, API keys, tokens, or local `data/db.json` to GitHub.
