
# 🎯 PokeTwo AutoCatcher Bot

An advanced Discord bot system for automated Pokemon catching in Poketwo servers with captcha solving, market operations, and comprehensive statistics tracking.

##  Features

### 🎣 **AutoCatching System**
- **Multi-Account Support**: Manage multiple bot accounts simultaneously
- **Intelligent Catching**: Automatic Pokemon identification and catching using hint solver and P2 Assistant integration
- **AI Integration**: FULL Ai
- **Quest Automation**: Automatic quest completion detection and coin tracking

###  **Advanced Captcha Solving**
- **Automatic Captcha Detection**: Real-time captcha monitoring
- **External Solver Integration**: HTTP-based captcha solving service
- **Webhook Notifications**: Discord webhook alerts for captcha events
- **Balance Monitoring**: API key usage tracking

###  **Comprehensive Statistics**
- **Real-time Stats**: Live catching statistics with pagination
- **Pokemon Categories**: Legendary, Shiny, Mythical, Ultra Beast, Rare IV tracking
- **Data Persistence**: Detailed pokemon data storage with timestamps
- **Visual Logging**: Rich embed logging with webhook integration

###  **Market Operations**
- **Interactive Market Panel**: GUI for pokemon purchasing
- **Auto-Transfer**: Automated pokecoin transfers
- **Account Management**: Multi-account market operations
- **Server Selection**: Cross-server market functionality

### 🛠️ **Administration**
- **Owner Management**: Multi-owner authorization system
- **Token Management**: Dynamic bot token addition/removal
- **Prefix Customization**: Configurable command prefixes
- **Error Handling**: Comprehensive error logging and recovery

##  Quick Start Setup

### Prerequisites
- Node.js 22+ 
- Discord bot tokens
- Captcha solver API key (optional)
- Discord webhook URLs

### Installation

1. **Clone or fork this Repl**

2. **Configure the bot** by editing `config.js`:
```javascript
module.exports = {
  botToken: "YOUR_MAIN_BOT_TOKEN",
  prefix: "!",
  owners: ["YOUR_DISCORD_ID"],
  captchaHook: "CAPTCHA_WEBHOOK_URL",
  logHook: "LOGGING_WEBHOOK_URL", 
  webHook: "ERROR_WEBHOOK_URL",
  captchaApiKey: "YOUR_CAPTCHA_API_KEY",
  captchaApiHostname: "zx.legend.online"
};
```

3. **Start the bot** by clicking the Run button or using:
```bash
node index.js
```

4. **Add bot tokens** using the command:
```
!add-token YOUR_SELFBOT_TOKEN
```

## 📋 Commands Reference

### ⚡ **System Commands**
- `!ping` - Check bot latency
- `!help` - Display command guide
- `!reload` - Restart all autocatcher instances
- `!set-prefix <prefix>` - Change command prefix

### 👑 **Administration**
- `!owner <id> <add/remove>` - Manage bot administrators
- `!add-token <token>` - Add new bot account
- `!current-tokens` - View connected accounts

### 🎣 **Catching Controls**
- `!catcher <id/start/stop>` - Toggle autocatcher
- `!ai-catch <id/start/stop>` - Toggle AI identification
- `!captcha <id/on/off>` - Manage captcha solver

### 📊 **Data & Analytics**
- `!stats` - View detailed statistics
- `!pokemon` - Browse caught Pokemon by categories

### 💰 **Market Operations**
- `!mpanel` - Open market panel
- `!m-start <token> <channel>` - Initialize market client
- `!m-stop` - Stop market client
- `!transfer` - Transfer pokecoins

### 🔧 **Captcha Solver**
- `!solver <token> <userid>` - Test captcha solver
- `!balance` - Check API key balance

## 🎮 Selfbot Commands

When using the selfbot accounts, you can use these commands in Discord:

- `.click [button] [row]` - Click buttons on messages (reply to message)
- `.say <message>` - Send message (use `p2` for Poketwo mentions)
- `.bal` - Check balance
- `.incense` - Buy and activate incense
- `.mbuy <id>` - Buy from market

## 📁 Project Structure

```
├── autocatcher/          # Core autocatcher logic
│   ├── index.js         # Main AutoCatcher class
│   └── market.js        # Market operations
├── functions/           # Utility functions
│   ├── functions.js     # Core bot functions
│   └── markett.js       # Market transfer logic
├── market/              # Market panel system
│   └── marketPanel.js   # Interactive market interface
├── utils/               # Utility modules
│   ├── api.js          # External API integrations
│   ├── captchaSolver.js # Captcha solving logic
│   └── utils.js        # General utilities
├── config.js           # Configuration file
└── index.js           # Main bot entry point
```

## 🔧 Configuration

### Environment Setup
The bot automatically installs dependencies based on `package.json`. Key dependencies include:
- `discord.js` - Main bot framework
- `discord.js-selfbot-v13` - Selfbot functionality
- `pokehint` - Pokemon identification
- `axios` - HTTP requests
- `colors` - Console logging

### Webhook Configuration
Set up Discord webhooks for:
- **Captcha Hook**: Captcha solving notifications
- **Log Hook**: Pokemon catching logs
- **Error Hook**: Error and crash reports

### API Configuration
- **Captcha API**: Configure hostname and API key for captcha solving
- **Pokemon ID API**: Integrated Pokemon identification service

## 🔐 Security Features

- **Token Validation**: Automatic token verification
- **Owner Authorization**: Multi-level permission system
- **Error Recovery**: Comprehensive error handling
- **Rate Limiting**: Built-in Discord rate limit handling

## 📈 Statistics Tracking

The bot tracks extensive statistics including:
- Total catches and success rates
- Pokemon rarity distribution
- Shiny and rare IV catches
- Pokecoin earnings and transfers
- Quest completions
- Market transactions



## 📞 Support

For issues or questions:
1. Check the console logs for error details
2. Verify all configuration values
3. Ensure all tokens are valid
4. Check webhook URLs are accessible
5. Ultimately tou can owner the developer shuu0001

## 🚀 Deployment

---

**Made with ❤️ for ruining this Community**
