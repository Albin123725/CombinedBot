const mineflayer = require('mineflayer');
const http = require('http');

// Create a simple HTTP server for Render
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      service: 'Minecraft Bot Rotation System',
      current_bot: botManager?.currentBotIndex === 0 ? 'Keeper' : 'HeroBrine',
      mode: botManager?.currentBotIndex === 0 ? 'keeper' : 'herobrine',
      is_night: botManager?.isNight || false,
      is_sleeping: botManager?.isSleeping || false,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Use Render's port or default to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Health server running on port ${PORT}`);
});

// Configuration
const SERVER_IP = 'gameplannet.aternos.me';
const SERVER_PORT = 51270;
const BOT_USERNAMES = ['Keeper', 'HeroBrine'];

class BotManager {
    constructor() {
        this.currentBotIndex = 0;
        this.currentBot = null;
        this.isNight = false;
        this.isSleeping = false;
        this.currentTask = null;
        this.activityInterval = null;
        this.botStatus = 'starting';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.lastConnectionAttempt = 0;
        this.connectionCooldown = 30000; // 30 seconds cooldown
        
        // Start bot after a short delay to let health server start
        setTimeout(() => {
            this.startBotRotation();
        }, 5000);
    }

    startBotRotation() {
        console.log('🔄 Starting bot rotation system...');
        this.botStatus = 'starting';
        this.connectBot();
    }

