const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const collectBlock = require('mineflayer-collectblock').plugin;
const autoeat = require('mineflayer-auto-eat');
const armorManager = require('mineflayer-armor-manager');
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
        this.isFighting = false;
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

        // Load available plugins
        this.currentBot.loadPlugin(pathfinder);
        this.currentBot.loadPlugin(collectBlock);
        this.currentBot.loadPlugin(autoeat);
        this.currentBot.loadPlugin(armorManager);

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
            this.isFighting = false;
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

            // Mode-specific commands
            if (mode === 'fighter') {
                this.handleFighterCommands(username, msg);
            } else {
                this.handleHerobrineCommands(username, msg);
            }
        });

        // Handle entity events for combat
        bot.on('entityHurt', (entity) => {
            if (this.isFighting && entity === bot.entity) {
                // Bot got hurt while fighting
                console.log('Bot took damage during fight');
            }
        });
    }

    handleFighterCommands(username, msg) {
        const bot = this.currentBot;
        
        if (this.isNight) {
            if (msg.startsWith('!')) {
                bot.chat('💤 I am sleeping at night. Wait for daytime.');
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
        
        if (msg === '!patrol') {
            this.startPatrol();
        }
        
        if (msg === '!stop patrol') {
            this.stopPatrol();
        }
        
        if (msg === '!mine') {
            this.mineBlocks();
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
        
        if (msg === '!come') {
            this.comeToPlayer(username);
        }
    }

    handleHerobrineCommands(username, msg) {
        const bot = this.currentBot;
        
        if (this.isNight) {
            if (msg.startsWith('!')) {
                bot.chat('💤 Even Herobrine sleeps at night...');
            }
            return;
        }
        
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
        
        if (msg === '!build strange') {
            this.buildStrangeStructure();
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
        this.isFighting = false;
        
        const bot = this.currentBot;
        
        // Stop all activities
        bot.pathfinder.setGoal(null);
        
        // Find shelter
        this.findShelter();
        
        // Chat message
        setTimeout(() => {
            bot.chat('💤 Time to sleep. Good night!');
        }, 2000);
        
        // Set night behavior
        this.setNightBehavior();
    }

    wakeUp() {
        if (!this.isSleeping) return;
        
        console.log('☀️ Day time detected. Bot waking up...');
        this.isSleeping = false;
        
        const bot = this.currentBot;
        const mode = this.currentBotIndex === 0 ? 'fighter' : 'herobrine';
        
        bot.chat('☀️ Good morning! Time for activities!');
        
        // Resume normal activities based on mode
        if (mode === 'fighter') {
            this.startFighterActivities();
        } else {
            this.startHerobrineActivities();
        }
    }

    findShelter() {
        const bot = this.currentBot;
        
        // Look for nearby beds or safe spots
        const nearbyBlocks = bot.findBlocks({
            matching: (block) => 
                block.name.includes('_bed') || 
                block.name.includes('house') ||
                block.name.includes('shelter') ||
                block.name === 'crafting_table', // Often inside houses
            maxDistance: 15,
            count: 10
        });
        
        if (nearbyBlocks.length > 0) {
            const shelterPos = nearbyBlocks[0];
            bot.pathfinder.setGoal(new this.goals.GoalNear(shelterPos.x, shelterPos.y, shelterPos.z, 2));
            console.log('Found shelter, moving to it');
        } else {
            // Stay near trees or in a forest for cover
            const trees = bot.findBlocks({
                matching: (block) => block.name.includes('_log'),
                maxDistance: 10,
                count: 5
            });
            
            if (trees.length > 0) {
                const treePos = trees[0];
                bot.pathfinder.setGoal(new this.goals.GoalNear(treePos.x, treePos.y, treePos.z, 3));
                console.log('No shelter found, staying near trees');
            }
        }
    }

    setNightBehavior() {
        const bot = this.currentBot;
        const currentPos = bot.entity.position.clone();
        
        // Very minimal activity - just occasional looking around
        const nightInterval = setInterval(() => {
            if (!this.isNight || !bot.entity) {
                clearInterval(nightInterval);
                return;
            }
            
            // Slow head movement to appear "sleepy"
            if (Math.random() < 0.3) {
                bot.look(
                    bot.entity.yaw + (Math.random() - 0.5) * 0.5,
                    bot.entity.pitch + (Math.random() - 0.5) * 0.2,
                    true
                );
            }
            
        }, 10000); // Only check every 10 seconds
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
        
        // Auto-equip best gear periodically
        setInterval(() => {
            if (!this.isNight) this.equipBestGear();
        }, 120000); // Every 2 minutes
        
        // Random patrol if idle
        setInterval(() => {
            if (!this.isNight && !this.isFighting && Math.random() < 0.4) {
                this.randomPatrol();
            }
        }, 180000); // Every 3 minutes
    }

    attackPlayer(username) {
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.isFighting = true;
            this.equipBestWeapon();
            
            // Simple attack by moving toward player and hitting
            const targetPos = player.entity.position;
            this.currentBot.pathfinder.setGoal(new this.goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 2));
            
            // Look at player
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
            
            this.currentBot.chat(`⚔️ Attacking ${username}!`);
            
            // Stop fighting after 30 seconds
            setTimeout(() => {
                this.stopAttack();
            }, 30000);
        } else {
            this.currentBot.chat(`I can't see ${username} nearby.`);
        }
    }

    stopAttack() {
        this.isFighting = false;
        this.currentBot.pathfinder.setGoal(null);
        this.currentBot.chat('🛑 Combat stopped.');
    }

    guardArea() {
        this.currentBot.chat('🛡️ Guarding this area!');
        const centerPos = this.currentBot.entity.position.clone();
        
        const guardPositions = [
            centerPos.offset(6, 0, 6),
            centerPos.offset(-6, 0, -6),
            centerPos.offset(6, 0, -6),
            centerPos.offset(-6, 0, 6),
            centerPos // Return to center
        ];
        
        let currentPoint = 0;
        const guardInterval = setInterval(() => {
            if (this.isNight || !this.currentBot.entity || this.isFighting) {
                clearInterval(guardInterval);
                return;
            }
            
            const target = guardPositions[currentPoint];
            this.currentBot.pathfinder.setGoal(new this.goals.GoalNear(target.x, target.y, target.z, 2));
            currentPoint = (currentPoint + 1) % guardPositions.length;
            
        }, 12000); // Move every 12 seconds
    }

    startPatrol() {
        this.currentBot.chat('🚶 Starting area patrol!');
        this.randomPatrol();
        
        // Continue patrolling
        const patrolInterval = setInterval(() => {
            if (this.isNight || !this.currentBot.entity || this.isFighting) {
                clearInterval(patrolInterval);
                return;
            }
            
            if (Math.random() < 0.7) { // 70% chance to continue patrolling
                this.randomPatrol();
            }
            
        }, 45000); // Check every 45 seconds
    }

    stopPatrol() {
        this.currentBot.pathfinder.setGoal(null);
        this.currentBot.chat('🛑 Patrol stopped.');
    }

    mineBlocks() {
        this.currentBot.chat('⛏️ Looking for ores to mine...');
        
        const ores = ['coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore'];
        const nearbyOres = this.currentBot.findBlocks({
            matching: (block) => ores.some(ore => block.name.includes(ore)),
            maxDistance: 10,
            count: 5
        });
        
        if (nearbyOres.length > 0) {
            this.currentBot.chat(`Found ${nearbyOres.length} ores nearby!`);
            // In a real implementation, you'd mine these blocks
        } else {
            this.currentBot.chat('No ores found nearby.');
        }
    }

    collectWood() {
        this.currentBot.chat('🌲 Looking for trees...');
        
        const trees = this.currentBot.findBlocks({
            matching: (block) => block.name.includes('_log'),
            maxDistance: 15,
            count: 8
        });
        
        if (trees.length > 0) {
            this.currentBot.chat(`Found ${trees.length} trees nearby!`);
            // In a real implementation, you'd chop these trees
        } else {
            this.currentBot.chat('No trees found nearby.');
        }
    }

    equipBestGear() {
        this.currentBot.armorManager.equipAll();
        this.equipBestWeapon();
        this.currentBot.chat('🛡️ Equipped best available gear!');
    }

    followPlayer(username) {
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.currentBot.chat(`👥 Following ${username}!`);
            this.followPlayerEntity(player.entity, 45000); // Follow for 45 seconds
        }
    }

    stopFollow() {
        this.currentBot.pathfinder.setGoal(null);
        this.currentBot.chat('🛑 Stopped following.');
    }

    comeToPlayer(username) {
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            const targetPos = player.entity.position;
            this.currentBot.pathfinder.setGoal(new this.goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 2));
            this.currentBot.chat(`🚶 Coming to ${username}!`);
        }
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
        }, 120000); // Every 2 minutes
    }

    respondToMention(username) {
        const responses = [
            '...',
            'You called?',
            'I am here...',
            'Why do you speak my name?',
            '*whispers* Be careful what you wish for...',
            'The shadows hear you...'
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        this.currentBot.chat(response);
        
        setTimeout(() => {
            this.teleportNearPlayer(username);
            this.stareAtPlayer(username);
        }, 1500);
    }

    disappear() {
        this.currentBot.chat('*vanishes into the shadows*');
        this.hideFromPlayers();
        
        setTimeout(() => {
            this.currentBot.chat('I am everywhere... and nowhere...');
        }, 3000);
    }

    appear() {
        const players = Object.values(this.currentBot.players).filter(p => p.entity);
        if (players.length > 0) {
            const randomPlayer = players[Math.floor(Math.random() * players.length)];
            this.teleportNearPlayer(randomPlayer.username);
            this.currentBot.chat('*appears suddenly* Did you miss me?');
        } else {
            this.currentBot.chat('*materializes* No one to scare...');
        }
    }

    scaryAction() {
        const actions = [
            () => {
                this.currentBot.chat('The walls are watching...');
                this.stareAtNearestPlayer();
            },
            () => {
                this.currentBot.chat('*whispers* Join us in the darkness...');
                this.teleportToRandomPlayer();
            },
            () => {
                this.currentBot.chat('Your world is not what it seems...');
                this.buildSmallStructure();
            }
        ];
        
        const action = actions[Math.floor(Math.random() * actions.length)];
        action();
    }

    stalkPlayer(username) {
        this.currentBot.chat(`👁️ Stalking ${username}...`);
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            this.followPlayerEntity(player.entity, 60000, 5); // Follow from 5 blocks away
        }
    }

    stopStalking() {
        this.currentBot.pathfinder.setGoal(null);
        this.currentBot.chat('👁️ No longer stalking... for now.');
    }

    hauntPlayer(username) {
        this.currentBot.chat(`👻 Haunting ${username}!`);
        
        let hauntCount = 0;
        const hauntInterval = setInterval(() => {
            const player = this.currentBot.players[username];
            if (!player || !player.entity || hauntCount >= 6) {
                clearInterval(hauntInterval);
                this.currentBot.chat('The haunting has ended...');
                return;
            }
            
            this.teleportNearPlayer(username);
            this.stareAtPlayer(username);
            
            if (hauntCount % 2 === 0) {
                this.currentBot.chat('*whispers* ' + this.getRandomCreepyMessage());
            }
            
            hauntCount++;
            
        }, 8000); // Haunt every 8 seconds
        
        setTimeout(() => {
            clearInterval(hauntInterval);
        }, 60000); // Stop after 1 minute max
    }

    buildStrangeStructure() {
        this.currentBot.chat('🧱 Building something strange...');
        // Simple structure building logic would go here
        this.currentBot.chat('The structure is complete... for now.');
    }

    sendCreepyMessage() {
        const messages = [
            'The end is near...',
            'They are watching...',
            'Your world is a lie...',
            'The voices... they speak...',
            'Darkness consumes all...',
            'You cannot escape...'
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.currentBot.chat(message);
    }

    randomHerobrineBehavior() {
        const behaviors = [
            () => this.teleportToRandomPlayer(),
            () => this.sendCreepyMessage(),
            () => this.stareAtNearestPlayer(),
            () => this.currentBot.chat('*laughs eerily*')
        ];
        
        const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        behavior();
    }

    // Utility Methods
    equipBestWeapon() {
        const weapons = [
            'netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'golden_sword', 'wooden_sword',
            'netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe', 'golden_axe', 'wooden_axe'
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
            currentPos.x + (Math.random() * 25 - 12.5),
            currentPos.y,
            currentPos.z + (Math.random() * 25 - 12.5)
        );
        
        this.currentBot.pathfinder.setGoal(new this.goals.GoalNear(randomOffset.x, randomOffset.y, randomOffset.z, 2));
    }

    teleportNearPlayer(username) {
        const player = this.currentBot.players[username];
        if (player && player.entity) {
            const playerPos = player.entity.position;
            const offset = vec3(
                (Math.random() * 6 - 3),
                0,
                (Math.random() * 6 - 3)
            );
            const newPos = playerPos.plus(offset);
            
            this.currentBot.lookAt(player.entity.position.offset(0, 1.6, 0));
            // Note: Actual teleportation would require server permissions
            // This just simulates the behavior
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
            Math.random() * 30 - 15,
            0,
            Math.random() * 30 - 15
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

    buildSmallStructure() {
        // Simple structure building simulation
        this.currentBot.chat('*builds a small mysterious structure*');
    }

    getRandomCreepyMessage() {
        const messages = [
            'behind you',
            'in the walls',
            'watching you',
            'coming closer',
            'never alone',
            'darkness rises'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    // Help and Status Methods
    showHelp(mode, username) {
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
            '!patrol - Start patrolling',
            '!stop patrol - Stop patrolling',
            '!mine - Mine nearby ores',
            '!collect wood - Collect wood',
            '!equip best - Equip best gear',
            '!follow me - Follow you',
            '!stop follow - Stop following',
            '!come - Come to your position'
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
            '!build strange - Build something',
            '!message - Creepy message'
        ];
        
        const helpMessages = [...commonHelp];
        if (mode === 'fighter') {
            helpMessages.push(...fighterHelp);
        } else {
            helpMessages.push(...herobrineHelp);
        }
        
        // Send messages with delay to avoid spam
        helpMessages.forEach((msg, index) => {
            setTimeout(() => {
                if (this.currentBot) {
                    this.currentBot.chat(msg);
                }
            }, index * 150);
        });
    }

    showStatus(mode, username) {
        const timeStatus = this.isNight ? '🌙 Sleeping' : '☀️ Active';
        const players = Object.keys(this.currentBot.players).filter(p => p !== this.currentBot.username);
        const health = Math.floor(this.currentBot.health);
        const food = Math.floor(this.currentBot.food);
        
        this.currentBot.chat(`Status: ${mode.toUpperCase()} | ${timeStatus} | Health: ${health} | Food: ${food} | Nearby Players: ${players.length}`);
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

process.on('unhandledRejection', (err) => {
    console.log('❌ Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.log('❌ Uncaught exception:', err);
});

module.exports = botManager;
