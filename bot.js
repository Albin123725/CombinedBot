const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const collectBlock = require('mineflayer-collectblock').plugin;
const pvp = require('mineflayer-pvp').plugin;
const autoeat = require('mineflayer-auto-eat');
const armorManager = require('mineflayer-armor-manager');
const toolPlugin = require('mineflayer-tool').plugin;
const vec3 = require('vec3');

// Configuration
const SERVER_IP = 'gameplannet.aternos.me';
const SERVER_PORT = 51270;
const BOT_USERNAMES = ['FighterBot', 'HerobrineBot']; // Two different usernames

class BotManager {
    constructor() {
        this.currentBotIndex = 0;
        this.currentBot = null;
        this.isNight = false;
        this.isSleeping = false;
        this.botStats = {
            fighter: { online: false, lastActivity: null },
            herobrine: { online: false, lastActivity: null }
        };
        
        this.startBotRotation();
    }

    startBotRotation() {
        console.log('🔄 Starting bot rotation system...');
        this.connectBot();
    }

    connectBot() {
        const username = BOT_USERNAMES[this.currentBotIndex];
        const mode = this.currentBotIndex === 0 ? 'fighter' : 'herobrine';
        
        console.log(`🎮 Connecting ${mode.toUpperCase()} bot: ${username}`);
        
        this.currentBot = mineflayer.createBot({
            host: SERVER_IP,
            port: SERVER_PORT,
            username: username,
            version: '1.21.10',
            auth: 'offline',
            hideErrors: false
        });

        // Load plugins
        this.currentBot.loadPlugin(pathfinder);
        this.currentBot.loadPlugin(pvp);
        this.currentBot.loadPlugin(collectBlock);
        this.currentBot.loadPlugin(autoeat);
        this.currentBot.loadPlugin(armorManager);
        this.currentBot.loadPlugin(toolPlugin);

        // Configure pathfinder
        const { Movements, goals } = require('mineflayer-pathfinder');
        this.currentBot.pathfinder.setMovements(new Movements(this.currentBot));
        this.goals = goals;

        this.setupEventHandlers(mode);
        this.botStats[mode].online = true;
        this.botStats[mode].lastActivity = new Date();
    }

    setupEventHandlers(mode) {
        const bot = this.currentBot;

        bot.on('login', () => {
            console.log(`✅ ${mode.toUpperCase()} bot logged in successfully`);
            this.botStats[mode].online = true;
            this.botStats[mode].lastActivity = new Date();
        });

        bot.on('spawn', () => {
            console.log(`🌍 ${mode.toUpperCase()} bot spawned in world`);
            bot.autoEat.enable();
            bot.armorManager.equipAll();
            
            setTimeout(() => {
                bot.chat(`Hello! ${mode.toUpperCase()} mode activated!`);
                this.checkTimeAndSleep();
            }, 3000);

            // Start day/night cycle monitoring
            this.startTimeMonitoring();
        });

        bot.on('death', () => {
            console.log(`💀 ${mode.toUpperCase()} bot died`);
            setTimeout(() => {
                bot.chat('I died! But I will be back...');
            }, 2000);
        });

        bot.on('kicked', (reason) => {
            console.log(`🚫 ${mode.toUpperCase()} bot kicked:`, reason);
            this.botStats[mode].online = false;
            this.rotateToNextBot();
        });

        bot.on('error', (err) => {
            console.log(`❌ ${mode.toUpperCase()} bot error:`, err);
            this.botStats[mode].online = false;
            this.rotateToNextBot();
        });

        bot.on('end', () => {
            console.log(`🔌 ${mode.toUpperCase()} bot disconnected`);
            this.botStats[mode].online = false;
            this.rotateToNextBot();
        });

        // Auto-eat configuration
        bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: 14,
            bannedFood: ['rotten_flesh', 'poisonous_potato', 'pufferfish']
        };

        // Common chat commands
        bot.on('chat', (username, message) => {
            if (username === bot.username) return;

            const msg = message.toLowerCase();
            
            if (msg === 'hi' || msg === 'hello' || msg === 'hey') {
                bot.chat(`Hello ${username}! 👋`);
            }
            
            if (msg === '!mode') {
                bot.chat(`I'm in ${mode.toUpperCase()} mode! ⚡`);
            }
            
            if (msg === '!rotate') {
                bot.chat('🔄 Manually rotating to next bot...');
                this.manualRotate();
            }
            
            if (msg === '!help') {
                this.showHelp(mode, username);
            }
            
            if (msg === '!status') {
                this.showStatus(mode, username);
            }
            
            if (msg === '!sleep') {
                this.forceSleep();
            }
            
            if (msg === '!wake') {
                this.forceWake();
            }
        });

