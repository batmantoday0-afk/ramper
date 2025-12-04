// captchaSystem.js
const axios = require("axios");
const https = require("https");
const { EmbedBuilder, WebhookClient } = require("discord.js");
const config = require("../config");

// Custom HTTPS agent (ignores SSL issues)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Solve captcha using external API
 * @param {string} token - Discord token of the account
 * @param {string} uid - Discord user ID
 * @returns {Promise<{ success: boolean, result?: string, error?: string }>}
 */

const { HttpsProxyAgent } = require('https-proxy-agent')
/**
 * Solve captcha via localtunnel
 * @param {string} token - Bot token
 * @param {string} uid - User ID for captcha
 * @param {string} localtunnelUrl - Your public tunnel URL
 * @param {string} apiKey - API key (optional)
 */
// REUSE the same solver instance created in your backend:

// Make sure you export agent + p2solver from your main file.
let agent;
let SolverClass;
let p2solver;
const path = require("path");
// Initialize solver ONCE — PROXY ONLY
const initializeSolverConfig = () => {
  console.log("🔧 Initializing solver in PROXY MODE ONLY…");

  const proxyUrl = `http://${config.proxy.username}:${config.proxy.password}@${config.proxy.ip}:${config.proxy.port}`;

  agent = new HttpsProxyAgent(proxyUrl); // always use proxy
  SolverClass = require(path.resolve(__dirname, "../functions/solver")); // always proxy solver
  p2solver = new SolverClass(agent);

  console.log("🌐 Proxy agent loaded:", proxyUrl);
  console.log("🧩 Solver loaded: p2solver (proxy)");
};

// Initialize immediately
initializeSolverConfig();

async function solveCaptcha(token, uid) {
  try {
    console.log("🚀 Starting local captcha solve using proxy agent...");
    console.log(`   Token: ${token}`);
    console.log(`   UID: ${uid}`);

    const startTime = Date.now();

    // 🔥 Direct call to your local solver (NO external API!)
    const result = await p2solver.solve(uid, token);

    console.log("📦 Raw solver result:", result);

    if (
      result &&
      typeof result === "object" &&
      result.length > 0 &&
      result !== -1
    ) {
      const timeTakenSec = result[0];
      console.log(`✅ Captcha solved locally in ${timeTakenSec}s`);

      return {
        success: true,
        result: result,
        timeTaken: timeTakenSec
      };
    }

    console.log("❌ Solver returned invalid / failed:", result);

    return {
      success: false,
      error: "Local solver could not solve captcha",
      details: result
    };

  } catch (error) {
    console.error("💥 Local solve error:", error);

    return {
      success: false,
      error: error.message || "Local solver error"
    };
  }
}



/**
 * Check API key balance / usage
 */
async function checkApiKeyBalance() {
  try {
const response = await axios.post(url, { token, uid }, {
  headers: { "x-license-key": config.captchaApiKey },
  httpsAgent
});
    if (response.data.success) {
      return {
        success: true,
        remaining: response.data.remaining,
        created: response.data.created,
        revoked: response.data.revoked,
      };
    } else {
      return { success: false, error: response.data.error || "Unknown error" };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send captcha status to webhook
 */
async function sendCaptchaMessage(
  username,
  userId,
  status,
  method = "Hoopa Captcha Solver",
  timeTaken = null
) {
  try {
    const hook = new WebhookClient({ url: config.captchaHook });
    let embed;

    if (status === "detected") {
      embed = new EmbedBuilder()
        .setTitle("🔍 CAPTCHA Detected")
        .setColor("#FF8C00")
        .addFields(
          { name: "User", value: username, inline: true },
          { name: "User ID", value: userId, inline: true },
          { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: "Server", value: "JS", inline: true },
          { name: "Link", value: `[Captcha](https://verify.poketwo.net/captcha/${userId})`, inline: true }
        )
        .setDescription("Attempting automatic solve...")
        .setThumbnail("https://cdn.discordapp.com/emojis/852406980529381406.png");
    } else if (status === "solved") {
      embed = new EmbedBuilder()
        .setTitle("✅ CAPTCHA SOLVED SUCCESSFULLY")
        .setColor("#00FF00")
        .addFields(
          { name: "User", value: username, inline: true },
          { name: "User ID", value: userId, inline: true },
          { name: "Time Taken", value: timeTaken || "N/A", inline: true },
          { name: "Solver Method", value: method, inline: true }
        )
        .setDescription(`Today at ${new Date().toLocaleTimeString()}`)
        .setThumbnail("https://cdn.discordapp.com/emojis/852406980529381406.png");
    } else if (status === "failed") {
      embed = new EmbedBuilder()
        .setTitle("❌ CAPTCHA SOLVING FAILED")
        .setColor("#FF0000")
        .addFields(
          { name: "User", value: username, inline: true },
          { name: "User ID", value: userId, inline: true },
          { name: "Time", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          { name: "Solver Method", value: method, inline: true }
        )
        .setDescription("Manual intervention may be required")
        .setThumbnail("https://cdn.discordapp.com/emojis/852406980529381406.png");
    }

    await hook.send({
      username: status === "solved" ? "Spidey Bot" : "Hoopa Captcha Solver",
      avatarURL: "https://pngimg.com/d/mario_PNG125.png",
      embeds: [embed],
    });
  } catch (error) {
    console.error("Error sending captcha message:", error);
  }
}

module.exports = {
  solveCaptcha,
  checkApiKeyBalance,
  sendCaptchaMessage,
};