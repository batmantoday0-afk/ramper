# How to Host Your Discord Bot for Free on Render

This guide explains how to host your Discord bot for free using [Render](https://render.com).

## Prerequisites

1.  **GitHub Account**: You need a GitHub account to host your code.
2.  **Render Account**: Sign up at [render.com](https://render.com) using your GitHub account.

## Step 1: Push Your Code to GitHub

1.  Create a new repository on GitHub.
2.  Push your bot's code (including the `Dockerfile` I just created) to this repository.
    *   Make sure `node_modules` is **NOT** uploaded (it should be in your `.gitignore`).
    *   Make sure your `config.js` or `.env` file with secrets is **NOT** uploaded if it contains sensitive tokens. **However**, for Render to work, you will need to provide these secrets as "Environment Variables" in the Render dashboard.

## Step 2: Create a Web Service on Render

1.  Go to your [Render Dashboard](https://dashboard.render.com/).
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub account if you haven't already, and select the repository you just created.
4.  **Configure the service**:
    *   **Name**: Give your service a name.
    *   **Region**: Choose the one closest to you.
    *   **Branch**: `main` (or `master`).
    *   **Runtime**: Select **Docker**.
    *   **Instance Type**: Select **Free**.
5.  **Environment Variables**:
    *   Scroll down to the "Environment Variables" section.
    *   Add the following keys and their corresponding values:
        *   `BOT_TOKEN`: Your main bot token.
        *   `TOKENS`: A comma-separated list of your alt tokens (e.g., `token1,token2,token3`).
        *   `OWNERS`: A comma-separated list of owner IDs (e.g., `123456789,987654321`).
        *   `SCRAPELESS_KEY`: Your Scrapeless API key.
        *   `SCRAPPEY_KEY`: Your Scrappey API key.
        *   `PROXY_USERNAME`: Proxy username.
        *   `PROXY_PASSWORD`: Proxy password.
        *   `PROXY_PORT`: Proxy port.
        *   `PROXY_IP`: Proxy IP.
        *   `CAPTCHA_HOOK`: Webhook URL for captcha logs.
        *   `LOG_HOOK`: Webhook URL for general logs.
        *   `WEB_HOOK`: Webhook URL for other logs.
        *   `QUEST_HOOK`: Webhook URL for quest logs.
        *   `PREFIX`: (Optional) Bot prefix, defaults to `!`.
6.  Click **Create Web Service**.

## Step 3: Keeping the Bot Alive

Render's free tier spins down web services after 15 minutes of inactivity. Since this is a Discord bot, it might not receive "web traffic" to keep it awake.

**Option A: Use a Background Worker (Not Free)**
*   Render's "Background Worker" is best for bots but it is a paid service.

**Option B: Use a Web Service with a Keep-Alive Monitor (Free Workaround)**
1.  Your bot code needs to listen on a port (like a web server) so Render thinks it's a web app.
2.  Add this simple code to your `index.js` (if it's not already there) to start a dummy server:

```javascript
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is alive!'));

app.listen(port, () => console.log(`Server listening on port ${port}`));
```

3.  You will need to install express: `npm install express` and update your `package.json`.
4.  Once deployed, Render will give you a URL (e.g., `https://your-bot.onrender.com`).
5.  Use a free uptime monitor service (like [UptimeRobot](https://uptimerobot.com/)) to ping that URL every 5 minutes. This prevents Render from putting your bot to sleep.

## Troubleshooting

*   **Puppeteer Errors**: If you see errors related to Chrome/Chromium, ensure the `Dockerfile` is being used correctly. The provided Dockerfile installs all necessary system dependencies.
*   **Build Failed**: Check the logs in the Render dashboard for specific error messages.