    canConnect() {
        const now = Date.now();
        const timeSinceLastAttempt = now - this.lastConnectionAttempt;
        
        if (timeSinceLastAttempt < this.connectionCooldown) {
            const remaining = Math.ceil((this.connectionCooldown - timeSinceLastAttempt) / 1000);
            console.log(`⏳ Connection cooldown: ${remaining}s remaining`);
            return false;
        }
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached. Waiting before retrying...`);
            setTimeout(() => {
                this.reconnectAttempts = 0;
                console.log('🔄 Resetting connection attempts counter');
            }, 60000);
            return false;
        }
        
        return true;
    }

    connectBot() {
        if (!this.canConnect()) {
            const retryTime = this.connectionCooldown;
            console.log(`⏰ Will retry connection in ${retryTime/1000} seconds...`);
            setTimeout(() => this.connectBot(), retryTime);
            return;
        }

        this.lastConnectionAttempt = Date.now();
        this.reconnectAttempts++;

        const username = BOT_USERNAMES[this.currentBotIndex];
        const mode = this.currentBotIndex === 0 ? 'keeper' : 'herobrine';
        
        console.log(`🎮 Connecting ${mode.toUpperCase()} bot: ${username} (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.botStatus = `connecting_${mode}`;
        
        try {
            this.currentBot = mineflayer.createBot({
                host: SERVER_IP,
                port: SERVER_PORT,
                username: username,
                version: '1.21.10',
                auth: 'offline',
                checkTimeoutInterval: 30000,
                logErrors: true,
                connectTimeout: 30000,
            });

            this.setupEventHandlers(mode);
        } catch (error) {
            console.log('❌ Error creating bot:', error);
            this.scheduleNextRotation();
        }
    }

    setupEventHandlers(mode) {
        const bot = this.currentBot;

        bot.on('login', () => {
            console.log(`✅ ${mode.toUpperCase()} bot logged in successfully`);
            this.botStatus = `connected_${mode}`;
            this.reconnectAttempts = 0;
        });

        bot.on('spawn', () => {
            console.log(`🌍 ${mode.toUpperCase()} bot spawned in world`);
            this.botStatus = `active_${mode}`;
            
            // Start day/night cycle monitoring immediately
            this.startTimeMonitoring();
            
            // Start activities
            if (mode === 'keeper') {
                this.startKeeperActivities();
            } else {
                this.startHerobrineActivities();
            }
            
            setTimeout(() => {
                if (bot.entity) {
                    bot.chat(`${mode === 'keeper' ? '🛡️' : '👻'} ${mode.toUpperCase()} mode activated!`);
                }
            }, 3000);
        });

        bot.on('death', () => {
            console.log(`💀 ${mode.toUpperCase()} bot died`);
            this.botStatus = `dead_${mode}`;
            setTimeout(() => {
                if (bot.entity) {
                    bot.chat('I died! But I will be back...');
                    this.botStatus = `active_${mode}`;
                }
            }, 2000);
        });

        bot.on('kicked', (reason) => {
            console.log(`🚫 ${mode.toUpperCase()} bot kicked:`, reason);
            this.botStatus = 'kicked';
            
            if (reason.includes('throttled') || reason.includes('wait')) {
                console.log('⚠️ Connection throttled detected - increasing cooldown');
                this.connectionCooldown = 60000;
            }
            
            this.scheduleNextRotation();
        });

        bot.on('error', (err) => {
            console.log(`❌ ${mode.toUpperCase()} bot error:`, err.message);
            this.botStatus = 'error';
            
            if (err.code === 'ECONNRESET' || err.message.includes('timeout')) {
                console.log('⚠️ Connection error detected - increasing cooldown');
                this.connectionCooldown = 45000;
            }
            
            this.scheduleNextRotation();
        });

        bot.on('end', () => {
            console.log(`🔌 ${mode.toUpperCase()} bot disconnected`);
            this.botStatus = 'disconnected';
            this.scheduleNextRotation();
        });

        // Common chat commands
        bot.on('chat', (username, message) => {
            if (username === bot.username) return;

            const msg = message.toLowerCase();
            
            if (msg === 'hi' || msg === 'hello' || msg === 'hey') {
                if (!this.isSleeping) {
                    bot.chat(`Hello ${username}! ${mode === 'keeper' ? '🛡️' : '👻'}`);
                } else {
                    bot.chat('💤 Zzz... sleeping...');
                }
            }
            
            if (msg === '!mode') {
                bot.chat(`I'm in ${mode.toUpperCase()} mode! ${this.isSleeping ? '💤 Sleeping' : (mode === 'keeper' ? '⚔️' : '💀')}`);
            }
            
            if (msg === '!rotate') {
                bot.chat('🔄 Manually rotating to next bot...');
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
            if (!this.isSleeping) {
                if (mode === 'keeper') {
                    this.handleKeeperCommands(username, msg);
                } else {
                    this.handleHerobrineCommands(username, msg);
                }
            } else if (msg.startsWith('!')) {
                bot.chat('💤 I am sleeping. Commands disabled until morning.');
            }
        });
    }

    scheduleNextRotation() {
        let delay;
        if (this.reconnectAttempts <= 2) {
            delay = 30000;
        } else if (this.reconnectAttempts <= 4) {
            delay = 60000;
        } else {
            delay = 120000;
        }

        console.log(`⏰ Scheduling next rotation in ${delay/1000} seconds...`);
        
        setTimeout(() => {
            this.rotateToNextBot();
        }, delay);
    }

    rotateToNextBot() {
        console.log('🔄 Rotating to next bot...');
        
        // Clean up current bot properly
        this.stopAllActivities();
        if (this.currentBot && this.currentBot.end) {
            try {
                this.currentBot.end(); // Use end() instead of quit()
            } catch (e) {
                console.log('Error during bot cleanup:', e.message);
            }
            this.currentBot = null;
        }
        
        // Reset cooldown to default
        this.connectionCooldown = 30000;
        
        // Switch to next bot
        this.currentBotIndex = (this.currentBotIndex + 1) % BOT_USERNAMES.length;
        
        console.log(`Next bot: ${BOT_USERNAMES[this.currentBotIndex]}`);
        
        // Connect the next bot
        this.connectBot();
    }

    manualRotate() {
        console.log('Manual rotation triggered');
        this.reconnectAttempts = 0;
        this.rotateToNextBot();
    }

    // ========== SIMPLE SLEEP SYSTEM ==========
    
    startTimeMonitoring() {
        // Check time every 30 seconds
        const timeCheck = setInterval(() => {
            if (!this.currentBot?.entity) {
                clearInterval(timeCheck);
                return;
            }
            this.checkTimeAndSleep();
        }, 30000);
    }

    checkTimeAndSleep() {
        if (!this.currentBot?.entity) return;
        
        const time = this.currentBot.time.timeOfDay;
        const wasNight = this.isNight;
        
        // Minecraft time: 0-23999, night is roughly 13000-23000
        this.isNight = time >= 13000 && time <= 23000;
        
        console.log(`⏰ Time: ${time}, Night: ${this.isNight}, Sleeping: ${this.isSleeping}`);
        
        if (this.isNight && !wasNight && !this.isSleeping) {
            console.log('🌙 Night time detected. Going to sleep...');
            this.goToSleep();
        } else if (!this.isNight && wasNight && this.isSleeping) {
            console.log('☀️ Day time detected. Waking up...');
            this.wakeUp();
        }
    }

    isNightTime() {
        if (!this.currentBot?.time || this.currentBot.time.timeOfDay === undefined) return false;
        const timeOfDay = this.currentBot.time.timeOfDay;
        return timeOfDay >= 13000 && timeOfDay < 23000;
    }

    async goToSleep() {
        if (this.isSleeping) return;
        
        console.log('💤 ACTIVATING SLEEP MODE...');
        this.isSleeping = true;
        
        const bot = this.currentBot;
        const mode = this.currentBotIndex === 0 ? 'keeper' : 'herobrine';
        
        // STOP ALL ACTIVITIES
        this.stopAllActivities();
        
        // Simple sleep - just stop moving and chat
        if (bot.entity) {
            bot.chat(mode === 'keeper' ? '💤 Time to sleep. Good night!' : '💤 Even shadows need rest...');
            
            // Stop pathfinding
            if (bot.pathfinder) {
                bot.pathfinder.setGoal(null);
            }
        }
        
        // Set minimal sleep behavior
        this.setSleepBehavior();
    }

    wakeUp() {
        if (!this.isSleeping) return;
        
        console.log('☀️ WAKING UP FROM SLEEP...');
        this.isSleeping = false;
        
        const bot = this.currentBot;
        const mode = this.currentBotIndex === 0 ? 'keeper' : 'herobrine';
        
        // Clear sleep behavior
        this.stopAllActivities();
        
        if (bot.entity) {
            bot.chat(mode === 'keeper' ? '☀️ Good morning! Ready to protect!' : '☀️ The darkness returns...');
        }
        
        // Resume activities
        const currentMode = this.currentBotIndex === 0 ? 'keeper' : 'herobrine';
        if (currentMode === 'keeper') {
            this.startKeeperActivities();
        } else {
            this.startHerobrineActivities();
        }
    }

    setSleepBehavior() {
        const bot = this.currentBot;
        if (!bot.entity) return;
        
        // Very minimal activity while sleeping
        this.currentTask = setInterval(() => {
            if (!this.isSleeping || !bot.entity) {
                this.stopAllActivities();
                return;
            }
            
            // Occasional small head movements to appear alive
            if (Math.random() < 0.1) {
                bot.look(
                    bot.entity.yaw + (Math.random() - 0.5) * 0.2,
                    bot.entity.pitch,
                    true
                );
            }
        }, 15000);
    }

    stopAllActivities() {
        // Clear all intervals
        if (this.currentTask) {
            clearInterval(this.currentTask);
            this.currentTask = null;
        }
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
            this.activityInterval = null;
        }
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

    // ========== KEEPER ACTIVITIES ==========
    
    startKeeperActivities() {
        if (this.isSleeping) {
            console.log('Keeper activities skipped - sleeping');
            return;
        }
        
        console.log('🛡️ Starting Keeper daytime activities');
        
        // Simple patrol system
        this.activityInterval = setInterval(() => {
            if (this.currentBot?.entity && !this.isSleeping && Math.random() < 0.4) {
                this.keeperPatrol();
            }
        }, 90000);
    }

    keeperPatrol() {
        if (!this.currentBot?.entity || this.isSleeping) return;
        
        const actions = [
            () => {
                this.currentBot.look(
                    Math.random() * Math.PI * 2,
                    Math.random() * 0.3 - 0.15,
                    true
                );
                this.currentBot.chat('🛡️ Keeping watch...');
            },
            () => {
                this.currentBot.setControlState('jump', true);
                setTimeout(() => {
                    this.currentBot.setControlState('jump', false);
                }, 300);
                this.currentBot.chat('🚶 Patrolling the area...');
            },
            () => {
                this.currentBot.chat('👀 Scanning for threats...');
                this.lookAround();
            }
        ];
        
        const action = actions[Math.floor(Math.random() * actions.length)];
        action();
    }

    lookAround() {
        if (!this.currentBot?.entity) return;
        
        this.currentBot.look(
            this.currentBot.entity.yaw + (Math.random() - 0.5) * 1.5,
            this.currentBot.entity.pitch + (Math.random() - 0.5) * 0.5,
            true
        );
    }

    guardArea() {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping. No guarding.');
            return;
        }
        
        this.currentBot.chat('🛡️ Guarding this area!');
        this.stopAllActivities();
        
        this.currentTask = setInterval(() => {
            if (!this.currentBot?.entity || this.isSleeping) {
                this.stopAllActivities();
                return;
            }
            
            this.currentBot.look(
                this.currentBot.entity.yaw + 0.3,
                this.currentBot.entity.pitch,
                true
            );
        }, 4000);
    }

    startPatrol() {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping. No patrolling.');
            return;
        }
        
        this.currentBot.chat('🚶 Starting patrol!');
        this.keeperPatrol();
    }

