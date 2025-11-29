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
        
        // Start bot after a short delay to let health server start
        setTimeout(() => {
            this.startBotRotation();
        }, 2000);
    }

    startBotRotation() {
        console.log('🔄 Starting bot rotation system...');
        this.botStatus = 'starting';
        this.connectBot();
    }

    connectBot() {
        const username = BOT_USERNAMES[this.currentBotIndex];
        const mode = this.currentBotIndex === 0 ? 'keeper' : 'herobrine';
        
        console.log(`🎮 Connecting ${mode.toUpperCase()} bot: ${username}`);
        this.botStatus = `connecting_${mode}`;
        
        try {
            this.currentBot = mineflayer.createBot({
                host: SERVER_IP,
                port: SERVER_PORT,
                username: username,
                version: '1.21.10',
                auth: 'offline',
                checkTimeoutInterval: 30000,
                logErrors: true
            });

            this.setupEventHandlers(mode);
        } catch (error) {
            console.log('❌ Error creating bot:', error);
            this.rotateToNextBot();
        }
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
            
            // Immediately check time and set sleep state
            this.checkTimeAndSleep();
            
            // Start day/night cycle monitoring
            this.startTimeMonitoring();
            
            // Start mode-specific activities if not sleeping
            if (!this.isSleeping) {
                if (mode === 'keeper') {
                    this.startKeeperActivities();
                } else {
                    this.startHerobrineActivities();
                }
            }
            
            setTimeout(() => {
                if (bot.entity) {
                    if (this.isSleeping) {
                        bot.chat('💤 Good night everyone...');
                    } else {
                        bot.chat(`${mode === 'keeper' ? '🛡️' : '👻'} ${mode.toUpperCase()} mode activated!`);
                    }
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
            setTimeout(() => this.rotateToNextBot(), 5000);
        });

        bot.on('error', (err) => {
            console.log(`❌ ${mode.toUpperCase()} bot error:`, err.message);
            this.botStatus = 'error';
            setTimeout(() => this.rotateToNextBot(), 5000);
        });

        bot.on('end', () => {
            console.log(`🔌 ${mode.toUpperCase()} bot disconnected`);
            this.botStatus = 'disconnected';
            setTimeout(() => this.rotateToNextBot(), 5000);
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
                bot.chat('🔄 Rotating to next bot...');
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

            // Mode-specific commands - only work when not sleeping
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

    handleKeeperCommands(username, msg) {
        const bot = this.currentBot;
        
        if (msg === '!guard') {
            this.guardArea();
        }
        
        if (msg === '!patrol') {
            this.startPatrol();
        }
        
        if (msg === '!stop patrol') {
            this.stopPatrol();
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
        
        if (msg === '!protect') {
            this.protectPlayer(username);
        }
    }

    handleHerobrineCommands(username, msg) {
        const bot = this.currentBot;
        
        if (msg.includes('herobrine') || msg.includes('hb') || msg.includes('ghost') || msg.includes('scary')) {
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
        
        if (msg === '!haunt') {
            this.hauntPlayer(username);
        }
        
        if (msg === '!message') {
            this.sendCreepyMessage();
        }
    }

    // ========== SLEEP SYSTEM (COPIED FROM YOUR BOT) ==========
    
    // Time and Sleep Management
    startTimeMonitoring() {
        // Check time every 20 seconds
        setInterval(() => {
            this.checkTimeAndSleep();
        }, 20000);
    }

    checkTimeAndSleep() {
        if (!this.currentBot?.entity) return;
        
        const time = this.currentBot.time.timeOfDay;
        const wasNight = this.isNight;
        
        // Minecraft time: 0-23999, night is roughly 13000-23000
        this.isNight = time >= 13000 && time <= 23000;
        
        console.log(`⏰ Time: ${time}, Night: ${this.isNight}, Sleeping: ${this.isSleeping}`);
        
        if (this.isNight && !wasNight && !this.isSleeping) {
            // Just became night - go to sleep
            console.log('🌙 Night time detected. Going to sleep...');
            this.goToSleep();
        } else if (!this.isNight && wasNight && this.isSleeping) {
            // Just became day - wake up
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
        
        // Chat message
        setTimeout(() => {
            if (bot.entity) {
                bot.chat(mode === 'keeper' ? '💤 Time to sleep. Good night!' : '💤 Even shadows need rest...');
            }
        }, 1000);
        
        // Try to find and sleep in bed
        await this.tryToSleep();
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
        if (mode === 'keeper') {
            this.startKeeperActivities();
        } else {
            this.startHerobrineActivities();
        }
    }

    async tryToSleep() {
        if (this.isSleeping) return;

        try {
            const bot = this.currentBot;
            bot.pathfinder.setGoal(null);

            console.log("🌙 Night time - attempting to sleep...");

            const bedNames = [
                "red_bed", "blue_bed", "green_bed", "yellow_bed", "white_bed", 
                "black_bed", "brown_bed", "cyan_bed", "gray_bed", "light_blue_bed", 
                "light_gray_bed", "lime_bed", "magenta_bed", "orange_bed", "pink_bed", "purple_bed"
            ];

            let bedBlock = bot.findBlock({
                matching: (block) => bedNames.includes(block.name),
                maxDistance: 64,
            });

            if (bedBlock) {
                console.log(`  ✅ Found bed at distance ${bot.entity.position.distanceTo(bedBlock.position).toFixed(1)} blocks`);
            }

            if (!bedBlock) {
                console.log("  ⚠️  No bed found nearby - sleeping without bed");
            }

            if (bedBlock) {
                const distance = bot.entity.position.distanceTo(bedBlock.position);
                
                if (distance > 3) {
                    console.log(`  🚶 Walking to bed (${distance.toFixed(1)} blocks away)...`);
                    const goal = new (require('mineflayer-pathfinder').goals.GoalBlock)(
                        bedBlock.position.x,
                        bedBlock.position.y,
                        bedBlock.position.z,
                    );
                    bot.pathfinder.setGoal(goal);
                    await this.waitForArrival(
                        bedBlock.position.x,
                        bedBlock.position.y,
                        bedBlock.position.z,
                        3,
                        10000,
                    );
                    bot.pathfinder.setGoal(null);
                    await this.delay(500);
                }

                console.log("  💤 Attempting to sleep in bed...");

                try {
                    await bot.sleep(bedBlock);
                    console.log("  ✅ Sleeping... will wake at dawn");

                    bot.once("wake", () => {
                        console.log("  ☀️  Good morning!");
                        this.isSleeping = false;
                        this.wakeUp();
                    });
                    
                    // Also wake up if day comes
                    const wakeCheck = setInterval(() => {
                        if (!this.isNightTime() && this.isSleeping) {
                            clearInterval(wakeCheck);
                            try {
                                bot.wake();
                            } catch (e) {
                                // Ignore wake errors
                            }
                        }
                    }, 5000);
                    
                } catch (error) {
                    console.log(`  ⚠️  Sleep failed: ${error.message}`);
                    this.isSleeping = false;
                    this.wakeUp();
                }
            } else {
                console.log("  ⚠️  No bed available - sleeping in place");
                // Set sleep behavior without bed
                this.setSleepBehavior();
            }
        } catch (error) {
            console.log(`  ⚠️  Sleep error: ${error.message}`);
            this.isSleeping = false;
            this.wakeUp();
        }
    }

    setSleepBehavior() {
        const bot = this.currentBot;
        if (!bot.entity) return;
        
        // STOP ALL MOVEMENT AND ACTIVITIES
        this.stopAllActivities();
        
        // Only set a very minimal sleep behavior
        this.currentTask = setInterval(() => {
            if (!this.isSleeping || !bot.entity) {
                this.stopAllActivities();
                return;
            }
            
            // EXTREMELY minimal - just to show it's alive
            if (Math.random() < 0.05) { // 5% chance every 30 seconds
                // Almost imperceptible head movement
                bot.look(
                    bot.entity.yaw + (Math.random() - 0.5) * 0.1,
                    bot.entity.pitch,
                    true
                );
            }
            
        }, 30000); // Check every 30 seconds
    }

    async waitForArrival(x, y, z, threshold, timeout = 10000) {
        const bot = this.currentBot;
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkArrival = setInterval(() => {
                const distance = bot.entity.position.distanceTo({ x, y, z });
                const elapsed = Date.now() - startTime;

                if (distance < threshold || elapsed > timeout) {
                    clearInterval(checkArrival);
                    resolve();
                }
            }, 100);
        });
    }

    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    stopAllActivities() {
        // Clear all intervals and tasks
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

    // ========== BOT ROTATION SYSTEM ==========
    
    rotateToNextBot() {
        console.log('🔄 Rotating to next bot...');
        
        // Clean up current bot
        this.stopAllActivities();
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
        
        // Wait 8 seconds before connecting next bot
        setTimeout(() => {
            this.connectBot();
        }, 8000);
    }

    manualRotate() {
        console.log('Manual rotation triggered');
        this.rotateToNextBot();
    }

    // ========== KEEPER METHODS ==========
    
    startKeeperActivities() {
        if (this.isSleeping) {
            console.log('Keeper activities skipped - sleeping');
            return;
        }
        
        console.log('🛡️ Starting Keeper daytime activities');
        
        // Auto patrol if idle
        this.activityInterval = setInterval(() => {
            if (this.currentBot?.entity && !this.isSleeping && Math.random() < 0.3) {
                this.randomPatrol();
            }
        }, 120000); // Every 2 minutes
    }

    guardArea() {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping. No guarding.');
            return;
        }
        
        this.currentBot.chat('🛡️ Guarding this area!');
        this.guardBehavior();
    }

    guardBehavior() {
        this.stopAllActivities();
        this.currentTask = setInterval(() => {
            if (!this.currentBot?.entity || this.isSleeping) {
                this.stopAllActivities();
                return;
            }
            
            // Look around slowly while guarding
            this.currentBot.look(
                this.currentBot.entity.yaw + 0.2,
                this.currentBot.entity.pitch,
                true
            );
            
        }, 5000);
    }

    startPatrol() {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping. No patrolling.');
            return;
        }
        
        this.currentBot.chat('🚶 Starting patrol!');
        this.randomPatrol();
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
            this.followBehavior(username);
        }
    }

    stopFollow() {
        this.stopAllActivities();
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
        this.randomPatrol();
    }

    protectPlayer(username) {
        if (this.isSleeping) {
            this.currentBot.chat('💤 Sleeping. Cannot protect.');
            return;
        }
        
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.currentBot.chat(`🛡️ Protecting ${username}!`);
            this.followBehavior(username);
        }
    }

    randomPatrol() {
        if (!this.currentBot?.entity || this.isSleeping) return;
        
        // Look in random directions while patrolling
        this.currentBot.look(
            Math.random() * Math.PI * 2,
            Math.random() * 0.2 - 0.1,
            true
        );
    }

    followBehavior(username) {
        this.stopAllActivities();
        this.currentTask = setInterval(() => {
            const player = this.currentBot.players[username];
            if (!player || !player.entity || this.isSleeping || !this.currentBot.entity) {
                this.stopAllActivities();
                return;
            }
            
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
            
        }, 4000);
    }

    // ========== HEROBRINE METHODS ==========
    
    startHerobrineActivities() {
        if (this.isSleeping) {
            console.log('Herobrine activities skipped - sleeping');
            return;
        }
        
        console.log('👻 Starting Herobrine daytime activities');
        
        // Random behaviors
        this.activityInterval = setInterval(() => {
            if (this.currentBot?.entity && !this.isSleeping && Math.random() < 0.2) {
                this.randomHerobrineBehavior();
            }
        }, 150000); // Every 2.5 minutes
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
        this.followBehavior(username);
    }

    stopStalking() {
        this.stopAllActivities();
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
            
        }, 10000);
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
console.log('Night Sleep: ENABLED - Bot will be completely inactive at night');
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

module.exports = { botManager, server };