        // Mode-specific setup
        if (mode === 'fighter') {
            this.setupFighterBot();
        } else {
            this.setupHerobrineBot();
        }
    }

    setupFighterBot() {
        const bot = this.currentBot;
        
        bot.on('spawn', () => {
            setTimeout(() => {
                if (!this.isNight) {
                    bot.chat('⚔️ Fighter mode activated! Ready for daytime activities!');
                    this.equipBestWeapon();
                    this.startFighterActivities();
                }
            }, 2000);
        });

        // Fighter-specific chat commands
        bot.on('chat', (username, message) => {
            if (username === bot.username) return;

            const msg = message.toLowerCase();
            
            if (this.isNight) {
                bot.chat('💤 I am sleeping at night. Wait for daytime.');
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
            
            if (msg === '!patrol') {
                this.startPatrol();
            }
            
            if (msg === '!stop patrol') {
                this.stopPatrol();
            }
            
            if (msg === '!mine') {
                this.mineBlocks(username);
            }
            
            if (msg === '!collect wood') {
                this.collectWood();
            }
            
            if (msg === '!equip best') {
                this.equipBestGear();
            }
            
            if (msg === '!follow me') {
                this.followPlayer(username);
            }
            
            if (msg === '!stop follow') {
                this.stopFollow();
            }
        });

        // Auto-combat only during day
        bot.on('entitySpawn', (entity) => {
            if (!this.isNight && this.isHostileMob(entity)) {
                setTimeout(() => {
                    if (entity.isValid && bot.entity.position.distanceTo(entity.position) < 12) {
                        this.autoAttackMob(entity);
                    }
                }, 2000);
            }
        });
    }

    setupHerobrineBot() {
        const bot = this.currentBot;
        
        bot.on('spawn', () => {
            setTimeout(() => {
                if (!this.isNight) {
                    bot.chat('👻 Herobrine has arrived... Be careful during daytime...');
                    this.startHerobrineActivities();
                }
            }, 2000);
        });

        // Herobrine-specific chat commands
        bot.on('chat', (username, message) => {
            if (username === bot.username) return;

            const msg = message.toLowerCase();
            
            if (this.isNight) {
                bot.chat('💤 Even Herobrine sleeps at night...');
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
            
            if (msg === '!haunt') {
                this.hauntPlayer(username);
            }
            
            if (msg === '!build strange') {
                this.buildStrangeStructure();
            }
        });

        // Random Herobrine activities only during day
        if (!this.isNight) {
            setInterval(() => {
                if (!this.isNight && Math.random() < 0.3) {
                    this.randomHerobrineBehavior();
                }
            }, 180000);
        }
    }

    // Time and Sleep Management
    startTimeMonitoring() {
        // Check time every 30 seconds
        setInterval(() => {
            this.checkTimeAndSleep();
        }, 30000);
        
        // Also check when time changes
        this.currentBot.on('time', () => {
            this.checkTimeAndSleep();
        });
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
        
        console.log('🌙 Night time detected. Bot going to sleep...');
        this.isSleeping = true;
        
        const bot = this.currentBot;
        const mode = this.currentBotIndex === 0 ? 'fighter' : 'herobrine';
        
        // Stop all activities
        bot.pvp.stop();
        bot.pathfinder.setGoal(null);
        
        // Find or create shelter
        this.findShelter();
        
        // Chat message
        setTimeout(() => {
            bot.chat('💤 Time to sleep. Good night!');
        }, 2000);
        
        // Minimal activity during night
        this.setNightBehavior();
    }

    wakeUp() {
        if (!this.isSleeping) return;
        
        console.log('☀️ Day time detected. Bot waking up...');
        this.isSleeping = false;
        
        const bot = this.currentBot;
        const mode = this.currentBotIndex === 0 ? 'fighter' : 'herobrine';
        
        bot.chat('☀️ Good morning! Time for activities!');
        
        // Resume normal activities
        if (mode === 'fighter') {
            this.startFighterActivities();
        } else {
            this.startHerobrineActivities();
        }
    }

    findShelter() {
        const bot = this.currentBot;
        const nearbyBlocks = bot.findBlocks({
            matching: (block) => 
                block.name.includes('_bed') || 
                block.name.includes('house') ||
                block.name.includes('shelter') ||
                (block.name.includes('_log') && bot.blockAt(block.position.offset(0, 1, 0))?.name === 'air'),
            maxDistance: 20,
            count: 5
        });
        
        if (nearbyBlocks.length > 0) {
            const shelterPos = nearbyBlocks[0];
            bot.pathfinder.setGoal(new this.goals.GoalNear(shelterPos.x, shelterPos.y, shelterPos.z, 2));
        } else {
            // Create simple shelter
            this.createSimpleShelter();
        }
    }

    createSimpleShelter() {
        const bot = this.currentBot;
        const pos = bot.entity.position.floored();
        
        // Simple 3x3 shelter
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                if (x === 0 && z === 0) continue;
                const blockPos = pos.offset(x, 0, z);
                // Would place blocks here in real implementation
            }
        }
    }

    setNightBehavior() {
        // Minimal activity - just stay in one place
        const bot = this.currentBot;
        const currentPos = bot.entity.position.clone();
        
        const nightInterval = setInterval(() => {
            if (!this.isNight) {
                clearInterval(nightInterval);
                return;
            }
            
            // Just look around slowly
            bot.look(
                bot.entity.yaw + 0.1,
                bot.entity.pitch,
                true
            );
            
        }, 5000);
    }

    forceSleep() {
        if (!this.isNight) {
            this.currentBot.chat("It's not night time yet!");
            return;
        }
        this.goToSleep();
    }

    forceWake() {
        if (this.isNight) {
            this.currentBot.chat("It's still night time!");
            return;
        }
        this.wakeUp();
    }

    // Bot Rotation System
    rotateToNextBot() {
        console.log('🔄 Rotating to next bot...');
        
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
        
        console.log(`🔄 Next bot: ${BOT_USERNAMES[this.currentBotIndex]}`);
        
        // Wait 10 seconds before connecting next bot
        setTimeout(() => {
            this.connectBot();
        }, 10000);
    }

    manualRotate() {
        console.log('🔄 Manual rotation triggered');
        this.rotateToNextBot();
    }

    // Fighter Methods
    startFighterActivities() {
        if (this.isNight) return;
        
        console.log('⚔️ Starting fighter daytime activities');
        const bot = this.currentBot;
        
        // Periodic equipment check
        setInterval(() => {
            if (!this.isNight) this.equipBestGear();
        }, 60000);
        
        // Random patrol if idle
        setInterval(() => {
            if (!this.isNight && !bot.pvp.target && Math.random() < 0.3) {
                this.randomPatrol();
            }
        }, 120000);
    }

    attackPlayer(username) {
        if (this.isNight) {
            this.currentBot.chat('💤 Sleeping at night. No fighting.');
            return;
        }
        
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.equipBestWeapon();
            this.currentBot.pvp.attack(player.entity);
            this.currentBot.chat(`⚔️ Attacking ${username}!`);
        }
    }

    stopAttack() {
        this.currentBot.pvp.stop();
        this.currentBot.chat('🛑 Combat stopped.');
    }

    guardArea() {
        if (this.isNight) {
            this.currentBot.chat('💤 Sleeping at night. No guarding.');
            return;
        }
        
        this.currentBot.chat('🛡️ Guarding this area!');
        const centerPos = this.currentBot.entity.position.clone();
        
        const guardPositions = [
            centerPos.offset(8, 0, 8),
            centerPos.offset(-8, 0, -8),
            centerPos.offset(8, 0, -8),
            centerPos.offset(-8, 0, 8)
        ];
        
        let currentPoint = 0;
        const guardInterval = setInterval(() => {
            if (this.isNight || !this.currentBot.entity) {
                clearInterval(guardInterval);
                return;
            }
            
            const target = guardPositions[currentPoint];
            this.currentBot.pathfinder.setGoal(new this.goals.GoalNear(target.x, target.y, target.z, 2));
            currentPoint = (currentPoint + 1) % guardPositions.length;
            
        }, 15000);
    }

    startPatrol() {
        if (this.isNight) {
            this.currentBot.chat('💤 Sleeping at night. No patrolling.');
            return;
        }
        
        this.currentBot.chat('🚶 Starting patrol!');
        this.randomPatrol();
    }

    stopPatrol() {
        this.currentBot.pathfinder.setGoal(null);
        this.currentBot.chat('🛑 Patrol stopped.');
    }

    mineBlocks(username) {
        if (this.isNight) {
            this.currentBot.chat('💤 Sleeping at night. No mining.');
            return;
        }
        
        this.currentBot.chat('⛏️ Mining nearby ores...');
        // Mining implementation would go here
    }

    collectWood() {
        if (this.isNight) {
            this.currentBot.chat('💤 Sleeping at night. No wood collection.');
            return;
        }
        
        this.currentBot.chat('🌲 Collecting wood...');
        // Wood collection implementation would go here
    }

    equipBestGear() {
        this.currentBot.armorManager.equipAll();
        this.equipBestWeapon();
    }

    followPlayer(username) {
        if (this.isNight) {
            this.currentBot.chat('💤 Sleeping at night. No following.');
            return;
        }
        
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.currentBot.chat(`👥 Following ${username}!`);
            this.followPlayerEntity(player.entity, 30000);
        }
    }

    stopFollow() {
        this.currentBot.pathfinder.setGoal(null);
        this.currentBot.chat('🛑 Stopped following.');
    }

    // Herobrine Methods
    startHerobrineActivities() {
        if (this.isNight) return;
        
        console.log('👻 Starting Herobrine daytime activities');
        
        // Random scary behaviors
        setInterval(() => {
            if (!this.isNight && Math.random() < 0.3) {
                this.randomHerobrineBehavior();
            }
        }, 180000);
    }

    respondToMention(username) {
        if (this.isNight) {
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
            this.teleportNearPlayer(username);
        }, 2000);
    }

    disappear() {
        if (this.isNight) {
            this.currentBot.chat('💤 Already disappeared for sleep...');
            return;
        }
        
        this.currentBot.chat('*vanishes into the shadows*');
        this.hideFromPlayers();
    }

    appear() {
        if (this.isNight) {
            this.currentBot.chat('💤 Still sleeping...');
            return;
        }
        
        const players = Object.values(this.currentBot.players).filter(p => p.entity);
        if (players.length > 0) {
            const randomPlayer = players[Math.floor(Math.random() * players.length)];
            this.teleportNearPlayer(randomPlayer.username);
            this.currentBot.chat('*appears suddenly*');
        }
    }

    scaryAction() {
        if (this.isNight) {
            this.currentBot.chat('💤 Too sleepy to scare...');
            return;
        }
        
        this.currentBot.chat('The walls are watching...');
    }

    stalkPlayer(username) {
        if (this.isNight) {
            this.currentBot.chat('💤 Sleeping, not stalking...');
            return;
        }
        
        this.currentBot.chat(`👁️ Stalking ${username}...`);
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.followPlayerEntity(player.entity, 60000, 8);
        }
    }

    stopStalking() {
        this.currentBot.pathfinder.setGoal(null);
        this.currentBot.chat('👁️ No longer stalking...');
    }

    hauntPlayer(username) {
        if (this.isNight) {
            this.currentBot.chat('💤 Sleeping, come back tomorrow...');
            return;
        }
        
        this.currentBot.chat(`👻 Haunting ${username}!`);
        // Haunting implementation would go here
    }

    buildStrangeStructure() {
        if (this.isNight) {
            this.currentBot.chat('💤 Too dark to build...');
            return;
        }
        
        this.currentBot.chat('🧱 Building something strange...');
        // Structure building would go here
    }

    randomHerobrineBehavior() {
        if (this.isNight) return;
        
        const behaviors = [
            () => this.teleportToRandomPlayer(),
            () => this.currentBot.chat('*whispers* Can you see me?'),
            () => this.stareAtNearestPlayer()
        ];
        
        const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        behavior();
    }

    // Utility Methods
    isHostileMob(entity) {
        const hostileMobs = ['zombie', 'skeleton', 'spider', 'creeper', 'enderman'];
        return hostileMobs.some(mob => entity.name.includes(mob));
    }

    equipBestWeapon() {
        const weapons = [
            'netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword'
        ];
        
        for (const weapon of weapons) {
            const item = this.currentBot.inventory.items().find(i => i.name.includes(weapon));
            if (item) {
                this.currentBot.equip(item, 'hand');
                break;
            }
        }
    }

    randomPatrol() {
        if (!this.currentBot.entity || this.isNight) return;
        
        const currentPos = this.currentBot.entity.position;
        const randomOffset = vec3(
            currentPos.x + (Math.random() * 30 - 15),
            currentPos.y,
            currentPos.z + (Math.random() * 30 - 15)
        );
        
        this.currentBot.pathfinder.setGoal(new this.goals.GoalNear(randomOffset.x, randomOffset.y, randomOffset.z, 2));
    }

    autoAttackMob(entity) {
        this.equipBestWeapon();
        this.currentBot.pvp.attack(entity);
    }

    teleportNearPlayer(username) {
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            const playerPos = player.entity.position;
            const offset = vec3(
                (Math.random() * 8 - 4),
                0,
                (Math.random() * 8 - 4)
            );
            const newPos = playerPos.plus(offset);
            
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
            setTimeout(() => {
                this.currentBot.entity.position.copy(newPos);
            }, 500);
        }
    }

    teleportToRandomPlayer() {
        const players = Object.values(this.currentBot.players).filter(p => p.entity);
        if (players.length > 0) {
            const randomPlayer = players[Math.floor(Math.random() * players.length)];
            this.teleportNearPlayer(randomPlayer.username);
        }
    }

    hideFromPlayers() {
        const randomPos = this.currentBot.entity.position.offset(
            Math.random() * 40 - 20,
            0,
            Math.random() * 40 - 20
        );
        this.currentBot.pathfinder.setGoal(new this.goals.GoalNear(randomPos.x, randomPos.y, randomPos.z, 1));
    }

    followPlayerEntity(entity, duration, distance = 3) {
        const followGoal = new this.goals.GoalFollow(entity, distance);
        this.currentBot.pathfinder.setGoal(followGoal, true);
        
        setTimeout(() => {
            this.currentBot.pathfinder.setGoal(null);
        }, duration);
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
    showHelp(mode, username) {
        const commonHelp = [
            '=== COMMON COMMANDS ===',
            '!help - Show this help',
            '!mode - Check current mode', 
            '!rotate - Switch bots manually',
            '!status - Bot status',
            '!sleep - Force sleep (night only)',
            '!wake - Force wake (day only)'
        ];
        
        const fighterHelp = [
            '=== FIGHTER COMMANDS ===',
            '!attack me - Attack you',
            '!stop attack - Stop attacking',
            '!guard - Guard area',
            '!patrol - Start patrolling',
            '!stop patrol - Stop patrolling',
            '!mine - Mine nearby ores',
            '!collect wood - Collect wood',
            '!equip best - Equip best gear',
            '!follow me - Follow you',
            '!stop follow - Stop following'
        ];
        
        const herobrineHelp = [
            '=== HEROBRINE COMMANDS ===',
            'Say "herobrine" - Summon me',
            '!disappear - Vanish',
            '!appear - Reappear', 
            '!scare - Scary action',
            '!stalk - Stalk player',
            '!stop stalk - Stop stalking',
            '!haunt - Haunt player',
            '!build strange - Build something'
        ];
        
        const helpMessages = [...commonHelp];
        if (mode === 'fighter') helpMessages.push(...fighterHelp);
        else helpMessages.push(...herobrineHelp);
        
        helpMessages.forEach((msg, index) => {
            setTimeout(() => {
                this.currentBot.chat(msg);
            }, index * 100);
        });
    }

    showStatus(mode, username) {
        const timeStatus = this.isNight ? '🌙 Sleeping' : '☀️ Active';
        const players = Object.keys(this.currentBot.players).filter(p => p !== this.currentBot.username);
        this.currentBot.chat(`Status: ${mode.toUpperCase()} | ${timeStatus} | Players: ${players.length} | Health: ${this.currentBot.health}`);
    }
}

// Start the bot manager
console.log('🎮 Starting Minecraft Bot Rotation System');
console.log('📍 Server:', SERVER_IP + ':' + SERVER_PORT);
console.log('⚙️ Version: 1.21.10');
console.log('🌙 Night Sleep: Enabled');
console.log('🔄 Auto Rotation: On Disconnect');

const botManager = new BotManager();

// Handle process events
process.on('SIGINT', () => {
    console.log('🛑 Shutting down bot system gracefully...');
    if (botManager.currentBot) {
        botManager.currentBot.quit();
    }
    process.exit();
});

module.exports = botManager;
