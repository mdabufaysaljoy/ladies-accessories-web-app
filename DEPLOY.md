# Deploying to Vultr — domain.com + api.domain.com, single VPS

Target: 1 vCPU / 1 GB RAM / 25 GB NVMe (Vultr's smallest tier). This is a
**testing-tier box** — tight enough that a few steps below exist specifically
to keep it from OOM-killing itself. Read the RAM notes, don't skip the swap
step.

Replace `yourdomain.com` and `YOUR_SERVER_IP` everywhere below with your real
values. Everything in a fenced block is meant to be copy-pasted as-is unless
a placeholder is called out.

---

## 0. What you need before starting

- A domain you control DNS for
- A Vultr account, SSH key uploaded to it (Vultr → Account → SSH Keys) —
  don't use password auth for this
- This repo, on your own machine, ready to `rsync`

---

## 1. Create the VPS

Vultr → Deploy New Server:

- **Type:** Cloud Compute – Shared CPU
- **Location:** whichever is closest to your customers (Singapore or Mumbai
  for Bangladesh traffic)
- **Image:** Ubuntu 22.04 LTS x64
- **Plan:** 1 vCPU / 1 GB / 25 GB NVMe
- **SSH Key:** select the one you uploaded
- Deploy, then note the server's IP address

## 2. DNS

At your domain registrar / DNS provider, add two **A records**, both pointing
at the same VPS IP (it's one server hosting both):

| Type | Name | Value |
| --- | --- | --- |
| A | `@` (or `yourdomain.com`) | `YOUR_SERVER_IP` |
| A | `www` | `YOUR_SERVER_IP` |
| A | `api` | `YOUR_SERVER_IP` |

DNS can take a few minutes to an hour to propagate. Check with
`dig yourdomain.com` / `dig api.yourdomain.com` before moving to the SSL step.

---

## 3. First login and basic hardening

```bash
ssh root@YOUR_SERVER_IP
```

Create a non-root user to actually work as (never run the app as root):

```bash
adduser deploy          # set a strong password when prompted
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Log out and back in as `deploy` from here on:

```bash
exit
ssh deploy@YOUR_SERVER_IP
```

Lock down SSH — password auth off, root login off:

```bash
sudo nano /etc/ssh/sshd_config
```

Set (or confirm) these two lines:

```
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo systemctl restart ssh
```

## 4. Swap — do this before anything else installs

**This is the single most important step on a 1 GB box.** `npm install`,
MongoDB, and Node together can spike past 1 GB briefly; without swap, the
kernel OOM-killer will pick a process to kill — and it doesn't know or care
which one is your database.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# prefer RAM over swap when there's a choice, but allow it under pressure
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

Verify: `free -h` should show ~2.0G under Swap.

## 5. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 + 443
sudo ufw enable               # type y when prompted
sudo ufw status
```

Mongo (27017) and the Node API (4000) are deliberately **not** opened here —
Mongo will only listen on localhost, and the API is reached through Nginx.

---

## 6. Install Node.js (22.x LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v      # should print v22.x
```

## 7. Install MongoDB

```bash
sudo apt-get install -y gnupg curl
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

**Cap MongoDB's memory before starting it** — its default cache sizing math
assumes it can have a comfortable chunk of RAM, which doesn't exist here.

```bash
sudo nano /etc/mongod.conf
```

Confirm `net.bindIp` is `127.0.0.1` (default — never expose Mongo to the
internet), and add a cache limit under `storage`:

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1

storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 0.25
```

```bash
sudo systemctl enable mongod
sudo systemctl start mongod
sudo systemctl status mongod   # should say active (running)
```

**Create the database user** (Mongo starts with no auth by default — create
the user first, enable auth after):

```bash
mongosh
```

```js
use goods-by-sadia
db.createUser({
  user: "gbs_app",
  pwd: "PASTE_A_STRONG_PASSWORD_HERE",
  roles: [{ role: "readWrite", db: "goods-by-sadia" }]
})
exit
```

Now turn auth on:

```bash
sudo nano /etc/mongod.conf
```

Add:

```yaml
security:
  authorization: enabled
```

```bash
sudo systemctl restart mongod
```

Keep that password — it goes into `MONGODB_URI` in step 10.

## 8. Install Nginx, PM2

```bash
sudo apt-get install -y nginx
sudo npm install -g pm2
sudo mkdir -p /var/log/gbs-api && sudo chown deploy:deploy /var/log/gbs-api
sudo mkdir -p /var/www/goods-by-sadia && sudo chown deploy:deploy /var/www/goods-by-sadia
```

---

## 9. Get the code onto the server

From **your own machine** (not the VPS), in the project folder:

```bash
rsync -avz \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude server/node_modules \
  --exclude server/uploads \
  ./ deploy@YOUR_SERVER_IP:/var/www/goods-by-sadia/
```

`server/uploads` is excluded on purpose — once real product photos exist on
the server, treat that folder as server-only persistent data. A plain rsync
without `--delete` won't touch it either way, but excluding it makes that
explicit and safe even if `--delete` gets added later.

## 10. Backend: environment file

On the **server**:

```bash
cd /var/www/goods-by-sadia/server
nano .env
```

Paste this, filling in the placeholders (generate the two secrets with
`openssl rand -hex 32`, run it twice for two different values):

```bash
NODE_ENV=production
PORT=4000

MONGODB_URI=mongodb://gbs_app:PASTE_YOUR_MONGO_PASSWORD@127.0.0.1:27017/goods-by-sadia?authSource=goods-by-sadia

JWT_SECRET=PASTE_OUTPUT_OF_openssl_rand_-hex_32
JWT_EXPIRY=7d

SECRET_ENCRYPTION_KEY=PASTE_A_DIFFERENT_openssl_rand_-hex_32_OUTPUT

CLIENT_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

PUBLIC_URL=https://api.yourdomain.com
STOREFRONT_URL=https://yourdomain.com

META_VERIFY_TOKEN=choose-any-random-string-here

SEED_ADMIN_EMAIL=you@yourdomain.com
SEED_ADMIN_PASSWORD=CHOOSE_A_STRONG_PASSWORD_NOW
SEED_ADMIN_NAME=Sadia
```

A few of these matter more than they look:

- **`CLIENT_ORIGIN`** — the API's CORS allowlist. If your frontend origin
  isn't listed here exactly (scheme + host, no trailing slash), the browser
  blocks every API call with a CORS error.
- **`PUBLIC_URL`** — this is also what uploaded image URLs are built from
  (`${PUBLIC_URL}/uploads/...`), so product photos resolve correctly on the
  frontend's different origin. Must be the real `https://api.yourdomain.com`.
- **`SEED_ADMIN_PASSWORD`** — set this to something real now. The seed script
  only runs once against an empty database, so there's no "change it later"
  step baked in — you'd be logging in with whatever you put here.

Install dependencies and seed the database:

```bash
npm ci --omit=dev
npm run seed
```

You should see `[seed] owner created → you@yourdomain.com` — that confirms
Mongo auth and the connection string both work. (The password is not printed;
it is whatever you set as `SEED_ADMIN_PASSWORD`, or `ChangeMe123!` if you left
it unset — change it at first sign-in.)

> **`sharp` is a native module.** It is what re-encodes every uploaded image to
> WebP, and `npm ci` pulls a prebuilt binary for linux-x64 rather than
> compiling — a few seconds and about 10 MB. If it ever *does* fall back to
> building from source, that is exactly the situation the swap file in step 3
> exists for. Confirm it loaded with:
>
> ```bash
> node -e "console.log(require('sharp').versions)"
> ```
>
> Image optimisation is configured in **Settings → Storefront → Image
> optimisation**. WebP is the default; AVIF produces smaller files but costs
> roughly five times the CPU per image, which is worth knowing on one shared
> vCPU.

## 11. Start the API with PM2

```bash
cd /var/www/goods-by-sadia/server
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy
```

That last command prints a `sudo env PATH=...` line — copy and run exactly
what it prints (it registers PM2 to survive a reboot).

Confirm it's actually up:

```bash
pm2 status
curl http://127.0.0.1:4000/api/health
```

You should get back `{"ok":true,...}`.

---

## 12. Frontend: build **locally**, not on the VPS

Vite building React 19 + Tailwind 4 can spike RAM well past what a 1 GB box
has to give — don't risk it OOMing mid-build. Build on your own machine and
upload the static output instead.

On **your machine**, in the project root:

```bash
echo "VITE_API_URL=https://api.yourdomain.com" > .env.production
npm run build
rsync -avz dist/ deploy@YOUR_SERVER_IP:/var/www/goods-by-sadia/dist/
```

`.env.production` is only read by `vite build` (mode "production"). It
doesn't touch `npm run dev`, which keeps using the local proxy — so this is
safe to leave in the repo folder for future rebuilds without affecting local
development at all. It's already git-ignored.

*(If you ever do need to build on the VPS instead — e.g. no reliable route
from your machine — make sure the 2 GB swap from step 4 is active first,
then run the same `npm ci && npm run build` from `/var/www/goods-by-sadia`.)*

---

## 13. Nginx site configs

The repo includes ready-to-use configs in `deploy/`. Copy them in and replace
the placeholder domain:

```bash
sudo cp /var/www/goods-by-sadia/deploy/nginx-frontend.conf /etc/nginx/sites-available/goods-by-sadia-frontend
sudo cp /var/www/goods-by-sadia/deploy/nginx-api.conf /etc/nginx/sites-available/goods-by-sadia-api

sudo sed -i 's/yourdomain.com/YOUR_REAL_DOMAIN/g' /etc/nginx/sites-available/goods-by-sadia-frontend
sudo sed -i 's/yourdomain.com/YOUR_REAL_DOMAIN/g' /etc/nginx/sites-available/goods-by-sadia-api

sudo ln -s /etc/nginx/sites-available/goods-by-sadia-frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/goods-by-sadia-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t     # must say "syntax is ok" / "test is successful"
sudo systemctl reload nginx
```

At this point `http://yourdomain.com` and `http://api.yourdomain.com/api/health`
should both work over plain HTTP. Confirm before moving to SSL.

## 14. SSL (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

Certbot edits both Nginx configs in place to add the HTTPS server blocks and
redirect HTTP → HTTPS. Answer its prompts (email address, agree to terms,
redirect: yes).

Verify auto-renewal is wired up (Ubuntu installs a systemd timer for this
automatically):

```bash
sudo certbot renew --dry-run
```

Your site is now live at `https://yourdomain.com`.

---

## 15. Smoke test

- [ ] `https://yourdomain.com` loads the storefront
- [ ] `https://api.yourdomain.com/api/health` returns `{"ok":true}`
- [ ] Products load on the shop page (confirms frontend → API → Mongo)
- [ ] `https://yourdomain.com/admin/login` works with the `SEED_ADMIN_*`
      credentials from step 10
- [ ] Upload a product photo in the admin panel — it should render
      immediately (confirms the `PUBLIC_URL` image-URL fix)
- [ ] Place a test order with Cash on Delivery through the storefront
- [ ] `pm2 logs gbs-api` shows no repeating errors

---

## Redeploying after a code change

```bash
# from your machine
rsync -avz --exclude node_modules --exclude dist --exclude .git \
  --exclude server/node_modules --exclude server/uploads \
  ./ deploy@YOUR_SERVER_IP:/var/www/goods-by-sadia/

# if frontend changed:
npm run build
rsync -avz dist/ deploy@YOUR_SERVER_IP:/var/www/goods-by-sadia/dist/

# if server code or dependencies changed:
ssh deploy@YOUR_SERVER_IP "cd /var/www/goods-by-sadia/server && npm ci --omit=dev && pm2 restart gbs-api"
```

## Backups

The only things on this box that can't be regenerated from the git history
are the **database** and **uploaded images**. Back both up:

```bash
# run on the server, e.g. via a daily cron job
mongodump --uri="mongodb://gbs_app:PASSWORD@127.0.0.1:27017/goods-by-sadia?authSource=goods-by-sadia" \
  --out=/home/deploy/backups/$(date +%F)

tar -czf /home/deploy/backups/uploads-$(date +%F).tar.gz \
  /var/www/goods-by-sadia/server/uploads
```

Copy `/home/deploy/backups` off the box periodically (Vultr Object Storage,
or just `scp` it to your own machine) — a backup that lives only on the
server you're backing up isn't a backup.

## Known limit of this tier

1 GB RAM is workable for testing and light traffic, but Mongo's cache is
capped tight (0.25 GB) and there's no headroom for a traffic spike or a
second app. If this moves from testing to real orders, the first upgrade to
make is RAM — 2 GB minimum — before anything else.

## Troubleshooting

### "Blocked by CORS policy" — but only when uploading a file

If every other API call works and only uploads fail with

```
Access to fetch at 'https://api.yourdomain.com/api/media' from origin
'https://yourdomain.com' has been blocked by CORS policy: No
'Access-Control-Allow-Origin' header is present on the requested resource.
```

then this is almost certainly **not** a CORS problem. Nginx rejected the body
with **413 Request Entity Too Large** before it ever reached Express, so the
CORS middleware never ran and the error page carries no CORS header. The
browser can only describe what it sees, which is a missing header.

Confirm it in one command — the real status is in the Nginx log, not the
browser:

```bash
sudo tail -f /var/log/nginx/error.log
```

A line containing `client intended to send too large body` is the giveaway.

The fix is `client_max_body_size` in `/etc/nginx/sites-available/api.yourdomain.com`.
It must stay above multer's per-file limit multiplied by its file count (see
`server/src/middleware/upload.js`):

```bash
sudo nginx -t && sudo systemctl reload nginx
```

This is also why it never reproduces locally: in development Vite proxies
straight to Express with no Nginx in front, so nothing enforces a body limit.

