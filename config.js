module.exports = {
  // ─────────────── BOT SETTINGS ───────────────
  botToken: process.env.DISCORD_BOT_TOKEN || "YOUR_DISCORD_BOT_TOKEN", // get from Discord Developer Portal
  prefix: process.env.PREFIX || "!",
  owners: process.env.OWNERS ? process.env.OWNERS.split(',') : ["YOUR_DISCORD_ID"],

  // ─────────────── WEBHOOKS ───────────────
  captchaHook: process.env.CAPTCHA_HOOK || "YOUR_CAPTCHA_WEBHOOK",
  logHook: process.env.LOG_HOOK || "YOUR_LOG_WEBHOOK",
  webHook: process.env.WEB_HOOK || "YOUR_GENERAL_WEBHOOK",
  questHook: process.env.QUEST_HOOK || "YOUR_QUEST_WEBHOOK",

  // ─────────────── API KEYS ───────────────
  scrapeless: process.env.SCRAPELESS_KEY || "YOUR_SCRAPELESS_KEY", // from scrapeless API
  scrappey: process.env.SCRAPPEY_KEY || "YOUR_SCRAPPEY_KEY",     // from scrappey.com

  // ─────────────── SERVICE CONFIG CAPTCHA SOLVER ───────────────
  p2cloudflareservice: process.env.P2_CLOUDFLARE_SERVICE || "scrappey",
  p2solverservice: process.env.P2_SOLVER_SERVICE || "scrapeless",

  // ─────────────── PROXY SETTINGS ───────────────
  proxy: {
    username: process.env.PROXY_USERNAME || "WEBSHARE_USERNAME",
    password: process.env.PROXY_PASSWORD || "WEBSHARE_PASSWORD",
    port: process.env.PROXY_PORT || "WEBSHARE_PORT",   // from webshare.io
    ip: process.env.PROXY_IP || "WEBSHARE_IP"
  },
};
