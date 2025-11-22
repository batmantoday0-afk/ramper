module.exports = {
  // ─────────────── BOT SETTINGS ───────────────
  botToken: process.env.BOT_TOKEN || "",
  prefix: process.env.PREFIX || "!",
  owners: process.env.OWNERS ? process.env.OWNERS.split(',') : [],

  // ─────────────── WEBHOOKS ───────────────
  captchaHook: process.env.CAPTCHA_HOOK || "",
  logHook: process.env.LOG_HOOK || "",
  webHook: process.env.WEB_HOOK || "",
  questHook: process.env.QUEST_HOOK || "",

  // ─────────────── API KEYS ───────────────
  scrapeless: process.env.SCRAPELESS_KEY || "",
  scrappey: process.env.SCRAPPEY_KEY || "",

  // ─────────────── SERVICE CONFIG CAPTCHA SOLVER ───────────────
  p2cloudflareservice: process.env.P2_CLOUDFLARE_SERVICE || "scrappey",
  p2solverservice: process.env.P2_SOLVER_SERVICE || "scrapeless",

  // ─────────────── PROXY SETTINGS ───────────────
  proxy: {
    username: process.env.PROXY_USERNAME || "",
    password: process.env.PROXY_PASSWORD || "",
    port: process.env.PROXY_PORT || "",
    ip: process.env.PROXY_IP || ""
  },
};
