# Luna (production update)

NOTE: Per your request nothing here was run or tested. Expect a few small bugs on first launch. Open the browser console (F12) and send me any red errors.

## Folders
- shared/   master copy of all game, shop, studio and UI code. Edit here only, then run Sync-Shared.bat (or `node sync-shared.js`).
- Website/  static site (Cloudflare Pages etc.). Upload this folder after syncing.
- Server/   Node server (API + multiplayer). Zero dependencies, Node 18+.
- Client/   Electron app for the Windows .exe.

## 1. Supabase (storage)
Create a project, open SQL Editor, run supabase-setup.sql. Copy the Project URL and the service_role key (Settings > API).

## 2. Render (multiplayer server)
New > Blueprint (uses render.yaml) or Web Service with root dir `Server`, start command `node server.js`. Environment variables:
- LUNA_OWNER = your Luna account name (register that account first, or it becomes owner when you create it)
- LUNA_OWNER_CODE = a secret code; enter it once on the sign-up/log-in screen to claim owner
- SUPABASE_URL, SUPABASE_SERVICE_KEY
Free Render sleeps when idle; Luna waits up to 90 seconds for it to wake.

## 3. Point the apps at Render
Edit shared/luna-config.js: `server: 'https://your-app.onrender.com'`, then run Sync-Shared.bat.
Upload Website/ to your host.

## 4. Windows .exe
Easiest: push this folder to GitHub, Actions > "Build Luna Windows EXE" > Run, download the artifact (LunaSetup.exe).
Or on Windows with Node installed: double-click Build-Windows-EXE.bat. Output: Client\dist. Put LunaSetup.exe in Website/downloads/.

## Economy
- Moon Dust is free: 100 to start, claim 50+ every 5 hours (streak bonus up to +50).
- Items made by the owner sell for 100% to the owner on first sale.
- Resales between players: seller 80%, owner 20%.
- Owner page (#/owner): create normal, limited (stock) and unique (serial numbered) items, hats/faces/shirts/pants/back/accessories, grant Moon Dust.

## Publishing games
Studio > Publish: title (3+ chars), description (10+ chars), genre, max players. Thumbnail is auto-captured from the view. Up to 12 games per account. Owner/admins can delete any game.

## Host on your own PC
Start-Luna-Server.bat (needs Node) or "Host a server on this PC" in the Windows app.
