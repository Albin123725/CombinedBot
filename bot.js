const mineflayer = require('mineflayer');
const express = require('express');

// Create a simple web server for Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Minecraft Bot Rotation System',
    features: ['Fighter Bot', 'Herobrine Bot', 'Night Sleep', 'Auto Rotation']
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start the web server
app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// Configuration
const SERVER_IP = 'gameplannet.aternos.me';
const SERVER_PORT = 51270;
const BOT_USERNAMES = ['FighterBot', 'HerobrineBot'];

class BotManager {
    constructor() {
        this.currentBotIndex = 0;
        this.currentBot = null;
        this.isNight = false;
        this.isSleeping = false;
        this.isFighting = false;
        this.currentTask = null;
        this.botStatus = 'starting';
        
        this.startBotRotation();
    }

    startBotRotation() {
        console.log('🔄 Starting bot rotation system...');
        this.botStatus = 'starting';
        this.connectBot();
    }

    connectBot() {
        const username = BOT_USERNAMES[this.currentBotIndex];
        const mode = this.currentBotIndex === 0 ? 'fighter' : 'herobrine';
        
        console.log(`🎮 Connecting ${mode.toUpperCase()} bot: ${username}`);
        this.botStatus = `connecting_${mode}`;
        
        this.currentBot = mineflayer.createBot({
            host: SERVER_IP,
            port: SERVER_PORT,
            username: username,
            version: '1.21.10',
            auth: 'offline',
            checkTimeoutInterval: 60000, // Increase timeout
            logErrors: true
        });

        this.setupEventHandlers(mode);
    }

    setupEventHandlers(mode) {
        const bot = this.currentBot;

        bot.on('login', () => {
            console.log(`✅ ${mode.toUpperCase()} bot logged in successfully`);
            this.botStatus = `connected_${mode}`;
        });

        bot.on('spawn', () => {
            console.log(`🌍 ${mode.toUpperCase()} bot spawned in world`);
            this.botStatus = `active_${mode}`;
            
            setTimeout(() => {
                bot.chat(`Hello! ${mode.toUpperCase()} mode activated!`);
                this.checkTimeAndSleep();
            }, 3000);

            // Start day/night cycle monitoring
            this.startTimeMonitoring();
            
            // Start mode-specific activities
            if (mode === 'fighter') {
                this.startFighterActivities();
            } else {
                this.startHerobrineActivities();
            }
        });

        bot.on('death', () => {
            console.log(`💀 ${mode.toUpperCase()} bot died`);
            this.isFighting = false;
            this.botStatus = `dead_${mode}`;
            setTimeout(() => {
                bot.chat('I died! But I will be back...');
                this.botStatus = `active_${mode}`;
            }, 2000);
        });

        bot.on('kicked', (reason) => {
            console.log(`🚫 ${mode.toUpperCase()} bot kicked:`, reason);
            this.botStatus = 'kicked';
            this.rotateToNextBot();
        });

        bot.on('error', (err) => {
            console.log(`❌ ${mode.toUpperCase()} bot error:`, err.message);
            this.botStatus = 'error';
            this.rotateToNextBot();
        });

        bot.on('end', () => {
            console.log(`🔌 ${mode.toUpperCase()} bot disconnected`);
            this.botStatus = 'disconnected';
            this.rotateToNextBot();
        });

        // Common chat commands
        bot.on('chat', (username, message) => {
            if (username === bot.username) return;

            const msg = message.toLowerCase();
            
            if (msg === 'hi' || msg === 'hello' || msg === 'hey') {
                bot.chat(`Hello ${username}!`);
            }
            
            if (msg === '!mode') {
                bot.chat(`I'm in ${mode.toUpperCase()} mode!`);
            }
            
            if (msg === '!rotate') {
                bot.chat('Rotating to next bot...');
                this.manualRotate();
            }
            
            if (msg === '!help') {
                this.showHelp(mode);
            }
            
            if (msg === '!status') {
                this.showStatus(mode);
            }
            
            if (msg === '!sleep') {
                this.forceSleep();
            }
            
            if (msg === '!wake') {
                this.forceWake();
            }

            // Mode-specific commands
            if (mode === 'fighter') {
                this.handleFighterCommands(username, msg);
            } else {
                this.handleHerobrineCommands(username, msg);
            }
        });
    }

