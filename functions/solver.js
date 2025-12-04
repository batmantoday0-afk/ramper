const path = require('path');
const fs = require('fs');
let config = require(path.resolve(__dirname, '../config'));
fs.watchFile(path.resolve(__dirname, '../config.js'), (curr, prev) => {
  // console.log('Config file updated, clearing cache...');
  delete require.cache[require.resolve(path.resolve(__dirname, '../config'))]; // Clear cache
  config = require(path.resolve(__dirname, '../config'));
  //   console.log('Config reloaded:', config);
});
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const { Client } = require('discord.js-selfbot-v13');
require('colors');
const axios = require('axios');

const { connect } = require('puppeteer-real-browser-legends');
/*
console.log('Available services for Recaptcha:', [
  'capsolver',
  'nextCaptcha',
  '2captcha',
  'capmonster',
  'scrapeless',
  'anticaptcha',
]);
console.log('Available services for Cloudflare:', [
  'capsolver',
  '2captcha',
  'scrappey',
  'manual',
  'capmonster',
  'scrapeless',
  'manualheadless',
  //scrapless and manualheadless same
]);
*/
async function getRecaptchaToken(userId) {
  const websiteURL = `https://verify.poketwo.net/captcha/${userId}`;
  const websiteKey = '6LfgtMoaAAAAAPB_6kwTMPj9HG_XxRLL7n92jYkD';
  const maxErrorRetries = 2; // Number of retries on error
  let errorAttempt = 0;
  let clientKey, createTaskUrl, getTaskResultUrl;

  // Determine the solver service
  if (config.p2solverservice === 'capsolver') {
    clientKey = config.capsolver;
    createTaskUrl = 'https://api.capsolver.com/createTask';
    getTaskResultUrl = 'https://api.capsolver.com/getTaskResult';
  } else if (config.p2solverservice === 'capmonster') {
    clientKey = config.capmonster;
    createTaskUrl = 'https://api.capmonster.cloud/createTask';
    getTaskResultUrl = 'https://api.capmonster.cloud/getTaskResult';
  } else if (config.p2solverservice === 'nextcaptcha') {
    clientKey = config.nextCaptcha;
    createTaskUrl = 'https://api.nextcaptcha.com/createTask';
    getTaskResultUrl = 'https://api.nextcaptcha.com/getTaskResult';
  } else if (config.p2solverservice === '2captcha') {
    clientKey = '76435e262e6cacbe7fd61f3d5a5f3316';
    createTaskUrl = 'https://api.2captcha.com/createTask';
    getTaskResultUrl = 'https://api.2captcha.com/getTaskResult';
  } else if (config.p2solverservice === 'scrapeless') {
    const scrapelessUrl = 'https://api.scrapeless.com/api/v1/createTask';
    let scrapelessToken = config.scrapeless;
    const headers = { 'x-api-token': scrapelessToken };

    const inputData = {
      version: 'v2',
      pageURL: websiteURL,
      siteKey: websiteKey,
      invisible: false,
    };

    const payload = {
      actor: 'captcha.recaptcha',
      input: inputData,
      proxy: {},
    };

    try {
      // Create task
      const createResponse = await axios.post(scrapelessUrl, payload, {
        headers,
      });
      const taskId = createResponse.data.taskId;

      if (!taskId) {
        console.log('Failed to create task:', createResponse.message);
        return null;
      }
      console.log(`Created a task: ${taskId}`);

      // Poll for result
      while (true) {
        await new Promise((res) => setTimeout(res, 1000));
        const getResultUrl =
          'https://api.scrapeless.com/api/v1/getTaskResult/' + taskId;
        const resultResponse = await axios.get(getResultUrl, { headers });
        if (resultResponse.data.code > 0) {
          console.log('Task failed!', resultResponse.data);
          return null;
        }
        if (resultResponse.data.success) {
          return resultResponse.data.solution.token;
        }
        console.log('Task is still processing...');
      }
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  } else if (config.p2solverservice === 'anticaptcha') {
    clientKey = config.anticaptcha;
    createTaskUrl = 'https://api.anti-captcha.com/createTask';
    getTaskResultUrl = 'https://api.anti-captcha.com/getTaskResult';
  } else {
    console.log(`Unknown service: ${config.p2solverservice}`.red);
    console.log('Available services:', [
      'capsolver',
      'capmonster',
      'nextCaptcha',
      '2captcha',
      'scrapeless',
      'anticaptcha',
    ]);
    return '';
  }

  try {
    // Create a new reCAPTCHA V2 task
    const createTaskResponse = await axios.post(createTaskUrl, {
      clientKey,
      task: {
        type: 'RecaptchaV2TaskProxyless',
        websiteURL,
        websiteKey,
      },
    });
    const createTaskData = createTaskResponse.data;

    if (createTaskData.errorId !== 0) {
      console.log(
        `Failed to create captcha task: ${createTaskData.errorDescription}`.red
      );
      return null;
    }

    const taskId = createTaskData.taskId;
    console.log(`Captcha task created, Task ID: ${taskId}`.yellow);

    // Poll the task status
    while (true) {
      try {
        const getTaskResultResponse = await axios.post(getTaskResultUrl, {
          clientKey,
          taskId,
        });
        const getTaskResultData = getTaskResultResponse.data;

        if (getTaskResultData.errorId !== 0) {
          console.log(
            `Failed to get captcha task result: ${getTaskResultData.errorDescription}`
              .red
          );
          errorAttempt++;
          if (errorAttempt > maxErrorRetries) {
            console.log('Max error attempts reached, exiting.'.red);
            return null;
          }
          console.log(
            `Retrying after error... (Error Attempt ${errorAttempt})`.yellow
          );
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay before retry
          continue;
        }

        if (getTaskResultData.status === 'ready') {
          console.log('Full getTaskResultData:', getTaskResultData);
          return (
            getTaskResultData.solution.gRecaptchaResponse ||
            getTaskResultData.solution.text
          );
        } else if (getTaskResultData.status === 'processing') {
          console.log(`Task is still processing...`.yellow);
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay before checking again
        }
      } catch (error) {
        console.log(`Error in getRecaptchaToken: ${error.message}`.red);
        errorAttempt++;
        if (errorAttempt > maxErrorRetries) {
          console.log('Max error attempts reached, exiting.'.red);
          return null;
        }
        console.log(
          `Retrying after error... (Error Attempt ${errorAttempt})`.yellow
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.log(`Error in getRecaptchaToken: ${error.message}`.red);
    return null;
  }
}

class P2Solver {
  constructor(agent) {
    this.cookieString = '';
    this.recaptchaToken = '';
    this.userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0';
    this.processingCookie = false;
    this.queue = [];
    this.agent = agent;
    this.validity = true;
    const { epoch, cf_value } = this.readEpochFromFile(); // Read epoch and cookie value from file
    this.lastCookieGenerationTime = epoch;
    this.cookieString = cf_value;
    this.initialized = false; // Add this line
    this.initialize(); // Call initialize method
  }
  async initialize() {
    try {
      this.lastCookieGenerationTime = 0; // Reset epoch value
      this.cookieString = ''; // Reset cookie value
      this.writeEpochToFile(this.lastCookieGenerationTime, this.cookieString); // Write epoch and cookie value to file
      this.initialized = true; // Set initialized to true
    } catch (error) {
      console.error('Error during initialization:', error);
      this.initialized = false; // Set initialized to false on error
    }
  }
  async initialize2() {
    try {
      await this.genCookie(); // Generate a new cookie when the bot starts
      this.lastCookieGenerationTime = new Date().getTime(); // Update the timestamp
      this.writeEpochToFile(this.lastCookieGenerationTime, this.cookieString); // Write epoch and cookie value to file
      this.initialized = true; // Set initialized to true
    } catch (error) {
      console.error('Error during initialization:', error);

      this.lastCookieGenerationTime = 0; // Reset epoch value
      this.cookieString = ''; // Reset cookie value
      this.writeEpochToFile(this.lastCookieGenerationTime, this.cookieString); // Write epoch and cookie value to file
      this.initialized = false; // Set initialized to false on error
    }
  }

  readEpochFromFile() {
    try {
      const data = fs.readFileSync('functions/solver.json', 'utf8'); // Update the file path
      const json = JSON.parse(data);
      return { epoch: json.epoch || 0, cf_value: json.cf_value || '' };
    } catch (error) {
      console.error('Error reading epoch from file:', error);
      return { epoch: 0, cf_value: '' };
    }
  }

  writeEpochToFile(epoch, cf_value) {
    try {
      const data = JSON.stringify({ epoch: epoch, cf_value: cf_value });
      fs.writeFileSync('functions/p2solver.json', data, 'utf8'); // Update the file path
      console.log('Epoch time and cookie value updated successfully!'); // Add this line
    } catch (error) {
      console.error('Error writing epoch to file:', error);
    }
  }

  async solve(userId, token) {
    // Wait for initialization to complete
    while (!this.initialized) {
      await new Promise((r) => setTimeout(r, 100));
    }

    const client = new Client();
    return new Promise((resolve) => {
      client.login(token).catch((error) => {
        console.log('Login failed:', error);
        return resolve(0);
      });

      if (!token.includes('.') || token.length < 20) {
        return resolve(0);
      }

      client.once('ready', async () => {
        userId = client.user.id;
        log(`Solving for ${client.user.tag}`.magenta);

        try {
          let cookieValid = true;
          const currentTime = new Date().getTime();
          const startTime = new Date();

          const generateCookie = async () => {
            if (!this.processingCookie) {
              this.processingCookie = true;
              try {
                const valid = await this.genCookie();
                if (valid) {
                  this.lastCookieGenerationTime = currentTime;
                  this.writeEpochToFile(currentTime, this.cookieString);
                } else {
                  this.writeEpochToFile(0, '');
                }
                return valid;
              } catch (error) {
                log('Error generating cookie:', error);
                this.writeEpochToFile(0, '');
                return false;
              } finally {
                this.processingCookie = false;
              }
            } else {
              while (this.processingCookie) {
                await new Promise((r) => setTimeout(r, 100));
              }
            }
          };

          // Check if cookie needs to be generated FIRST
          if (
            currentTime - this.lastCookieGenerationTime > 720000 ||
            !this.cookieString ||
            this.readEpochFromFile().epoch === 0
          ) {
            cookieValid = await generateCookie();
          }

          if (!cookieValid || !this.cookieString) {
            log('Proceeding with request despite invalid cookie.'.yellow);
          }

          // NOW generate reCAPTCHA token
          const recaptchaSolution = await getRecaptchaToken(userId);
          if (!recaptchaSolution) {
            console.log('Failed to generate reCAPTCHA token.'.red);
            return resolve(-1);
          }
          log(
            `Generated reCAPTCHA token! ${recaptchaSolution.substring(0, 15)}...`
              .green
          );

          const midTime = new Date();
          log(
            `Passing reCAPTCHA token to rawSolve: ${recaptchaSolution.substring(0, 15)}...`
              .blue
          );

          const result = await this.rawSolve(userId, recaptchaSolution).catch(
            (error) => {
              log('Error during raw solve:'.red, error.message);
              return null;
            }
          );

          if (!result) {
            return resolve(-1);
          }

          let authURL;
          try {
            authURL = await client.authorizeURL(result[0], {
              authorize: true,
              integration_type: 0,
              permissions: 0,
            });
          } catch (error) {
            log('Error during authorization:', error);
            log('Error message:'.yellow, error.message);
            log('Error stack:'.yellow, error.stack);
            log('Error details:'.yellow, JSON.stringify(error, null, 2));
            return resolve(-1);
          }

          if (!authURL) {
            return resolve(-1);
          }

          let exchangeResult;
          try {
            exchangeResult = await this.exchangeIDs(
              authURL.location,
              result[1]
            );
          } catch (error) {
            log('Error during exchange:'.red, error.message);
            return resolve(-1);
          }

          client.ws.destroy();
          log(
            `Solved in [${((new Date() - startTime) / 1000).toFixed(3)}s / ${(new Date() - midTime) / 1000}s]! ${exchangeResult}`
              .green
          );
          return resolve([
            ((new Date() - startTime) / 1000).toFixed(3),
            exchangeResult,
          ]);
        } catch (error) {
          console.error('Error during solving process:', error);
          return resolve(-1);
        }
      });
    });
  }

  async solveold(userId, token) {
    // Wait for initialization to complete
    while (!this.initialized) {
      await new Promise((r) => setTimeout(r, 100));
    }

    const client = new Client();
    return new Promise((resolve) => {
      client.login(token).catch((error) => {
        console.log('Login failed:', error);
        return resolve(0);
      });

      if (!token.includes('.') || token.length < 20) {
        return resolve(0);
      }

      client.once('ready', async () => {
        userId = client.user.id;
        log(`Solving for ${client.user.tag}`.magenta);
        try {
          const recaptchaSolution = await getRecaptchaToken(userId);
          if (!recaptchaSolution) {
            console.log('Failed to generate reCAPTCHA token.'.red);
            return resolve(-1);
          }
          log(
            `Generated reCAPTCHA token! ${recaptchaSolution.substring(0, 15)}...`
              .green
          );

          let cookieValid = true;
          const startTime = new Date();
          const currentTime = new Date().getTime();
          //    this.processingCookie = false; // Add this flag

          const generateCookie = async () => {
            if (!this.processingCookie) {
              this.processingCookie = true;
              try {
                const valid = await this.genCookie();
                if (valid) {
                  this.lastCookieGenerationTime = currentTime; // Update the timestamp
                  this.writeEpochToFile(currentTime, this.cookieString); // Write epoch and cookie value to file
                } else {
                  this.writeEpochToFile(0, ''); // Reset epoch and cookie value to 0 in case of failure
                }
                return valid;
              } catch (error) {
                log('Error generating cookie:', error);
                this.writeEpochToFile(0, ''); // Reset epoch and cookie value to 0 in case of error
                return false;
              } finally {
                this.processingCookie = false;
              }
            } else {
              while (this.processingCookie) {
                await new Promise((r) => setTimeout(r, 100));
              }
            }
          };

          // Check if the cookie needs to be generated
          if (
            currentTime - this.lastCookieGenerationTime > 720000 ||
            !this.cookieString ||
            this.readEpochFromFile().epoch === 0
          ) {
            cookieValid = await generateCookie();
          }

          // Skip generating the cookie again within the same session if it failed
          if (!cookieValid || !this.cookieString) {
            log('Proceeding with request despite invalid cookie.'.yellow);
          }

          const midTime = new Date();
          log(
            `Passing reCAPTCHA token to rawSolve: ${recaptchaSolution.substring(0, 15)}...`
              .blue
          );
          const result = await this.rawSolve(userId, recaptchaSolution).catch(
            (error) => {
              log('Error during raw solve:'.red, error.message);
              return null;
            }
          );

          if (!result) {
            return resolve(-1);
          }

          let authURL;
          try {
            authURL = await client.authorizeURL(result[0], {
              authorize: true,
              integration_type: 0,
              permissions: 0,
            });
          } catch (error) {
            log('Error during authorization:', error);
            log('Error message:'.yellow, error.message);
            log('Error stack:'.yellow, error.stack); // Show the full stack trace
            log('Error details:'.yellow, JSON.stringify(error, null, 2));
            return resolve(-1);
          }

          if (!authURL) {
            return resolve(-1);
          }

          let exchangeResult;
          try {
            exchangeResult = await this.exchangeIDs(
              authURL.location,
              result[1]
            );
          } catch (error) {
            log('Error during exchange:'.red, error.message);
            return resolve(-1);
          }

          client.ws.destroy();
          log(
            `Solved in [${((new Date() - startTime) / 1000).toFixed(3)}s / ${(new Date() - midTime) / 1000}s]! ${exchangeResult}`
              .green
          );
          return resolve([
            ((new Date() - startTime) / 1000).toFixed(3),
            exchangeResult,
          ]);
        } catch (error) {
          console.error('Error during solving process:', error);
          return resolve(-1);
        }
      });
    });
  }

  async checkCookie(userId) {
    try {
      console.log(`Checking cookie for userId: ${userId}`);

      const response = await fetch(
        `https://verify.poketwo.net/captcha/${userId}`,
        {
          agent: this.agent,
          headers: {
            accept: 'text/html',
            cookie: this.cookieString,
            'user-agent': this.userAgent,
          },
          method: 'GET',
        }
      );

      console.log(`Response Status: ${response.status} for userId: ${userId}`);

      if (response.status === 200) {
        console.log('Cookie is valid.');
        return true;
      } else if (response.status === 403) {
        console.log('Cookie is invalid or expired!');
      } else if (response.status === 402) {
        console.log('Received unexpected 402 Payment Required status.');
      } else {
        console.log(`Unexpected status: ${response.status}`);
      }

      return false;
    } catch (error) {
      console.error(`Error while checking cookie for userId: ${userId}`);
      console.error(`Error: ${error.message}`);
      console.error(error.stack);
      return false;
    }
  }

  async rawSolveold(userId, recaptchaToken) {
    let attempt = 0;
    const maxAttempts = 2; // Only one retry after the initial attempt
    let lastError;
    //let validCookie = await this.checkCookie(userId);

    while (attempt < maxAttempts) {
      try {
        console.log(
          `Posting solve requests for userId: ${userId}. Attempt: ${attempt + 1}`
        );

        const startTime = Date.now();
        const response = await fetch(
          'https://verify.poketwo.net/api/recaptcha',
          {
            agent: this.agent, // Ensure this.agent is set to a proxy agent
            headers: {
              accept: 'text/html',
              'content-type': 'application/x-www-form-urlencoded',
              cookie: this.cookieString,
              'user-agent': this.userAgent,
              Connection: 'keep-alive',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br', // Supports compressed responses
              'Cache-Control': 'max-age=0',
              Priority: 'u=0, i',
              Origin: 'https://verify.poketwo.net',
              Referer: `https://verify.poketwo.net/captcha/${userId}`,
              'Proxy-Authorization':
                'Basic ' + Buffer.from('username:password').toString('base64'), // If authentication is needed
            },
            body: `uid=${userId}&g-recaptcha-response=${recaptchaToken}`,
            method: 'POST',
            redirect: 'manual',
          }
        );

        const responsse = await fetch(
          'https://verify.poketwo.net/api/recaptcha',
          {
            agent: this.agent,
            headers: {
              accept: 'text/html',
              'content-type': 'application/x-www-form-urlencoded',
              cookie: this.cookieString,
              'user-agent': this.userAgent,
              Referer: `https://verify.poketwo.net/captcha/${userId}`,
            },
            body: `uid=${userId}&g-recaptcha-response=${recaptchaToken}`,
            method: 'POST',
            redirect: 'manual',
          }
        );

        const endTime = Date.now();
        console.log(`Request Time: ${endTime - startTime}ms`);

        const setCookieHeader = response.headers.raw()['set-cookie'];
        const newCookie = setCookieHeader
          ? setCookieHeader[0].split(';')[0]
          : '';

        if ([200, 301, 302, 307].includes(response.status)) {
          return [response.headers.raw().location[0], newCookie];
        } else if (response.status === 403) {
          lastError = 'Invalid cookie';
          console.log(
            `${lastError} for userId: ${userId}. Response:`,
            await response.text()
          );
        } else if (response.status === 400) {
          lastError = `Invalid recaptcha token ${recaptchaToken} for userId: ${userId}`;
          console.log(`${lastError} for userId: ${userId}`);
        } else {
          lastError = `Unexpected response status: ${response.status}`;
          console.log(lastError);
        }
      } catch (error) {
        lastError = `Error during raw solve for userId: ${userId} - ${error.message}`;
        console.log(lastError);
      }

      // If the cookie is invalid or an unexpected status code is received, try to generate a new cookie and retry
      if (lastError && response.status !== 200 && attempt === 0) {
        attempt++;
        const valid = await this.genCookie();
        if (!valid) {
          break; //
        }
      } else {
        break; // Break the loop if it's the second attempt
      }
    }

    console.log(
      `Failed to solve for userId: ${userId} after ${attempt} attempt(s).`
    );
    return ['', ''];
  }
  async rawSolve(userId, recaptchaToken) {
    let attempt = 0;
    const maxAttempts = 2; // Only one retry after the initial attempt
    let lastError;

    while (attempt < maxAttempts) {
      try {
        console.log(
          `Posting solve request for userId: ${userId}. Attempt: ${attempt + 1}`
        );

        const startTime = Date.now();
        const response = await fetch(
          'https://verify.poketwo.net/api/recaptcha',
          {
            agent: this.agent, // Ensure this.agent is set to a proxy agent
            headers: {
              accept: 'text/html',
              'content-type': 'application/x-www-form-urlencoded',
              cookie: this.cookieString,
              'user-agent': this.userAgent,
              Connection: 'keep-alive',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br', // Supports compressed responses
              'Cache-Control': 'max-age=0',
              Priority: 'u=0, i',
              Origin: 'https://verify.poketwo.net',
              Referer: `https://verify.poketwo.net/captcha/${userId}`,
            },
            body: `uid=${userId}&g-recaptcha-response=${recaptchaToken}`,
            method: 'POST',
            redirect: 'manual',
          }
        );

        const endTime = Date.now();
        console.log(`Request Time: ${endTime - startTime}ms`);

        const responseBody = await response.text(); // Read response body for debugging
        const setCookieHeader = response.headers.raw()['set-cookie'];
        const newCookie = setCookieHeader
          ? setCookieHeader[0].split(';')[0]
          : '';

        if ([200, 301, 302, 307].includes(response.status)) {
          return [response.headers.get('location'), newCookie];
        }

        // Handle specific error statuses
        if (response.status === 400) {
          console.log(
            `Invalid reCAPTCHA token for userId: ${userId}. Response: ${responseBody}`
          );
          return ['', '']; // Do NOT retry, as the token is invalid
        }

        if (response.status === 403) {
          lastError = `Invalid cookie for userId: ${userId}. Response: ${responseBody}`;
          console.log(lastError);
        } else {
          lastError = `Unexpected response status: ${response.status}. Response: ${responseBody}`;
          console.log(lastError);
        }
      } catch (error) {
        lastError = `Error during raw solve for userId: ${userId} - ${error.message}`;
        console.log(lastError);
      }

      // If the cookie is invalid or an unexpected status code is received, retry once
      if (lastError && attempt === 0) {
        attempt++;
        const valid = await this.genCookie();
        if (!valid) break; // Stop if generating a new cookie fails
      } else {
        break; // Stop retrying after the second attempt
      }
    }

    console.log(
      `Failed to solve for userId: ${userId} after ${attempt} attempt(s).`
    );
    return ['', '']; // Indicate failure
  }

  async genCookie() {
    log('Generating cookie...'.magenta);

    const api_key = config.capsolver;
    const capmonsterkey = config.capmonster;
    const twocapkey = config.twocaptcha; // Adjust according to your actual config key
    const site_url = 'https://verify.poketwo.net/captcha/1183988420893233244';

    try {
      if (config.p2cloudflareservice === 'scrappey') {
        log('Using Scrappey to generate cookie...'.blue);

        // Define the payload for the Scrappey API
        const payload = {
          cmd: 'request.get',
          //
          //     browser: [
          //         {
          //            name: "chrome"
          //          }
          //     ],
          //     noDriver: true,
          cloudflareBypass: true,

          // Command to execute
          url: 'https://verify.poketwo.net/captcha/1183988420893233244', // Target URL
          proxy: `http://${config.proxy.username}:${config.proxy.password}@${config.proxy.ip}:${config.proxy.port}`, // Proxy configuration
          retries: 3, // Number of retries
          //          mobileProxy: true, // Mobile proxy
          //          video: true, // Enable video rendering
        };

        try {
          // Send the POST request to Scrappey API
          const response = await axios.post(
            `https://publisher.scrappey.com/api/v1?key=${config.scrappey}`, // Endpoint with API key
            payload, // Payload
            {
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          console.log('Scrappey Response:', response.data);

          if (response.data?.solution?.statusCode === 200) {
            this.cookieString = response.data.solution.cookieString;
            this.userAgent = response.data.solution.userAgent;
            log('Generated cookie with Scrappey!'.green);
            this.validity = true;

            return true;
          } else {
            this.validity = false; // Reset validity to false on failure

            log('Unable to generate cookie with Scrappey!'.red);
            log(`Status Code: ${response.data?.solution?.statusCode}`.yellow);
            log(`Response: ${JSON.stringify(response.data?.solution)}`.yellow);
            return false;
          }
        } catch (error) {
          log('Error during Scrappey request:'.red, error.message);
          this.validity = false;
          return false;
        }
      }

      if (config.p2cloudflareservice === 'capsolver') {
        log('Using CapSolver to generate cookie...'.blue);

        const payload = {
          clientKey: api_key,
          task: {
            type: 'AntiCloudflareTask',
            websiteURL: site_url,

            proxy: `http:${config.proxy.ip}:${config.proxy.port}:${config.proxy.username}:${config.proxy.password}`,
          },
        };

        const response = await axios.post(
          'https://api.capsolver.com/createTask',
          payload
        );
        console.log('CapSolver Create Task Response:', response.data);

        if (!response.data || response.data.errorId || !response.data.taskId) {
          log(
            `Failed to create task with CapSolver: ${JSON.stringify(response.data)}`
          );
          return false;
        }

        const task_id = response.data.taskId;
        log('Got taskId:', task_id);

        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Delay for 2 seconds
          const getResultPayload = {
            clientKey: api_key,
            taskId: task_id,
          };
          const taskResultResponse = await axios.post(
            'https://api.capsolver.com/getTaskResult',
            getResultPayload
          );
          console.log(
            'CapSolver Task Result Response:',
            taskResultResponse.data
          );
          const status = taskResultResponse.data.status;

          if (status === 'ready') {
            const solution = taskResultResponse.data.solution;
            this.cookieString = solution.cookies; // Set cookieString
            this.userAgent = solution.headers['User-Agent']; // Set userAgent
            log('Generated cookie with CapSolver!'.green);

            this.validity = true;
            return true;
          }

          if (status === 'failed' || taskResultResponse.data.errorId) {
            log('Solve failed with CapSolver! response:', taskResultResponse);
            this.validity = false; // Ensure validity is reset on failure
            return false;
          }
        }
      }

      if (config.p2cloudflareservice === '2captcha') {
        log('Using 2Captcha to generate cookie...'.blue);

        // Use the intercepted values
        const cData = '8ff248e4d8016bd9';
        const chlPageData =
          'jP1RPI6ITGwLo8MmoYUZaNcuOQF9CgFGz6GLtOjGD_k-1736403242-1.3.1.1-HKD40FrCKOulkW6cr7VLzxZgAUzALEvcJnlp4EA6hpbLOvT_n47k5rl_JXco_FTIlYXYVtro3hSramwyX4YHWedi0a0vPNIFvzNd.JL1GXnPRTAX80B2dF223sa11Oxc0N3iFjvd6Q4eVd3jAfKHWIYUF0dXpPHa5KiHhhc6_6.c8Qh4XeAV4ib5G4qf7rTvj8fSW9bivTRFvH6PUqgm9lg8kU_WfNrHCxVdIcDdBcpJEFYoupepGSFRG5qoHuKC4daansn2itWCNaOJMofTYOLhTwwRO7AwQodYVkVmAqF7LjOicuC6LXICMdV5P3Tfa_TMCyHEDF1yD3l8TF.ImHB46WK_1FAhQhmB1iJyGUnZZ.xPXwldlXl40kRRJnp1V.jWLYO13Li81Km9T2okiHIa5_UWyxo3ZiV9RcDi25g';
        const action = 'managed';
        const userAgent =
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0';

        const payload = {
          clientKey: twocapkey,
          task: {
            type: 'TurnstileTask',
            websiteURL: site_url,
            websiteKey: '0x4AAAAAAADnPIDROrmt1Wwj',
            action: action,
            data: cData,
            pagedata: chlPageData,
            userAgent: userAgent,
            proxyType: 'http',
            proxyAddress: `${config.proxy.ip}`,
            proxyPort: `${config.proxy.port}`,
            proxyLogin: `${config.proxy.username}`,
            proxyPassword: `${config.proxy.password}`,
          },
        };

        const response = await axios.post(
          'https://api.2captcha.com/createTask',
          payload
        );
        console.log('2Captcha Create Task Response:', response.data);

        if (!response.data || response.data.errorId || !response.data.taskId) {
          log(
            `Failed to create task with 2Captcha: ${JSON.stringify(response.data)}`
          );
          return false;
        }

        const task_id = response.data.taskId;
        log('Got taskId:', task_id);

        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const getResultPayload = {
            clientKey: twocapkey,
            taskId: task_id,
          };
          const taskResultResponse = await axios.post(
            'https://api.2captcha.com/getTaskResult',
            getResultPayload
          );
          console.log(
            '2Captcha Task Result Response:',
            taskResultResponse.data
          );
          const status = taskResultResponse.data.status;

          if (status === 'ready') {
            const solution = taskResultResponse.data.solution;
            this.cookieString = solution.token;
            this.userAgent = solution.userAgent;
            log('Generated cookie with 2Captcha!'.green);
            this.validity = true;

            return true;
          }

          if (status === 'failed' || taskResultResponse.data.errorId) {
            log('Solve failed with 2Captcha! response:', taskResultResponse);
            this.validity = false;
            this.cookieString = ''; // Reset cookieString
            return false;
          }
        }
      }
      if (config.p2cloudflareservice === 'capmonster') {
        log('Using Capmonster to generate cookie...'.green);

        try {
          // Use the intercepted values

          const payload = {
            clientKey: capmonsterkey,
            task: {
              type: 'TurnstileTask',
              //   cloudflareTaskType: "token",
              cloudflareTaskType: 'cf_clearance',
              htmlPageBase64: `PCFET0NUWVBFIGh0bWw+PGh0bWwgbGFuZz0iZW4tVVMiPjxoZWFkPjx0aXRsZT5KdXN0IGEgbW9tZW50Li4uPC90aXRsZT48bWV0YSBodHRwLWVxdWl2PSJDb250ZW50LVR5cGUiIGNvbnRlbnQ9InRleHQvaHRtbDsgY2hhcnNldD1VVEYtOCI+PG1ldGEgaHR0cC1lcXVpdj0iWC1VQS1Db21wYXRpYmxlIiBjb250ZW50PSJJRT1FZGdlIj48bWV0YSBuYW1lPSJyb2JvdHMiIGNvbnRlbnQ9Im5vaW5kZXgsbm9mb2xsb3ciPjxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsaW5pdGlhbC1zY2FsZT0xIj48c3R5bGU+Kntib3gtc2l6aW5nOmJvcmRlci1ib3g7bWFyZ2luOjA7cGFkZGluZzowfWh0bWx7bGluZS1oZWlnaHQ6MS4xNTstd2Via2l0LXRleHQtc2l6ZS1hZGp1c3Q6MTAwJTtjb2xvcjojMzEzMTMxO2ZvbnQtZmFtaWx5OnN5c3RlbS11aSwtYXBwbGUtc3lzdGVtLEJsaW5rTWFjU3lzdGVtRm9udCxTZWdvZSBVSSxSb2JvdG8sSGVsdmV0aWNhIE5ldWUsQXJpYWwsTm90byBTYW5zLHNhbnMtc2VyaWYsQXBwbGUgQ29sb3IgRW1vamksU2Vnb2UgVUkgRW1vamksU2Vnb2UgVUkgU3ltYm9sLE5vdG8gQ29sb3IgRW1vaml9Ym9keXtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2hlaWdodDoxMDB2aDttaW4taGVpZ2h0OjEwMHZofS5tYWluLWNvbnRlbnR7bWFyZ2luOjhyZW0gYXV0bzttYXgtd2lkdGg6NjByZW07cGFkZGluZy1sZWZ0OjEuNXJlbX1AbWVkaWEgKHdpZHRoIDw9IDcyMHB4KXsubWFpbi1jb250ZW50e21hcmdpbi10b3A6NHJlbX19Lmgye2ZvbnQtc2l6ZToxLjVyZW07Zm9udC13ZWlnaHQ6NTAwO2xpbmUtaGVpZ2h0OjIuMjVyZW19QG1lZGlhICh3aWR0aCA8PSA3MjBweCl7Lmgye2ZvbnQtc2l6ZToxLjI1cmVtO2xpbmUtaGVpZ2h0OjEuNXJlbX19I2NoYWxsZW5nZS1lcnJvci10ZXh0e2JhY2tncm91bmQtaW1hZ2U6dXJsKGRhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEhOMlp5QjRiV3h1Y3owaWFIUjBjRG92TDNkM2R5NTNNeTV2Y21jdk1qQXdNQzl6ZG1jaUlIZHBaSFJvUFNJek1pSWdhR1ZwWjJoMFBTSXpNaUlnWm1sc2JEMGlibTl1WlNJK1BIQmhkR2dnWm1sc2JEMGlJMEl5TUVZd015SWdaRDBpVFRFMklETmhNVE1nTVRNZ01DQXhJREFnTVRNZ01UTkJNVE11TURFMUlERXpMakF4TlNBd0lEQWdNQ0F4TmlBemJUQWdNalJoTVRFZ01URWdNQ0F4SURFZ01URXRNVEVnTVRFdU1ERWdNVEV1TURFZ01DQXdJREV0TVRFZ01URWlMejQ4Y0dGMGFDQm1hV3hzUFNJalFqSXdSakF6SWlCa1BTSk5NVGN1TURNNElERTRMall4TlVneE5DNDROMHd4TkM0MU5qTWdPUzQxYURJdU56Z3plbTB0TVM0d09EUWdNUzQwTWpkeExqWTJJREFnTVM0d05UY3VNemc0TGpRd055NHpPRGt1TkRBM0xqazVOQ0F3SUM0MU9UWXRMalF3Tnk0NU9EUXRMak01Tnk0ek9TMHhMakExTnk0ek9Ea3RMalkxSURBdE1TNHdOVFl0TGpNNE9TMHVNems0TFM0ek9Ea3RMak01T0MwdU9UZzBJREF0TGpVNU55NHpPVGd0TGprNE5TNDBNRFl0TGpNNU55QXhMakExTmkwdU16azNJaTgrUEM5emRtYyspO2JhY2tncm91bmQtcmVwZWF0Om5vLXJlcGVhdDtiYWNrZ3JvdW5kLXNpemU6Y29udGFpbjtwYWRkaW5nLWxlZnQ6MzRweH1AbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOmRhcmspe2JvZHl7YmFja2dyb3VuZC1jb2xvcjojMjIyO2NvbG9yOiNkOWQ5ZDl9fTwvc3R5bGU+PG1ldGEgaHR0cC1lcXVpdj0icmVmcmVzaCIgY29udGVudD0iMzkwIj48L2hlYWQ+PGJvZHkgY2xhc3M9Im5vLWpzIj48ZGl2IGNsYXNzPSJtYWluLXdyYXBwZXIiIHJvbGU9Im1haW4iPjxkaXYgY2xhc3M9Im1haW4tY29udGVudCI+PG5vc2NyaXB0PjxkaXYgY2xhc3M9ImgyIj48c3BhbiBpZD0iY2hhbGxlbmdlLWVycm9yLXRleHQiPkVuYWJsZSBKYXZhU2NyaXB0IGFuZCBjb29raWVzIHRvIGNvbnRpbnVlPC9zcGFuPjwvZGl2Pjwvbm9zY3JpcHQ+PC9kaXY+PC9kaXY+PHNjcmlwdD4oZnVuY3Rpb24oKXt3aW5kb3cuX2NmX2NobF9vcHQ9e2N2SWQ6ICczJyxjWm9uZTogInZlcmlmeS5wb2tldHdvLm5ldCIsY1R5cGU6ICdtYW5hZ2VkJyxjUmF5OiAnOTA5YWIxZDdjYWU1OWU0NycsY0g6ICdrLmpCSVNuSmg3bzJJZng2alZWNjhreF9qVkVHVGdOYUxXMlBhMG1JQWkwLTE3MzgxNjkxNDgtMS4yLjEuMS1oOTdoVkpQWS4wNFFTMHdXYkl0eVJyc2p0WS5oTjVlZnpmaDJpUXRsQm9oeUlTOEczQW9rbUxVcmoxOGFSX0ptJyxjVVBNRFRrOiAiXC9jYXB0Y2hhXC8xMjM0NTY/X19jZl9jaGxfdGs9UWxGbHUzcDRlQzJUWXBLT2FEMjFuOHcxZ3JJXzExdkVuMzEudzYxbmRtVS0xNzM4MTY5MTQ4LTEuMC4xLjEtVVFFdGVQZTliN2NPaTJ5NTVTVEk3TWIxemR5M2F4ZnMweXlyTUo0Wk9uQSIsY0ZQV3Y6ICdnJyxjSVRpbWVTOiAnMTczODE2OTE0OCcsY1RUaW1lTXM6ICcxMDAwJyxjTVRpbWVNczogJzM5MDAwMCcsY1RwbEM6IDAsY1RwbFY6IDUsY1RwbEI6ICdjZicsY0s6ICIiLGZhOiAiXC9jYXB0Y2hhXC8xMjM0NTY/X19jZl9jaGxfZl90az1RbEZsdTNwNGVDMlRZcEtPYUQyMW44dzFncklfMTF2RW4zMS53NjFuZG1VLTE3MzgxNjkxNDgtMS4wLjEuMS1VUUV0ZVBlOWI3Y09pMnk1NVNUSTdNYjF6ZHkzYXhmczB5eXJNSjRaT25BIixtZDogIjM1QnJCMl9GajB0MlBkVXRmd2RMSjV1XzZBWklkXzd3Uk11MVhoX0xEcDQtMTczODE2OTE0OC0xLjIuMS4xLS5lMHF1QjZQUWFDa2xGQ0llTzBhUE9ZNHI0NWt5WjlDM3A4WmN5c2VwNTVXUS5oVjNUbW5UTkJHcVJncDh5Zlc0WmFQUktyWXB6WUVHVVpFM3JvR0lCYmRPN3hzZXRwNG8xMmpYSDFYMjh1a2Eya0pJTVlrMzNpcVJhcjNsVTJ0Qi5ucWxhZGNrZGhWNldxcktNcFF4TWo3dURsUjI3YXgzc0ttVUVnSlJqeVlYejF1WExUQi5oVXMud2doako4QUdNMllWQWtjb1FyZWw2Z0Z2ZThqV3pDa0NULk9ydTNpcHNhSEdYTC5BcHZjbUJqRTFoUnhhQVN3ZmdULjNhMUQxajRZdGYwMklKdTN4N3IwQmdEUkg0OUZnTzJXbzBIWGJmNTdBWGxfcXpSV01PeWZuMUt2QmdmaGVweGNQaU1GWWFXMU44NlVlUjdPbERoMzRFci5fWURjOUtKMlJHQ2s3WXB6cVJOblpSaks0NldwVmo2ekdZQklyU29PSEN5YlVDSk5hb0phN1h0RDdCM0FpV3JMWmlHd0JHcm40djRvS1NVM1RPN2x2cEtDNlhXNGhhdUx2M3p5U3h6alRhMEpMa0FvWTBicUp2aTlKLkNPZVdtSkVSRU1MbWNFbDJwYmZOeExxOG9faTdFcl94MG11eVdpTUZtc1pkU1praGJ6TEZ4cXhfbFBFX08uUnYzNHc5bEEzNmtFZXV3b3djUjBMMTN2ek4wSlBQU0lUdUtPdkRoSHQwbHR2cDZJZWFqenZmcGtqcUpIVW5kX3RzdlFTZnFPVUFXUG1YNVE1alRvTzdmS1dVNUpxMmV4MFRyQVB5N0xhaTlzRzh0X2lFZzFERVA5Rzl5YzBTT0hjLjUyOTRPOHhMaUlJblpRVmU2WVpSeVQydDVOaDlNdTlYMVN2V1BUcmNiajVPTEs3TVJEUVdMd3lsXzloQ09CN1pMcmxHdm9oWGJFY1J3eUJmcEFKWENPQlJjNUVvb3ZKdl85NG5icUN2UWtvS2YxeXlraEN3UWR4R0ZIZUNoNkdybmRQQWVkZnMwUFA3TzZrMVZnblRsNHdkU3ZxcTUwTkhFVURlQnp0eWpqQ2xxZFlLczhjS3Rwcm1PM2FDVk1lejdEcUhoTGwxVnhuaDdKZ0lXNExaT1ZOemwuWE5MSjVnRHE0Z28xaUFTSWNBem1rdFZMTTNEd3VsVkFmQXV4bVlrNkoxU2xhQS4wMWRrVm9Mb05oenVDWHdGMTdsdzRBQXNybEx3UlFPRmpwVFJINmxTMjllcnhqX2R4a052LkdGZzBwWENvbFBBT1dfTDV6T2VtNWNsSGtqODZBaEx2XzFMLnJPZG0xTVNYNW9UVmFzLloxd0lRM0swb0p2Rk5CUUY1Wk1aSjkwamxVUWQuU0Y1QWJKYWJtSUtkd0JnSmdrQjBrMDliVHpqQkwyQXNwSy42MWRPbVU1d254SFgyRzdlb2llNDVhSzloTUpVZVhrNl9QU293S2VrcWVFOUdheWlDZzBOQXlFY1ZIUlZaZ1JBV2t3enZOeC5pWkNmTFdleXFzVVFyQmRMdC5EVWw0dzF4Z2VMSFNWU01xRVFHOUpFNFc4VkwzM29rcjEzTnBnVVJkNXBvaHlSLnA4ZmlsRHpETm9CcGNyMVhXX21IZVlnWDcwcHZIUTBZYy5CajZ2Rms2N2tpVjdwelVoYmpoZWFEZVp3TUdTVmdfanFKMlpIUVRqeTh6S0F4VTdYcjE0NUt1ZGEuNjkzUkx5cmg4WEJBWWJCMFJtWXh3N3dKc053dE9TakZMWHFsRXVGWXBZbzYzb0RZaGRCOHlLLmxrZGFhUFRaaThVaTM1cGpVdVZLdjdMb2R5X2RUNncxNmNhUEliMkhDRndlMzh5UGs0aVFXZWpJaGU5R0E0SzVVVGpsNUpSTkFhaTlDbFF3U0d4T0tQVEFTRGRxT0FSZXlEZlVwQkVXZUpqNnlvU1dzaXRPa1RGcmVpeThCdVJjSm5Kb1JUQnVQeTFGYXRxbFlqQjZFYXJlaEk2Y3pkUXpEX3hWWUlBeHEudmJoY3NlTTgzZ1VtVGFzcXRiUEw3TDdndjAuak8wUUhMcC50bGlpYWd2d2pHd3AwSDdVb1kzOElXc0ZwRWRudVZVNzB2ZnRoQXpodkVsSjhZZ2pmYXRNZ3R3ZHV5N19ybnZXMDU5ZXJPdm9Cd1VXMzFidXFNSklKQmdyUENGZjc5T0VxZGNmbzJJOEs2alpLTF9IdnU0OFM3eHdNdTc2RlFudEFtTUZJc24uRDNrQk41ajRFZkNTOXl5X1JNVDFKOUR5LjhCT1p1WWNkemFqeGNwWUNhRTJFRG9kMXNiMllwaWhKN1JPLmplSUs5dVQ1aVVhTjVFTG0xQjREZXlYRkl2NEFBS0RBOTdqaTNNdU9sZVFGbU9iTW9HVzZoQ0plc19lRzNTalZiUk9ibXJMWDRmY1o5YUNEc01WSkdvN096WTQ5R0hIWG8xeExOTGw2aWdjZkd1NkU1aHNKbzVPRW4yYkZLdENrMFhTWVViU01qalk4UDg3TG9OWEtHTkJoZ0JSMmdLOE9XVHc4NHk4ajdtcU1kdml1d2toVzFwTVJkUkZoV2Exby5IUWFaR2NYdnRiUnNHS05mNExkRHU2czVsbXdNTFBBMEJETW40VzdiSUZZZDYxTzExaHJiWGtEYmg3VTlDOUZHVi42ejhPbEswMXlERVVCLjB6RDRFYmtid2RBN1lTQ0FMY0xEMGhmS2VrYXJUdTBMdEo2OTVXMDVkY1NZNmZfQ3JqcUdrd20yb1NiM2ZaUTR5aXZ1alBPUWFzSmtqTmdsWFY0UVJySTlrSDhnQzhzR0VETjRrUWQ3NnYyaHI5Q1Ywc09UX3NfR0s5TkRWOHpwR2R0RGNVZ0llSHJ1TlVHTUtzdVlHLktaekNJMUowcWdxeGtFc1dDb2FwNWpnenBrcXk5QkxHZmxTZFo1bG4xeFpsWVloNmhvaENHTXBJUDlqTy5wcDUzc0xNdFNYVzNmVC5SYTNVamJ2MERxQ1BkZkMyRHc4Q2p0eTNFT1V6Njh2SWNQRVNWd0RJY0Q3OGtCYnU0WV81ZlBvLkRVSjJkamhybkpyMkFwNVh2elFCSWJKQW5jTy5qRzEuYnAxd2dQcF9adUpXZ2VOMHFtMDY3T04zUHNMVnFKaWdWOUhfTVVXaW5jcnhZRTlSQklLd3ZocHdvakFEUy5fQkRnRHdyLnVCbHp0T1preHhmVDZ2LldMR0QxdHpidyIsbWRyZDogInIzNXN0S0l0N004THBINFY5aERFOGROZjB6ZWRGWm9laGg3WTEyMUdxTDAtMTczODE2OTE0OC0xLjIuMS4xLUtEaFhfOXBkQ0ROamNXSlBLRC5GakJZV0lrdHRNN3dnYS5NcW1rWkVIWkNjUUtrelk3ejZIVElqS2pWa2lmTVAuZThSMnJiaU1zcE8zcVFNLmhHNEhxU0RTcnlSMlc2dENuR0ZUQVExdjU4WHVKVGJDdFQ1NC5ScW9oTXRfZnJ4VUFWZk8uYlhQal80eE5wWXNRemwuSldOUGl3elFhWlFTQ0dGRmo4bWVnU0lFMDIzYjlMM3l1UGoycWZ6NDlTSWozZEdheTV0Tm5mUWouT1p2b2hlcTZRZFpKXy5YbmtxRFpIS0Z3bHNCMHJGZjNoUnc3V3BLMzVZN21BVVVORi5uRUlHcHZrUGpXN1kwS1hvWnRUTmpHWUlCWGs0cjV6b1E3X09HUFBDemdKQmlEaUd5WC5jQ1NMQkx5T19TOXpSeWtGNm5VR3N3LmI3b0Y4b1c2OWxZZWdYSXFMMXFpZVU5Qm9NbXdjQmRwRnlmTTZKWnJKVGYuZlU3MXY1NHNaWjgwTC5JaUZmM0U4TTZSdzl0U1g1YktHeTlZZ2Qxc0xHMDU2LmJfc0tQRkZDZnZoVmdsUDRLd3lFT01idFIzbE81ODhzOGhWLkIyS012Y29xM3NiTzV4d2FRUEg3S2p6aGdZVjl2MkREM3hXclhaOWc3VzB0Z00wc2ouS1BzS0VxQk1mdFJfeTVDeXI2cnc5LmVjX2cxak5ETUIwX1V2VUw5LkZ3QjF0bFp3ZVhaTHp5SzVocXd6Uy5ETnlSenI2M1E2VDdoZHNBbWRDNXo4aTZ1VkJ3Q25YRkdHcFNtYUd2UFIyODFfaUM3QXpKVjRGSDhGM0VDaVBaR21OTXdGb3p6UnVhREVYSlVTTlp6bm5HQWdHdjdTeGlLQVZkYjMwMTY1b1I5V3MxRkZEbEdJZ0dnX210aDNYZ0pnREZhN2RBQnVFRDZ5ejU2VDdGd2Y4SnBrSUlacnJIRml0UEM4WnpPUHI3WFEzZmNrVG1LRWtfLnB4ZVJHRzFmSFlnUkJBMzhJTERvSWgzYW5DSmtwUm9neUttOTAyVXRCb3BJaFFieEVQc1BCUzRkVy42T0xESnJMZnB1SVFsYXUwb0hYQ3NTN3R0U1ZlRVNLU3JpX0pvQk43SzNQWDZBR3phWndPaDE0SFIyWmJLenkwRUkxTm9nM2lzSTh6dDh0WWY2T2llOWJTVjdJdXFzRmk3Z2xiUGN3T3lmZUFTWWdxMzRvVVZ6SnZWZFFpcVJvemt0UmRWcU43OG5MVGFLNFU2NEl4b0I5SnkxNWNmM0ZiZzB6cDAxRXBpUVJ3azVJeW8uVE9keDIxRnE4dm1LbDBBSnVTRE9RMmRnZ1FoWE9iNjlTUGpjb3dKajFvbWZqTklFeUZDbjc3Nlc1RHBfVmU2SWtXWGx2c01pWlREcXM2SHc2S3NhVWhkbWRTWWVkZlhfdDJteGh5cjNqU3VjenAxRE82UmZPbmRUMVoxRlIwa3psRUFyeW16TkpWX0JDazZscjVqeHhMWjIwb3NCMU9obTV4WnNjZEh6TFNaM3BfdzdyX2x2Vy5jWVd6ZDV3NWFCQXJvQUNEYklja2guM0QzeS5xT2U5ZDZYS1lobWFvWGZvR2xTV3NsdkZvOTdCeFRwRzdfaFhMVVI1QWJHVVo2SU5wS25jSng5cEI3blJYUU9JUmkzU3BUNVlHaGwwSkZKbkJ0WUQuVFdlaXBoNVl3TVRqaEM3VEQzVzdzOFplWlp5Y3I5ZmRvRko1NXFjbTZoNERWQjVzUmZyVEF4RlJRYVFnOUc5Y0h3cEZHQU50bEZUbkZVVUpQRGZzOXVGbHJFZnpyOTM2YnNpRHAuTW9yREEwWDFMTnpPZjFlUE9INHRmeGdFOTZNV1RnLndFNU5DV2NBRnEuQ3J5Z0Z0dURIenBZajlKWjRVTTFzajRCQTFJUXhpNEI3R19TVjVhXzlrYzNBM0UxRkdjZWRTWUtlaXJ6cHBHVnpVR0dCaE1xdlpMQWtQSDNEQzZVN2VqZWFUWGRocmdPdEl2Tkp0RnN0dHljaHJZeXVjLmI3Y0paeUc2VEFoWmpPN0laSThDQUU0d25jUXdLMUt6Rk9yZ2UzbllQRUxsRWRRcUFVU3EuWFJ0QmFEYmNrWlBkWXBRam1uX0JtcG13RUZpM0dFcDI1VFdWam9la3EyN3Y2QlNJRzc4QkRBSmxTcnNvX2o5Um5OenVuVVlZOC5yRWdLTzl5QzFtTTlBdUtQTklsSDIzZ2pkUHR4cVZqbjY0NHBSb21qUS5hNEk1aC5xaDBIMUw1MzZlOExacVlBdEFINUFwV2VuYlhzZ0xDVkJpZzEwanVWVXZIbjFWbWJPNHBuVC5qVVFWUmQ4dnBKcFh6bzdHVEx5VHJsRnQ3MU8yb2F5Qk9GMXRqZG5kTWRXanA4QkV0Tkc1MmdRd2NMRGs5c3JaMWNmZFo3UXlLcU8zMTJjQlVEb3lDN1pjcGg2NEFzWUk5a3oxRGJpS0ZWVFhTdW1wcUZsc0RFTkpSTkJIcHVieXRIN1BVVFJfclNyY3E1SEhTb1hMZ3JTMU04YlFjbEZVWnptOU1YV1VySVNkYTRlSEZjRlVZSVJCdldLWnZvWGZueV8zTDZDTXpTM1JYQlJKV1NfWmRqR0swQWFUVDVrZm1WSnhzb3pKdWtIWjl6ZXprWUgzQ3VvNzB4MnlVQnF1VTZNb0dfRktyN2xxUGV6a0ZtZWRtam02b3JVOU1zR293SVlzaHNrdnVzaWsuNG9GS1hXeTJLMElGdDM0Q0NBcGdiZXV1WXFQNzh5ckNiMG4uUElRSWVLUnBUMmdLREpQYkRJSnlwT0FrQ2lFVEhqYUg5Slc1Y2lMQk9aU0ZfVDJfenQxaWlEOGFWMjFKQnhpR0gwZmFSTlZkc1ZiOVNkN3A3WFpUbHI5eVdCMDRiNDdOU2JMYUNSZTFDX0UuekU5WW51VGhMTTB1YmR1eHFCSkJ0T2p3V0FUVk5UUDcxU3ladXdrcEtKLllsT1p2U19obUVMdi45Y1ZTRDN4Z2JCTF96RlNtV1dHWmM5M2R6ZDRIX1cuNkRHWFNqbWdSVEozcm1weDZ4cjlHTEVUeXNwNEFFYXJ5d2tKYU5OOEF6Z0l4ZVE5MzBjOGtzOG5NMFBMWXhXRVBrZ3ZZdC5kdENvUVp3OG5DMzVjOWU4aV95UTNqN0VJd2J2QWs1QmVFanM4WmJKSDF4dGpuOHZ1LlZMd2puV084dXhEOEVOcFhGSzQ2X3pqSm9mT2paUFhXVnZjRVpBOFhfNW5NcU9PX2lyU283WXRUU2VNSGZfa1AuR3V3c0tkRyJ9O3ZhciBjcG8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzY3JpcHQnKTtjcG8uc3JjID0gJy9jZG4tY2dpL2NoYWxsZW5nZS1wbGF0Zm9ybS9oL2cvb3JjaGVzdHJhdGUvY2hsX3BhZ2UvdjE/cmF5PTkwOWFiMWQ3Y2FlNTllNDcnO3dpbmRvdy5fY2ZfY2hsX29wdC5jT2dVSGFzaCA9IGxvY2F0aW9uLmhhc2ggPT09ICcnICYmIGxvY2F0aW9uLmhyZWYuaW5kZXhPZignIycpICE9PSAtMSA/ICcjJyA6IGxvY2F0aW9uLmhhc2g7d2luZG93Ll9jZl9jaGxfb3B0LmNPZ1VRdWVyeSA9IGxvY2F0aW9uLnNlYXJjaCA9PT0gJycgJiYgbG9jYXRpb24uaHJlZi5zbGljZSgwLCBsb2NhdGlvbi5ocmVmLmxlbmd0aCAtIHdpbmRvdy5fY2ZfY2hsX29wdC5jT2dVSGFzaC5sZW5ndGgpLmluZGV4T2YoJz8nKSAhPT0gLTEgPyAnPycgOiBsb2NhdGlvbi5zZWFyY2g7aWYgKHdpbmRvdy5oaXN0b3J5ICYmIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSkge3ZhciBvZ1UgPSBsb2NhdGlvbi5wYXRobmFtZSArIHdpbmRvdy5fY2ZfY2hsX29wdC5jT2dVUXVlcnkgKyB3aW5kb3cuX2NmX2NobF9vcHQuY09nVUhhc2g7aGlzdG9yeS5yZXBsYWNlU3RhdGUobnVsbCwgbnVsbCwgIlwvY2FwdGNoYVwvMTIzNDU2P19fY2ZfY2hsX3J0X3RrPVFsRmx1M3A0ZUMyVFlwS09hRDIxbjh3MWdySV8xMXZFbjMxLnc2MW5kbVUtMTczODE2OTE0OC0xLjAuMS4xLVVRRXRlUGU5YjdjT2kyeTU1U1RJN01iMXpkeTNheGZzMHl5ck1KNFpPbkEiICsgd2luZG93Ll9jZl9jaGxfb3B0LmNPZ1VIYXNoKTtjcG8ub25sb2FkID0gZnVuY3Rpb24oKSB7aGlzdG9yeS5yZXBsYWNlU3RhdGUobnVsbCwgbnVsbCwgb2dVKTt9fWRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF0uYXBwZW5kQ2hpbGQoY3BvKTt9KCkpOzwvc2NyaXB0PjwvYm9keT48L2h0bWw+`,
              websiteURL: 'https://verify.poketwo.net/captcha/123456',
              websiteKey: '0x4AAAAAAADnPIDROrmt1Wwj',
              userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
              pageAction: 'managed',
              data: '909a667a38df0225',
              pageData:
                'L9t6LjaKrh_OVtIYUhi6sbB1qjvd4VknKdwWIYYY1T0-1738166061-1.3.1.1-PMmcnNAF8sq15Z81rB.4faDpRStfm48pjxf8HsX83xtaG8ZAjxGdGVoKacO1n3V3DRxhThbqJJHSa5tiRZ2d0xD.Vmz4t04eB8jri0VIePxhzOGq6498zH1Hf1Iikx4LBlJm3YEiOvtUjm9wkMsD3iiXT2IUWFF3q.x3X8MvL_StIGgQTQMuOTBdRk5uTFnG2rQn_llTjG4OTkW8KNx3sacYbInFnEoh1bOR2V_Tv74_fMOMGO46jp3fsT5dhKJB0kZE_yFfjiqhTtqQ_T9k92_fDx_d.JlV_BgREnWpe7WwyhZ8bQvIWeB5gP7h16qMacBgQPRdKh_vORg9v_BnUyfaM0YFtzeF.51BDgbw0DbmJIT0gUwagzo2Wl0g8A4ddfMOCfg.rc7H1U7nlX39pe8Y.1IdclzIcR_aS0vIHCRIMrLbg9czWeMFZO4ZTt05',
              proxyType: 'http',
              proxyAddress: `${config.proxy.ip}`,
              proxyPort: `${config.proxy.port}`,
              proxyLogin: `${config.proxy.username}`,
              proxyPassword: `${config.proxy.password}`,
            },
          };

          const response = await axios.post(
            'https://api.capmonster.cloud/createTask',
            payload
          );
          console.log('Capmonster Create Task Response:', response.data);

          if (
            !response.data ||
            response.data.errorId ||
            !response.data.taskId
          ) {
            log(
              `Failed to create task with Capmonster: ${JSON.stringify(response.data)}`
            );
            return false;
          }

          const task_id = response.data.taskId;
          log('Got taskId:', task_id);

          while (true) {
            try {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              const getResultPayload = {
                clientKey: capmonsterkey,
                taskId: task_id,
              };
              const taskResultResponse = await axios.post(
                'https://api.capmonster.cloud/getTaskResult',
                getResultPayload
              );
              console.log(
                'Capmonster Task Result Response:',
                taskResultResponse.data
              );
              const status = taskResultResponse.data.status;

              if (status === 'ready') {
                const solution = taskResultResponse.data.solution;
                this.cookieString = `cf_clearance=${solution.cf_clearance}`;
                //   console.log(solution.cf_clearance)

                this.userAgent =
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
                console.log(`Cookie String Set: ${this.cookieString}`); // Logs the cookie string

                console.log(`User-Agent Set: ${this.userAgent}`); // Logs the user-agent
                log('Generated cookie with Capmonster!'.green);
                this.validity = true;

                return true;
              }

              if (status === 'failed' || taskResultResponse.data.errorId) {
                log(
                  'Solve failed with Capmonster! response:',
                  taskResultResponse
                );
                this.validity = false;
                this.cookieString = ''; // Reset cookieString
                return false;
              }
            } catch (error) {
              log('Error while checking task result:', error.message);
              this.validity = false;
              this.cookieString = ''; // Reset cookieString
              return false;
            }
          }
        } catch (error) {
          log('Error while creating task with Capmonster:', error.message);
          return false;
        }
      }
      if (
        config.p2cloudflareservice === 'manualheadless' ||
        config.p2cloudflareservice === 'scrapeless'
      ) {
        let proxyURL = `http://${config.proxy.username}:${config.proxy.password}@${config.proxy.ip}:${config.proxy.port}`;
        log('Using manualheadless method to generate cookie...'.blue);

        try {
          const { browser, page } = await connect({
            headless: false,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              //    `--proxy-server=${proxyURL}`,
            ],
            customConfig: {},
            turnstile: true,
            fingerprint: true,
            browserWSEndpoint: `wss://browser.scrapeless.com/browser?token=${config.scrapeless}&session_ttl=900&proxy_url=http://${config.proxy.username}:${config.proxy.password}@${config.proxy.ip}:${config.proxy.port}`,
            connectOption: {},
            disableXvfb: true,
            ignoreAllFlags: false,
            proxy: {
              host: `${config.proxy.ip}`,
              port: `${config.proxy.port}`,
              username: `${config.proxy.username}`,
              password: `${config.proxy.password}`,
            },
            plugins: [require('puppeteer-extra-plugin-stealth')()],
          });

          // Navigate to the site protected by Cloudflare
          await page.goto('https://verify.poketwo.net/captcha/123', {
            waitUntil: 'networkidle2',
          });

          // Poll for the cf_clearance cookie dynamically
          const startTime = Date.now(); // Record the start time
          let cfClearance = null;

          while (Date.now() - startTime < 30000) {
            // Timeout after 30 seconds
            const cookies = await page.cookies();
            cfClearance = cookies.find(
              (cookie) => cookie.name === 'cf_clearance'
            );

            if (cfClearance) {
              const elapsedTime = Date.now() - startTime; // Calculate elapsed time
              console.log(
                `${cfClearance.name} cookie found: ${cfClearance.value}`
              );
              console.log(`Time taken to retrieve cookie: ${elapsedTime} ms`);
              break; // Exit loop once cookie is found
            }

            await new Promise((resolve) => setTimeout(resolve, 500)); // Poll every second
          }

          if (!cfClearance) {
            console.log('CF Clearance cookie not found.');
          }

          // Retrieve user-agent and accept-language headers
          const headers = await page.evaluate(() => {
            return {
              'user-agent': navigator.userAgent,
              'accept-language': navigator.language,
            };
          });
          console.log('Headers:', headers);

          // Close browser
          await browser.close();

          // Handle cookie validity
          if (cfClearance) {
            this.cookieString = `cf_clearance=${cfClearance.value}`;
            console.log(`Cookie String Set: ${this.cookieString}`); // Logs the cookie string

            this.userAgent = headers['user-agent'];
            console.log(`User-Agent Set: ${this.userAgent}`); // Logs the user-agent

            log('Generated cookie manually!'.green);

            this.validity = true;
            return true;
          } else {
            log('Unable to generate cookie manually!'.red);
            this.validity = false; // Ensure validity is reset on failure
            return false;
          }
        } catch (error) {
          log('An error occurred while generating the cookie manually.'.red);
          log(`Error: ${error.message}`.red);
          log(error.stack.red);
          this.validity = false; // Ensure validity is reset on failure
          return false;
        }
      }
      if (config.p2cloudflareservice === 'manual') {
        const isLinux = require('os').platform() === 'linux';

        if (isLinux) {
          log(
            'Detected Linux OS. Skipping manual method and switching to Scrappey...'
              .blue
          );

          // Define the payload for the Scrappey API
          const payload = {
            cloudflareBypass: true,
            cmd: 'request.get', // Command to execute
            url: 'https://verify.poketwo.net/captcha/1183988420893233244', // Target URL
            proxy: `http://${config.proxy.username}:${config.proxy.password}@${config.proxy.ip}:${config.proxy.port}`, // Proxy configuration
            retries: 3, // Number of retries
          };

          try {
            // Send the POST request to Scrappey API
            const response = await axios.post(
              `https://publisher.scrappey.com/api/v1?key=${config.scrappey}`, // Endpoint with API key
              payload, // Payload
              {
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            );

            console.log('Scrappey Response:', response.data);

            if (response.data?.solution?.statusCode === 200) {
              this.cookieString = response.data.solution.cookieString;
              this.userAgent = response.data.solution.userAgent;
              log('Generated cookie with Scrappey!'.green);
              this.validity = true;
              return true;
            } else {
              this.validity = false; // Reset validity to false on failure
              log('Unable to generate cookie with Scrappey!'.red);
              log(`Status Code: ${response.data?.solution?.statusCode}`.yellow);
              log(
                `Response: ${JSON.stringify(response.data?.solution)}`.yellow
              );
              return false;
            }
          } catch (error) {
            log('Error during Scrappey request:'.red, error.message);
            this.cookieString = ''; // Reset cookieString
            this.lastCookieGenerationTime = 0; // Reset lastCookieGenerationTime
            this.writeEpochToFile(0, ''); // Reset epoch and cookie value to 0 in case of error
            this.validity = false;
            return false;
          }
        }

        log('Using manual method to generate cookie...'.blue);

        try {
          const { browser, page } = await connect({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            customConfig: {},
            turnstile: true,
            fingerprint: true,

            connectOption: {},
            disableXvfb: true,
            ignoreAllFlags: false,
            plugins: [require('puppeteer-extra-plugin-stealth')()],
            proxy: {
              host: `${config.proxy.ip}`,
              port: `${config.proxy.port}`,
              username: `${config.proxy.username}`,
              password: `${config.proxy.password}`,
            },
          });

          // Navigate to the site protected by Cloudflare
          await page.goto('https://verify.poketwo.net/captcha/123', {
            waitUntil: 'networkidle2',
          });

          // Poll for the cf_clearance cookie dynamically
          const startTime = Date.now(); // Record the start time
          let cfClearance = null;

          while (Date.now() - startTime < 30000) {
            // Timeout after 30 seconds
            const cookies = await page.cookies();
            cfClearance = cookies.find(
              (cookie) => cookie.name === 'cf_clearance'
            );

            if (cfClearance) {
              const elapsedTime = Date.now() - startTime; // Calculate elapsed time
              console.log(
                `${cfClearance.name} cookie found: ${cfClearance.value}`
              );
              console.log(`Time taken to retrieve cookie: ${elapsedTime} ms`);
              break; // Exit loop once cookie is found
            }

            await new Promise((resolve) => setTimeout(resolve, 500)); // Poll every second
          }

          if (!cfClearance) {
            console.log('CF Clearance cookie not found.');
          }

          // Retrieve user-agent and accept-language headers
          const headers = await page.evaluate(() => {
            return {
              'user-agent': navigator.userAgent,
              'accept-language': navigator.language,
            };
          });
          console.log('Headers:', headers);

          // Close browser
          await browser.close();

          // Handle cookie validity
          if (cfClearance) {
            this.cookieString = `cf_clearance=${cfClearance.value}`;
            console.log(`Cookie String Set: ${this.cookieString}`); // Logs the cookie string

            this.userAgent = headers['user-agent'];
            console.log(`User-Agent Set: ${this.userAgent}`); // Logs the user-agent

            log('Generated cookie manually!'.green);

            this.validity = true;
            return true;
          } else {
            log('Unable to generate cookie manually!'.red);
            this.validity = false; // Ensure validity is reset on failure
            return false;
          }
        } catch (error) {
          log('An error occurred while generating the cookie manually.'.red);
          log(`Error: ${error.message}`.red);
          log(error.stack.red);
          this.validity = false; // Ensure validity is reset on failure
          return false;
        }
      } else {
        log('Invalid cloudflare service specified in config.'.red);
        return false;
      }
    } catch (error) {
      log('An error occurred while generating the cookie.'.red);
      log(`Error: ${error.message}`.red);
      log(error.stack.red);
      this.validity = false; // Ensure validity is reset on failure
      return false;
    }
  }

  async exchangeIDs(url, extraCookie) {
    try {
      const startTime = Date.now();

      const response = await fetch(url, {
        agent: this.agent,
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          priority: 'u=0, i',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'cross-site',
          'sec-fetch-user': '?1',
          'sec-gpc': '1',
          'upgrade-insecure-requests': '1',
          Connection: 'keep-alive',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          cookie: `${this.cookieString}; ${extraCookie}`,
          Referer: 'https://discord.com/',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'user-agent': this.userAgent,
        },
        method: 'GET',
      });

      const endTime = Date.now();
      log(`Request Time: ${endTime - startTime}ms`.yellow);

      if ([200, 301, 302, 307].includes(response.status)) {
        const redirectLocation = response.headers.get('location');
        if (redirectLocation) {
          log(`Redirected to: ${redirectLocation}`.green);
          return redirectLocation;
        }
        log('No redirection, returning final URL.'.green);
        return response.url;
      }

      throw new Error(`Unexpected status: ${response.status}`);
    } catch (error) {
      log('An error occurred during exchange of IDs.'.red);
      log(`Error: ${error.message}`.red);
      throw error; // Ensure the calling function knows it failed
    }
  }
}

function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

module.exports = P2Solver;