    stopPatrol() {
        this.stopAllActivities();
        this.currentBot.chat('🛑 Patrol stopped.');
    }

    followPlayer(username) {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping. No following.');
            return;
        }
        
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.currentBot.chat(`👥 Following ${username}!`);
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
        }
    }

    stopFollow() {
        this.currentBot.chat('🛑 Stopped following.');
    }

    comeToPlayer(username) {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping. Cannot come.');
            return;
        }
        
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
            this.currentBot.chat(`🚶 Coming to ${username}!`);
        }
    }

    exploreArea() {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping. No exploring.');
            return;
        }
        
        this.currentBot.chat('🗺️ Exploring the area!');
        this.keeperPatrol();
    }

    protectPlayer(username) {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping. Cannot protect.');
            return;
        }
        
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.currentBot.chat(`🛡️ Protecting ${username}!`);
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
        }
    }

    // ========== HEROBRINE ACTIVITIES ==========
    
    startHerobrineActivities() {
        if (this.isSleeping) {
            console.log('Herobrine activities skipped - sleeping');
            return;
        }
        
        console.log('👻 Starting Herobrine daytime activities');
        
        this.activityInterval = setInterval(() => {
            if (this.currentBot?.entity && !this.isSleeping && Math.random() < 0.3) {
                this.randomHerobrineBehavior();
            }
        }, 120000);
    }

    randomHerobrineBehavior() {
        const behaviors = [
            () => {
                this.currentBot.chat('*whispers* I see you...');
                this.stareAtNearestPlayer();
            },
            () => {
                this.currentBot.chat('The shadows watch...');
                this.lookAround();
            },
            () => {
                this.currentBot.setControlState('sneak', true);
                setTimeout(() => {
                    this.currentBot.setControlState('sneak', false);
                }, 2000);
                this.currentBot.chat('*disappears into darkness*');
            },
            () => {
                this.currentBot.chat('*laughs eerily*');
            }
        ];
        
        const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        behavior();
    }

    respondToMention(username) {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Zzz... sleeping...');
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
        if (this.isSleeping) {
            this.currentBot.chat('💤 Already disappeared for sleep...');
            return;
        }
        
        this.currentBot.chat('*vanishes into the shadows*');
        this.stopAllActivities();
    }

    appear() {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Still sleeping...');
            return;
        }
        
        this.currentBot.chat('*appears suddenly*');
        this.stareAtNearestPlayer();
    }

    scaryAction() {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Too sleepy to scare...');
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
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping, not stalking...');
            return;
        }
        
        this.currentBot.chat(`👁️ Stalking ${username}...`);
        this.stareAtPlayer(username);
    }

    stopStalking() {
        this.currentBot.chat('👁️ No longer stalking...');
    }

    hauntPlayer(username) {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping, come back tomorrow...');
            return;
        }
        
        this.currentBot.chat(`👻 Haunting ${username}!`);
        
        let hauntCount = 0;
        const hauntInterval = setInterval(() => {
            const player = this.currentBot.players[username];
            if (!player || !player.entity || hauntCount >= 2 || this.isSleeping) {
                clearInterval(hauntInterval);
                this.currentBot.chat('The haunting has ended...');
                return;
            }
            
            this.stareAtPlayer(username);
            
            if (hauntCount % 2 === 0) {
                this.currentBot.chat('*whispers* ' + this.getRandomCreepyMessage());
            }
            
            hauntCount++;
        }, 8000);
    }

    sendCreepyMessage() {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping... no messages...');
            return;
        }
        
        const messages = [
            'The end is near...',
            'They are watching...',
            'Your world is a lie...'
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.currentBot.chat(message);
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

    getRandomCreepyMessage() {
        const messages = [
            'behind you',
            'in the walls',
            'watching you'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    // ========== HELP AND STATUS METHODS ==========
    
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
        
        const keeperHelp = [
            '',
            '=== KEEPER COMMANDS ===',
            '!guard - Guard area',
            '!patrol - Start patrolling',
            '!stop patrol - Stop patrolling',
            '!follow me - Follow you',
            '!stop follow - Stop following',
            '!come - Come to your position',
            '!explore - Explore area',
            '!protect - Protect player'
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
            '!haunt - Haunt player',
            '!message - Creepy message'
        ];
        
        const helpMessages = [...commonHelp];
        if (mode === 'keeper') {
            helpMessages.push(...keeperHelp);
        } else {
            helpMessages.push(...herobrineHelp);
        }
        
        helpMessages.forEach((msg, index) => {
            setTimeout(() => {
                if (this.currentBot?.entity) {
                    this.currentBot.chat(msg);
                }
            }, index * 100);
        });
    }

    showStatus(mode) {
        const timeStatus = this.isSleeping ? '💤 Sleeping' : (this.isNight ? '🌙 Night' : '☀️ Day');
        const players = Object.keys(this.currentBot.players).filter(p => p !== this.currentBot.username);
        const health = Math.floor(this.currentBot.health);
        
        this.currentBot.chat(`Status: ${mode.toUpperCase()} | ${timeStatus} | Health: ${health} | Nearby: ${players.length} players`);
    }
}

// Start the bot manager
console.log('Starting Minecraft Bot Rotation System');
console.log('Server:', SERVER_IP + ':' + SERVER_PORT);
console.log('Version: 1.21.10');
console.log('Bots: Keeper & HeroBrine');
console.log('Connection Throttling: ENABLED');
console.log('Night Sleep: ENABLED');

const botManager = new BotManager();

// Handle process events
process.on('SIGINT', () => {
    console.log('Shutting down bot system...');
    if (botManager.currentBot) {
        botManager.currentBot.end();
    }
    process.exit();
});

module.exports = { botManager, server };