    handleFighterCommands(username, msg) {
        const bot = this.currentBot;
        
        if (this.isNight) {
            if (msg.startsWith('!')) {
                bot.chat('I am sleeping at night. Wait for daytime.');
            }
            return;
        }
        
        if (msg === '!attack me') {
            this.attackPlayer(username);
        }
        
        if (msg === '!stop attack') {
            this.stopAttack();
        }
        
        if (msg === '!guard') {
            this.guardArea();
        }
        
        if (msg === '!follow me') {
            this.followPlayer(username);
        }
        
        if (msg === '!stop follow') {
            this.stopFollow();
        }
        
        if (msg === '!come') {
            this.comeToPlayer(username);
        }
        
        if (msg === '!explore') {
            this.exploreArea();
        }
    }

    handleHerobrineCommands(username, msg) {
        const bot = this.currentBot;
        
        if (this.isNight) {
            if (msg.startsWith('!')) {
                bot.chat('Even Herobrine sleeps at night...');
            }
            return;
        }
        
        if (msg.includes('herobrine') || msg.includes('hb') || msg.includes('ghost')) {
            this.respondToMention(username);
        }
        
        if (msg === '!disappear') {
            this.disappear();
        }
        
        if (msg === '!appear') {
            this.appear();
        }
        
        if (msg === '!scare') {
            this.scaryAction();
        }
        
        if (msg === '!stalk') {
            this.stalkPlayer(username);
        }
        
        if (msg === '!stop stalk') {
            this.stopStalking();
        }
        
        if (msg === '!message') {
            this.sendCreepyMessage();
        }
    }

    // Time and Sleep Management
    startTimeMonitoring() {
        // Check time every 30 seconds
        setInterval(() => {
            this.checkTimeAndSleep();
        }, 30000);
    }

    checkTimeAndSleep() {
        if (!this.currentBot.entity) return;
        
        const time = this.currentBot.time.timeOfDay;
        const wasNight = this.isNight;
        
        // Minecraft time: 0-23999, night is roughly 13000-23000
        this.isNight = time >= 13000 && time <= 23000;
        
        if (this.isNight && !wasNight) {
            // Just became night
            this.goToSleep();
        } else if (!this.isNight && wasNight) {
            // Just became day
            this.wakeUp();
        }
    }

    goToSleep() {
        if (this.isSleeping) return;
        
        console.log('Night time detected. Bot going to sleep...');
        this.isSleeping = true;
        this.isFighting = false;
        
        const bot = this.currentBot;
        
        // Stop all activities
        this.clearTasks();
        
        // Chat message
        setTimeout(() => {
            bot.chat('Time to sleep. Good night!');
        }, 2000);
    }

    wakeUp() {
        if (!this.isSleeping) return;
        
        console.log('Day time detected. Bot waking up...');
        this.isSleeping = false;
        
        const bot = this.currentBot;
        const mode = this.currentBotIndex === 0 ? 'fighter' : 'herobrine';
        
        bot.chat('Good morning! Time for activities!');
    }

    forceSleep() {
        if (!this.isNight) {
            this.currentBot.chat("It's not night time yet! I only sleep at night.");
            return;
        }
        this.goToSleep();
    }

    forceWake() {
        if (this.isNight) {
            this.currentBot.chat("It's still night time! I should sleep.");
            return;
        }
        this.wakeUp();
    }

    // Bot Rotation System
    rotateToNextBot() {
        console.log('Rotating to next bot...');
        
        // Clean up current bot
        if (this.currentBot) {
            try {
                this.currentBot.quit();
            } catch (e) {
                console.log('Error during bot cleanup:', e);
            }
            this.currentBot = null;
        }
        
        // Switch to next bot
        this.currentBotIndex = (this.currentBotIndex + 1) % BOT_USERNAMES.length;
        
        console.log(`Next bot: ${BOT_USERNAMES[this.currentBotIndex]}`);
        
        // Wait 10 seconds before connecting next bot
        setTimeout(() => {
            this.connectBot();
        }, 10000);
    }

    manualRotate() {
        console.log('Manual rotation triggered');
        this.rotateToNextBot();
    }

    clearTasks() {
        if (this.currentTask) {
            clearInterval(this.currentTask);
            this.currentTask = null;
        }
    }

    // Fighter Methods
    startFighterActivities() {
        if (this.isNight) return;
        
        console.log('Starting fighter daytime activities');
        
        // Auto activities if idle
        this.currentTask = setInterval(() => {
            if (!this.isNight && !this.isFighting && Math.random() < 0.3) {
                this.randomMovement();
            }
        }, 60000);
    }

