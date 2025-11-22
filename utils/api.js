const axios = require("axios");
const https = require('https');
const http = require('http');
const config = require('../config');

// Original getName function for hint-based catching (default behavior)
async function getName(imageUrl, altName) {
  try {
    const response = await axios.post(
      apiBaseUrl,
      { url: imageUrl, alt_name: altName },
      { headers: { "X-Authorization": key } }
    );
    if (response.data.error) {
      console.log(response.data.error);
      return [null, 0];
    }
    const { predicted_class: pokemonName, confidence } = response.data;
    return [pokemonName.toLowerCase(), confidence];
  } catch (error) {
    console.error(
      "\x1b[31m%s\x1b[0m",
      "An error occurred while getting the name. Please contact the admin!"
    );
    return [null, 0];
  }
}

// AI catching function (uses the correct AI endpoint)
async function getAIPrediction(imageUrl) {
  try {
    // Changed to GET for FastAPI
    const response = await axios.get(
      config.aiPredictionAPI.apiUrl,
      { params: { url: imageUrl }, timeout: config.aiPredictionAPI.timeout }
    );
    console.log('🤖 [AI-API] Prediction successful:', response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('❌ [AI-API] Error:', error.response.data.error || error.response.data);
      console.error('❌ [AI-API] Status:', error.response.status);
    } else if (error.request) {
      console.error('❌ [AI-API] No response received:', error.request);
    } else {
      console.error('❌ [AI-API] Request Error:', error.message);
    }
    throw error;
  }
}

const instance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

/**
 * Get Pokémon name prediction from API
 * @param {string} imageUrl - The URL of the Pokémon image
 * @returns {[string|null, number]} [pokemonName, confidence]
 */
async function getNamee(imageUrl) {
  try {
    const response = await instance.post(
      endpoint,
      { imageUrl },
      {
        headers: {
          "x-license-key": licenseKey,
          "Content-Type": "application/json",
        },
      }
    );
    const data = response.data;
    if (data.status !== true) {
      console.error("API Error:", data.message || "Unknown error");
      return [null, 0];
    }
    return [data.name.toLowerCase(), parseFloat(data.confidence) || 0];
  } catch (error) {
    console.error(
      "\x1b[31m%s\x1b[0m",
      "An error occurred while getting the name:",
      error.message
    );
    return [null, 0];
  }
}

// Fixed captcha solver (uses HTTPS as in the working script)
async function solveCaptcha(token, uid) {
  try {
    console.log("🚀 Sending captcha solve request...");
    console.log(`   Token: ${token}`);
    console.log(`   UID: ${uid}`);
    const response = await axios.post(url, { token, uid }, {
      headers: { "x-license-key": config.captchaApiKey },
      httpsAgent
    });
    console.log("📦 Raw Response:", response.data);
    if (response.data.status === true) {
      return { success: true, result: response.data.result || "solved" };
    } else {
      return {
        success: false,
        error: response.data.error || "Captcha solving failed",
      };
    }
  } catch (error) {
    console.error("💥 Captcha solve error:", error.message);
    if (error.response) {
      return {
        success: false,
        error: error.response.data?.error || "API error",
      };
    }
    return { success: false, error: error.message };
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

module.exports = {
  getName,
  getNamee,
  solveCaptcha,
  checkApiKeyBalance,
  getAIPrediction
};