    attackPlayer(username) {
        if (this.isNight) {
            this.currentBot.chat('Sleeping at night. No fighting.');
            return;
        }
        
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.isFighting = true;
            
            // Look at player
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
            
            this.currentBot.chat(`Attacking ${username}!`);
            
            // Stop fighting after 15 seconds
            setTimeout(() => {
                this.stopAttack();
            }, 15000);
        } else {
            this.currentBot.chat(`I can't see ${username} nearby.`);
        }
    }

    stopAttack() {
        this.isFighting = false;
        this.currentBot.chat('Combat stopped.');
    }

    guardArea() {
        if (this.isNight) {
            this.currentBot.chat('Sleeping at night. No guarding.');
            return;
        }
        
        this.currentBot.chat('Guarding this area!');
        this.guardBehavior();
    }

    guardBehavior() {
        this.clearTasks();
        this.currentTask = setInterval(() => {
            if (this.isNight || !this.currentBot.entity || this.isFighting) {
                this.clearTasks();
                return;
            }
            
            // Look around slowly
            this.currentBot.look(
                this.currentBot.entity.yaw + 0.5,
                this.currentBot.entity.pitch,
                true
            );
            
        }, 3000);
    }

    followPlayer(username) {
        if (this.isNight) {
            this.currentBot.chat('Sleeping at night. No following.');
            return;
        }
        
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.currentBot.chat(`Following ${username}!`);
            this.followBehavior(username);
        }
    }

    followBehavior(username) {
        this.clearTasks();
        this.currentTask = setInterval(() => {
            const player = this.currentBot.players[username];
            if (!player || !player.entity || this.isNight) {
                this.clearTasks();
                return;
            }
            
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
            
        }, 2000);
    }

    stopFollow() {
        this.clearTasks();
        this.currentBot.chat('Stopped following.');
    }

    comeToPlayer(username) {
        if (this.isNight) {
            this.currentBot.chat('Sleeping at night. Cannot come.');
            return;
        }
        
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
            this.currentBot.chat(`Coming to ${username}!`);
        }
    }

    exploreArea() {
        if (this.isNight) {
            this.currentBot.chat('Sleeping at night. No exploring.');
            return;
        }
        
        this.currentBot.chat('Exploring the area!');
        this.randomMovement();
    }

    randomMovement() {
        if (!this.currentBot.entity || this.isNight) return;
        
        // Simple random looking around
        this.currentBot.look(
            Math.random() * Math.PI * 2,
            Math.random() * 0.4 - 0.2,
            true
        );
    }

    // Herobrine Methods
    startHerobrineActivities() {
        if (this.isNight) return;
        
        console.log('Starting Herobrine daytime activities');
        
        // Random behaviors
        this.currentTask = setInterval(() => {
            if (!this.isNight && Math.random() < 0.2) {
                this.randomHerobrineBehavior();
            }
        }, 120000);
    }

    respondToMention(username) {
        if (this.isNight) {
            this.currentBot.chat('Zzz... sleeping...');
            return;
        }
        
        const responses = [
            '...',
            'You called?',
            'I am here...',
            'Why do you speak my name?'
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        this.currentBot.chat(response);
        
        setTimeout(() => {
            this.stareAtPlayer(username);
        }, 1000);
    }

    disappear() {
        if (this.isNight) {
            this.currentBot.chat('Already disappeared for sleep...');
            return;
        }
        
        this.currentBot.chat('*vanishes into the shadows*');
        this.clearTasks();
    }

    appear() {
        if (this.isNight) {
            this.currentBot.chat('Still sleeping...');
            return;
        }
        
        this.currentBot.chat('*appears suddenly*');
        this.stareAtNearestPlayer();
    }

    scaryAction() {
        if (this.isNight) {
            this.currentBot.chat('Too sleepy to scare...');
            return;
        }
        
        const actions = [
            'The walls are watching...',
            '*whispers* I see you...',
            'Darkness approaches...'
        ];
        
        const action = actions[Math.floor(Math.random() * actions.length)];
        this.currentBot.chat(action);
        this.stareAtNearestPlayer();
    }

    stalkPlayer(username) {
        if (this.isNight) {
            this.currentBot.chat('Sleeping, not stalking...');
            return;
        }
        
        this.currentBot.chat(`Stalking ${username}...`);
        this.followBehavior(username);
    }

    stopStalking() {
        this.clearTasks();
        this.currentBot.chat('No longer stalking...');
    }

    sendCreepyMessage() {
        if (this.isNight) {
            this.currentBot.chat('Sleeping... no messages...');
            return;
        }
        
        const messages = [
            'The end is near...',
            'They are watching...',
            'Your world is a lie...',
            'The voices speak...'
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.currentBot.chat(message);
    }

    randomHerobrineBehavior() {
        const behaviors = [
            () => this.sendCreepyMessage(),
            () => this.stareAtNearestPlayer(),
            () => this.currentBot.chat('*laughs eerily*')
        ];
        
        const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        behavior();
    }

    stareAtPlayer(username) {
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
        }
    }

    stareAtNearestPlayer() {
        const nearestPlayer = Object.values(this.currentBot.players)
            .filter(player => player.entity && player.username !== this.currentBot.username)
            .sort((a, b) => a.entity.position.distanceTo(this.currentBot.entity.position) - b.entity.position.distanceTo(this.currentBot.entity.position))[0];
        
        if (nearestPlayer) {
            this.currentBot.lookAt(nearestPlayer.entity.position.offset(0, 1.6, 0));
        }
    }

    // Help and Status Methods
    showHelp(mode) {
        const commonHelp = [
            '=== BOT COMMANDS ===',
            '!help - Show this help',
            '!mode - Check current mode',
            '!rotate - Switch bots manually', 
            '!status - Bot status',
            '!sleep - Force sleep (night only)',
            '!wake - Force wake (day only)'
        ];
        
        const fighterHelp = [
            '',
            '=== FIGHTER COMMANDS ===',
            '!attack me - Attack you',
            '!stop attack - Stop attacking',
            '!guard - Guard area',
            '!follow me - Follow you',
            '!stop follow - Stop following',
            '!come - Come to your position',
            '!explore - Explore area'
        ];
        
        const herobrineHelp = [
            '',
            '=== HEROBRINE COMMANDS ===',
            'Say "herobrine" - Summon me',
            '!disappear - Vanish',
            '!appear - Reappear',
            '!scare - Scary action', 
            '!stalk - Stalk player',
            '!stop stalk - Stop stalking',
            '!message - Creepy message'
        ];
        
        const helpMessages = [...commonHelp];
        if (mode === 'fighter') {
            helpMessages.push(...fighterHelp);
        } else {
            helpMessages.push(...herobrineHelp);
        }
        
        helpMessages.forEach((msg, index) => {
            setTimeout(() => {
                if (this.currentBot) {
                    this.currentBot.chat(msg);
                }
            }, index * 100);
        });
    }

    showStatus(mode) {
        const timeStatus = this.isNight ? 'Sleeping' : 'Active';
        const players = Object.keys(this.currentBot.players).filter(p => p !== this.currentBot.username);
        const health = Math.floor(this.currentBot.health);
        
        this.currentBot.chat(`Status: ${mode.toUpperCase()} | ${timeStatus} | Health: ${health} | Nearby: ${players.length} players`);
    }
}

// Add status endpoint to web server
app.get('/status', (req, res) => {
    if (!botManager.currentBot) {
        return res.json({ 
            status: 'no_bot_connected',
            message: 'No bot is currently connected'
        });
    }
    
    const mode = botManager.currentBotIndex === 0 ? 'fighter' : 'herobrine';
    res.json({
        status: 'online',
        current_bot: BOT_USERNAMES[botManager.currentBotIndex],
        mode: mode,
        bot_status: botManager.botStatus,
        is_night: botManager.isNight,
        is_sleeping: botManager.isSleeping,
        server: `${SERVER_IP}:${SERVER_PORT}`,
        timestamp: new Date().toISOString()
    });
});

// Start the bot manager
console.log('Starting Minecraft Bot Rotation System');
console.log('Server:', SERVER_IP + ':' + SERVER_PORT);
console.log('Version: 1.21.10');
console.log('Night Sleep: Enabled');
console.log('Auto Rotation: On Disconnect');

const botManager = new BotManager();

// Handle process events
process.on('SIGINT', () => {
    console.log('Shutting down bot system...');
    if (botManager.currentBot) {
        botManager.currentBot.quit();
    }
    process.exit();
});

module.exports = botManager;
