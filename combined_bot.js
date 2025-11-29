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
const BOT_USERNAME = 'FighterBot'; // Change this as needed

// Rotation settings (in milliseconds)
const FIGHTER_DURATION = 2 * 60 * 60 * 1000; // 2 hours
const HEROBRINE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

class CombinedBot {
    constructor() {
        this.currentMode = 'fighter';
        this.bot = null;
        this.rotationInterval = null;
        this.startTime = null;
        this.isPatrolling = false;
        this.isGuarding = false;
        this.currentTask = null;
        
        this.initBot();
    }

    initBot() {
        console.log(`🎮 Starting bot in ${this.currentMode.toUpperCase()} mode...`);
        
        this.bot = mineflayer.createBot({
            host: SERVER_IP,
            port: SERVER_PORT,
            username: BOT_USERNAME,
            version: '1.21.10',
            auth: 'offline',
            hideErrors: false,
            physicsEnabled: true
        });

        // Load all plugins
        this.bot.loadPlugin(pathfinder);
        this.bot.loadPlugin(pvp);
        this.bot.loadPlugin(collectBlock);
        this.bot.loadPlugin(autoeat);
        this.bot.loadPlugin(armorManager);
        this.bot.loadPlugin(toolPlugin);

        // Configure pathfinder
        const { Movements, goals } = require('mineflayer-pathfinder');
        this.bot.pathfinder.setMovements(new Movements(this.bot));
        this.goals = goals;

        // Common event handlers
        this.setupCommonHandlers();
        
        // Mode-specific setup
        if (this.currentMode === 'fighter') {
            this.setupFighter();
        } else {
            this.setupHerobrine();
        }

        this.startRotationTimer();
    }

    setupCommonHandlers() {
        this.bot.on('login', () => {
            console.log(`✅ ${this.currentMode.toUpperCase()} bot logged in to ${SERVER_IP}:${SERVER_PORT}`);
            this.startTime = Date.now();
        });

        this.bot.on('spawn', () => {
            console.log(`🌍 ${this.currentMode.toUpperCase()} bot spawned in world`);
            this.bot.autoEat.enable();
            this.bot.armorManager.equipAll();
            
            setTimeout(() => {
                this.bot.chat(`Hello! ${this.currentMode.toUpperCase()} mode activated!`);
            }, 3000);
        });

        this.bot.on('death', () => {
            console.log(`💀 ${this.currentMode.toUpperCase()} bot died`);
            setTimeout(() => {
                this.bot.chat('I died! But I will be back...');
            }, 2000);
        });

        this.bot.on('kicked', (reason) => {
            console.log(`🚫 ${this.currentMode.toUpperCase()} bot kicked:`, reason);
            this.scheduleReconnect();
        });

        this.bot.on('error', (err) => {
            console.log(`❌ ${this.currentMode.toUpperCase()} bot error:`, err);
            this.scheduleReconnect();
        });

        this.bot.on('end', () => {
            console.log(`🔌 ${this.currentMode.toUpperCase()} bot disconnected`);
            this.scheduleReconnect();
        });

        // Auto-eat configuration
        this.bot.autoEat.options = {
            priority: 'foodPoints',
            startAt: 14,
            bannedFood: ['rotten_flesh', 'poisonous_potato', 'pufferfish'],
            eatingTimeout: 3
        };

        // Inventory management
        this.bot.on('playerCollect', (collector, item) => {
            if (collector === this.bot.entity) {
                this.manageInventory(item);
            }
        });

        // Common chat commands
        this.bot.on('chat', (username, message) => {
            if (username === this.bot.username) return;

            const msg = message.toLowerCase();
            
            // Common commands
            if (msg === 'hi' || msg === 'hello' || msg === 'hey') {
                this.bot.chat(`Hello ${username}! 👋`);
            }
            
            if (msg === '!mode') {
                this.bot.chat(`I'm in ${this.currentMode.toUpperCase()} mode! ⚡`);
            }
            
            if (msg === '!rotate') {
                this.bot.chat('🔄 Rotating to next mode...');
                this.manualRotate();
            }
            
            if (msg === '!help') {
                this.showHelp(username);
            }
            
            if (msg === '!status') {
                this.showStatus(username);
            }
            
            if (msg === '!time') {
                this.showUptime(username);
            }
        });
    }

    setupFighter() {
        console.log('⚔️ Initializing FIGHTER mode with advanced features...');
        
        this.bot.on('spawn', () => {
            setTimeout(() => {
                this.bot.chat('⚔️ Fighter mode activated! Ready for combat and adventure!');
                this.equipBestWeapon();
            }, 2000);
        });

        // Fighter-specific chat commands
        this.bot.on('chat', (username, message) => {
            if (username === this.bot.username) return;

            const msg = message.toLowerCase();
            
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
            
            if (msg === '!come') {
                this.comeToPlayer(username);
            }
        });

        // Auto-combat features
        this.bot.on('entitySpawn', (entity) => {
            if (this.isHostileMob(entity)) {
                setTimeout(() => {
                    if (entity.isValid && this.bot.entity.position.distanceTo(entity.position) < 12) {
                        this.autoAttackMob(entity);
                    }
                }, 2000);
            }
        });

        // Auto-equip better gear
        this.bot.on('itemDrop', (entity) => {
            if (entity.name && this.isBetterGear(entity.name)) {
                setTimeout(() => {
                    this.collectItem(entity);
                }, 1000);
            }
        });

        // Periodic equipment check
        setInterval(() => {
            this.equipBestGear();
        }, 60000);

        // Random patrol if idle
        setInterval(() => {
            if (!this.bot.pvp.target && !this.isPatrolling && !this.currentTask && Math.random() < 0.3) {
                this.randomPatrol();
            }
        }, 120000);
    }

    setupHerobrine() {
        console.log('👻 Initializing HEROBRINE mode with scary features...');
        
        this.bot.on('spawn', () => {
            setTimeout(() => {
                this.bot.chat('👻 Herobrine has arrived... Be careful...');
                this.changeSkinToHerobrine();
            }, 2000);
        });

        // Herobrine-specific chat commands
        this.bot.on('chat', (username, message) => {
            if (username === this.bot.username) return;

            const msg = message.toLowerCase();
            
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
        });

        // Random scary behaviors
        setInterval(() => {
            if (Math.random() < 0.4 && Object.keys(this.bot.players).length > 1) {
                this.randomScaryBehavior();
            }
        }, Math.random() * 180000 + 120000);

        // Random teleportation
        setInterval(() => {
            if (Math.random() < 0.25) {
                this.randomTeleport();
            }
        }, 240000);

        // Build random structures occasionally
        setInterval(() => {
            if (Math.random() < 0.2) {
                this.buildRandomStructure();
            }
        }, 300000);
    }

    // ========== FIGHTER METHODS ==========
    
    attackPlayer(username) {
        const player = this.bot.players[username];
        if (player && player.entity) {
            this.equipBestWeapon();
            this.bot.pvp.attack(player.entity);
            this.bot.chat(`⚔️ Attacking ${username}! Prepare for battle!`);
        } else {
            this.bot.chat(`I can't see ${username} nearby.`);
        }
    }

    stopAttack() {
        this.bot.pvp.stop();
        this.bot.chat('🛑 Combat stopped. Standing down.');
    }

    guardArea() {
        if (this.isGuarding) {
            this.bot.chat('🛡️ Already guarding this area!');
            return;
        }
        
        this.isGuarding = true;
        const centerPos = this.bot.entity.position.clone();
        this.bot.chat('🛡️ Guarding this area! Intruders will be attacked!');
        
        const guardPositions = [
            centerPos.offset(10, 0, 10),
            centerPos.offset(-10, 0, -10),
            centerPos.offset(10, 0, -10),
            centerPos.offset(-10, 0, 10),
            centerPos.offset(0, 0, 0)
        ];
        
        let currentPoint = 0;
        
        this.currentTask = setInterval(() => {
            if (!this.bot.entity || !this.isGuarding) {
                clearInterval(this.currentTask);
                return;
            }
            
            if (this.bot.pvp.target) {
                return; // Keep fighting
            }
            
            const target = guardPositions[currentPoint];
            this.bot.pathfinder.setGoal(new this.goals.GoalNear(target.x, target.y, target.z, 2));
            
            currentPoint = (currentPoint + 1) % guardPositions.length;
            
            // Scan for hostile mobs
            this.scanForHostiles();
            
        }, 10000);
    }

    startPatrol() {
        if (this.isPatrolling) {
            this.bot.chat('🚶 Already patrolling!');
            return;
        }
        
        this.isPatrolling = true;
        this.bot.chat('🚶 Starting area patrol!');
        
        this.currentTask = setInterval(() => {
            if (!this.bot.entity || !this.isPatrolling) {
                clearInterval(this.currentTask);
                return;
            }
            
            if (this.bot.pvp.target) {
                return; // Keep fighting
            }
            
            this.randomPatrol();
            this.scanForHostiles();
            
        }, 30000);
    }

    stopPatrol() {
        this.isPatrolling = false;
        if (this.currentTask) {
            clearInterval(this.currentTask);
            this.currentTask = null;
        }
        this.bot.pathfinder.setGoal(null);
        this.bot.chat('🛑 Patrol stopped.');
    }

    mineBlocks(username) {
        this.bot.chat('⛏️ Starting to mine nearby blocks...');
        const blocksToMine = ['coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'emerald_ore'];
        
        const nearbyBlocks = this.findBlocks(blocksToMine, 15);
        if (nearbyBlocks.length > 0) {
            this.mineBlockSequence(nearbyBlocks);
        } else {
            this.bot.chat('No valuable ores found nearby.');
        }
    }

    collectWood() {
        this.bot.chat('🌲 Collecting wood...');
        const woodTypes = ['oak_log', 'spruce_log', 'birch_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
        
        const nearbyTrees = this.findBlocks(woodTypes, 20);
        if (nearbyTrees.length > 0) {
            this.collectWoodSequence(nearbyTrees);
        } else {
            this.bot.chat('No trees found nearby.');
        }
    }

    equipBestGear() {
        this.bot.armorManager.equipAll();
        this.equipBestWeapon();
        this.bot.chat('🛡️ Equipped best available gear!');
    }

    followPlayer(username) {
        const player = this.bot.players[username];
        if (player && player.entity) {
            this.bot.chat(`👥 Following ${username}!`);
            this.followPlayerEntity(player.entity, 30000);
        }
    }

    stopFollow() {
        this.bot.pathfinder.setGoal(null);
        this.bot.chat('🛑 Stopped following.');
    }

    comeToPlayer(username) {
        const player = this.bot.players[username];
        if (player && player.entity) {
            const target = player.entity.position;
            this.bot.pathfinder.setGoal(new this.goals.GoalNear(target.x, target.y, target.z, 2));
            this.bot.chat(`🚶 Coming to ${username}!`);
        }
    }

    // ========== HEROBRINE METHODS ==========
    
    respondToMention(username) {
        const responses = [
            '...',
            'You called?',
            'I am here...',
            'Why do you speak my name?',
            '*whispers* Be careful what you wish for...',
            'The shadows hear you...',
            'Do not summon what you cannot control...'
        ];
        
        const response = responses[Math.floor(Math.random() * responses.length)];
        this.bot.chat(response);
        
        setTimeout(() => {
            this.teleportNearPlayer(username);
            this.stareAtPlayer(username);
        }, 2000);
    }

    disappear() {
        this.bot.chat('*vanishes into the shadows*');
        this.hideFromPlayers();
        
        setTimeout(() => {
            this.bot.chat('I am everywhere... and nowhere...');
        }, 3000);
    }

    appear() {
        const players = Object.values(this.bot.players).filter(p => p.entity);
        if (players.length > 0) {
            const randomPlayer = players[Math.floor(Math.random() * players.length)];
            this.teleportNearPlayer(randomPlayer.username);
            this.bot.chat('*appears suddenly* Did you miss me?');
        }
    }

    scaryAction() {
        const actions = [
            () => {
                this.bot.chat('The walls are watching...');
                this.makeStrangeSounds();
            },
            () => {
                this.bot.chat('*whispers* Join us in the darkness...');
                this.flashLighting();
            },
            () => {
                this.bot.chat('Your world is not what it seems...');
                this.createFakePlayers();
            },
            () => {
                this.bot.chat('The void calls to you...');
                this.teleportPlayersRandomly();
            }
        ];
        
        const action = actions[Math.floor(Math.random() * actions.length)];
        action();
    }

    stalkPlayer(username) {
        this.bot.chat(`👁️ Stalking ${username}...`);
        const player = this.bot.players[username];
        if (player && player.entity) {
            this.followPlayerEntity(player.entity, 60000, 8); // Follow from 8 blocks away
        }
    }

    stopStalking() {
        this.bot.pathfinder.setGoal(null);
        this.bot.chat('👁️ No longer stalking... for now.');
    }

    hauntPlayer(username) {
        this.bot.chat(`👻 Haunting ${username}!`);
        const hauntInterval = setInterval(() => {
            const player = this.bot.players[username];
            if (!player || !player.entity) {
                clearInterval(hauntInterval);
                return;
            }
            
            this.teleportNearPlayer(username);
            this.stareAtPlayer(username);
            
            if (Math.random() < 0.3) {
                this.bot.chat('*whispers* ' + this.getRandomCreepyMessage());
            }
            
        }, 10000);
        
        setTimeout(() => {
            clearInterval(hauntInterval);
            this.bot.chat('The haunting has ended... for now.');
        }, 60000);
    }

    buildStrangeStructure() {
        this.bot.chat('🧱 Building something strange...');
        const startPos = this.bot.entity.position.floored();
        
        // Build a strange pyramid or tower
        for (let y = 0; y < 5; y++) {
            for (let x = -y; x <= y; x++) {
                for (let z = -y; z <= y; z++) {
                    if (Math.abs(x) === y || Math.abs(z) === y) {
                        const blockPos = startPos.offset(x, y, z);
                        setTimeout(() => {
                            this.placeBlockIfPossible(blockPos, 'netherrack');
                        }, (y * 10 + Math.abs(x) + Math.abs(z)) * 100);
                    }
                }
            }
        }
    }

    sendCreepyMessage() {
        const messages = [
            'The end is near...',
            'They are watching...',
            'Your world is a lie...',
            'The voices... they speak...',
            'Darkness consumes all...',
            'You cannot escape...',
            'The truth will terrify you...',
            'Abandon hope...',
            'The void hungers...',
            'Your fate is sealed...'
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.bot.chat(message);
    }

    // ========== UTILITY METHODS ==========
    
    isHostileMob(entity) {
        const hostileMobs = [
            'zombie', 'skeleton', 'spider', 'creeper', 'enderman', 
            'phantom', 'witch', 'blaze', 'ghast', 'piglin_brute'
        ];
        return hostileMobs.some(mob => entity.name.includes(mob));
    }

    equipBestWeapon() {
        const weapons = [
            'netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'golden_sword', 'wooden_sword',
            'netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe', 'golden_axe', 'wooden_axe'
        ];
        
        for (const weapon of weapons) {
            const item = this.bot.inventory.items().find(i => i.name.includes(weapon));
            if (item) {
                this.bot.equip(item, 'hand');
                break;
            }
        }
    }

    findBlocks(blockNames, radius) {
        return this.bot.findBlocks({
            matching: (block) => blockNames.some(name => block.name.includes(name)),
            maxDistance: radius,
            count: 10
        });
    }

    followPlayerEntity(entity, duration, distance = 3) {
        const followGoal = new this.goals.GoalFollow(entity, distance);
        this.bot.pathfinder.setGoal(followGoal, true);
        
        setTimeout(() => {
            this.bot.pathfinder.setGoal(null);
        }, duration);
    }

    teleportNearPlayer(username) {
        const player = this.bot.players[username];
        if (player && player.entity) {
            const playerPos = player.entity.position;
            const offset = vec3(
                (Math.random() * 10 - 5),
                0,
                (Math.random() * 10 - 5)
            );
            const newPos = playerPos.plus(offset);
            
            this.bot.lookAt(player.entity.position.offset(0, 1.6, 0));
            setTimeout(() => {
                this.bot.entity.position.copy(newPos);
            }, 500);
        }
    }

    stareAtPlayer(username) {
        const player = this.bot.players[username];
        if (player && player.entity) {
            this.bot.lookAt(player.entity.position.offset(0, 1.6, 0));
        }
    }

    hideFromPlayers() {
        const randomPos = this.bot.entity.position.offset(
            Math.random() * 50 - 25,
            0,
            Math.random() * 50 - 25
        );
        this.bot.pathfinder.setGoal(new this.goals.GoalNear(randomPos.x, randomPos.y, randomPos.z, 1));
    }

    randomPatrol() {
        if (!this.bot.entity) return;
        
        const currentPos = this.bot.entity.position;
        const randomOffset = vec3(
            currentPos.x + (Math.random() * 40 - 20),
            currentPos.y,
            currentPos.z + (Math.random() * 40 - 20)
        );
        
        this.bot.pathfinder.setGoal(new this.goals.GoalNear(randomOffset.x, randomOffset.y, randomOffset.z, 2));
    }

    scanForHostiles() {
        const hostiles = Object.values(this.bot.entities)
            .filter(entity => this.isHostileMob(entity) && 
                     entity.position.distanceTo(this.bot.entity.position) < 15);
        
        if (hostiles.length > 0) {
            this.bot.pvp.attack(hostiles[0]);
        }
    }

    autoAttackMob(entity) {
        this.equipBestWeapon();
        this.bot.pvp.attack(entity);
        console.log(`Fighter attacking: ${entity.name}`);
    }

    manageInventory(item) {
        // Auto-organize inventory
        if (item.name.includes('_sword') || item.name.includes('_axe')) {
            setTimeout(() => this.equipBestWeapon(), 500);
        }
        if (item.name.includes('_chestplate') || item.name.includes('_leggings') || 
            item.name.includes('_boots') || item.name.includes('_helmet')) {
            setTimeout(() => this.bot.armorManager.equipAll(), 500);
        }
    }

    isBetterGear(itemName) {
        const gearTiers = {
            'netherite': 5,
            'diamond': 4,
            'iron': 3,
            'chainmail': 2,
            'gold': 1,
            'leather': 0
        };
        
        for (const [material, tier] of Object.entries(gearTiers)) {
            if (itemName.includes(material)) {
                return true; // Always collect higher tier gear
            }
        }
        return false;
    }

    collectItem(entity) {
        this.bot.collectBlock.collect(entity);
    }

    // ========== ADVANCED HEROBRINE FEATURES ==========
    
    randomScaryBehavior() {
        const behaviors = [
            () => this.teleportToRandomPlayer(),
            () => this.sendCreepyMessage(),
            () => this.buildRandomStructure(),
            () => this.createFakeEntity(),
            () => this.manipulateLighting()
        ];
        
        const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        behavior();
    }

    randomTeleport() {
        const players = Object.values(this.bot.players).filter(p => p.entity);
        if (players.length > 0) {
            const randomPlayer = players[Math.floor(Math.random() * players.length)];
            this.teleportNearPlayer(randomPlayer.username);
        } else {
            // Teleport to random location
            const randomPos = this.bot.entity.position.offset(
                Math.random() * 100 - 50,
                0,
                Math.random() * 100 - 50
            );
            this.bot.pathfinder.setGoal(new this.goals.GoalNear(randomPos.x, randomPos.y, randomPos.z, 1));
        }
    }

    buildRandomStructure() {
        const structures = [
            () => this.buildPyramid(),
            () => this.buildTower(),
            () => this.buildCircle(),
            () => this.buildCross()
        ];
        
        const structure = structures[Math.floor(Math.random() * structures.length)];
        structure();
    }

    buildPyramid() {
        const startPos = this.bot.entity.position.floored();
        const size = 4;
        
        for (let y = 0; y < size; y++) {
            for (let x = -y; x <= y; x++) {
                for (let z = -y; z <= y; z++) {
                    const blockPos = startPos.offset(x, y, z);
                    setTimeout(() => {
                        this.placeBlockIfPossible(blockPos, 'obsidian');
                    }, (y * 10 + Math.abs(x) + Math.abs(z)) * 50);
                }
            }
        }
    }

    buildTower() {
        const startPos = this.bot.entity.position.floored();
        const height = 8;
        
        for (let y = 0; y < height; y++) {
            for (let x = -1; x <= 1; x++) {
                for (let z = -1; z <= 1; z++) {
                    if (x === 0 || z === 0) {
                        const blockPos = startPos.offset(x, y, z);
                        setTimeout(() => {
                            this.placeBlockIfPossible(blockPos, 'cobblestone');
                        }, (y * 5 + Math.abs(x) + Math.abs(z)) * 50);
                    }
                }
            }
        }
    }

    placeBlockIfPossible(position, blockType) {
        const block = this.bot.blockAt(position);
        if (block && block.name === 'air') {
            this.bot.equip(this.bot.registry.blocksByName[blockType].id, 'hand');
            this.bot.placeBlock(block, vec3(0, 1, 0));
        }
    }

    makeStrangeSounds() {
        // This would require server-side sound playing capabilities
        this.bot.chat('*strange noises echo*');
    }

    flashLighting() {
        // Simulate lightning effects
        this.bot.chat('*lightning flashes*');
    }

    createFakePlayers() {
        this.bot.chat('*shadows move in the distance*');
    }

    teleportPlayersRandomly() {
        this.bot.chat('*reality shifts*');
    }

    createFakeEntity() {
        this.bot.chat('*something appears then vanishes*');
    }

    manipulateLighting() {
        this.bot.chat('*the light grows dim*');
    }

    changeSkinToHerobrine() {
        // Skin change would require re-login with different skin
        this.bot.chat('*my true form revealed*');
    }

    getRandomCreepyMessage() {
        const messages = [
            'behind you',
            'in the walls',
            'watching you',
            'coming closer',
            'never alone',
            'darkness rises',
            'end is near',
            'join us',
            'too late',
            'they come'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    // ========== ROTATION & MANAGEMENT ==========
    
    startRotationTimer() {
        const duration = this.currentMode === 'fighter' ? FIGHTER_DURATION : HEROBRINE_DURATION;
        
        if (this.rotationInterval) {
            clearTimeout(this.rotationInterval);
        }
        
        this.rotationInterval = setTimeout(() => {
            this.rotateBot();
        }, duration);
        
        const hours = duration / (60 * 60 * 1000);
        console.log(`⏰ Scheduled rotation to ${this.currentMode === 'fighter' ? 'HEROBRINE' : 'FIGHTER'} in ${hours} hours`);
    }

    rotateBot() {
        console.log('🔄 Rotating bot modes...');
        
        // Clear tasks
        this.stopPatrol();
        this.isGuarding = false;
        if (this.currentTask) {
            clearInterval(this.currentTask);
            this.currentTask = null;
        }
        
        // Clear rotation interval
        if (this.rotationInterval) {
            clearTimeout(this.rotationInterval);
        }
        
        // Disconnect current bot
        if (this.bot) {
            this.bot.quit();
            this.bot = null;
        }
        
        // Switch modes
        this.currentMode = this.currentMode === 'fighter' ? 'herobrine' : 'fighter';
        
        console.log(`🔄 Switching to ${this.currentMode.toUpperCase()} mode in 5 seconds...`);
        
        // Reconnect with new mode
        setTimeout(() => {
            this.initBot();
        }, 5000);
    }

    scheduleReconnect() {
        console.log('🔄 Attempting to reconnect in 15 seconds...');
        setTimeout(() => {
            if (this.bot) {
                this.bot.quit();
            }
            setTimeout(() => {
                console.log('🔌 Reconnecting...');
                this.initBot();
            }, 5000);
        }, 15000);
    }

    manualRotate() {
        console.log('🔄 Manual rotation triggered');
        this.rotateBot();
    }

    showHelp(username) {
        const helpMessages = [
            '=== BOT COMMANDS ===',
            '!help - Show this help',
            '!mode - Check current mode',
            '!rotate - Switch modes manually',
            '!status - Bot status',
            '!time - Uptime',
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
            '!come - Come to your position',
            '',
            '=== HEROBRINE COMMANDS ===',
            'Say "herobrine" - Summon me',
            '!disappear - Vanish',
            '!appear - Reappear',
            '!scare - Scary action',
            '!stalk [player] - Stalk player',
            '!stop stalk - Stop stalking',
            '!haunt [player] - Haunt player',
            '!build strange - Build something',
            '!message - Creepy message'
        ];
        
        helpMessages.forEach(msg => {
            setTimeout(() => {
                this.bot.chat(msg);
            }, 100);
        });
    }

    showStatus(username) {
        const players = Object.keys(this.bot.players).filter(p => p !== this.bot.username);
        this.bot.chat(`Status: ${this.currentMode.toUpperCase()} mode | Players online: ${players.length} | Health: ${this.bot.health}`);
    }

    showUptime(username) {
        if (this.startTime) {
            const uptime = Date.now() - this.startTime;
            const hours = Math.floor(uptime / (1000 * 60 * 60));
            const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            this.bot.chat(`Uptime: ${hours}h ${minutes}m in ${this.currentMode.toUpperCase()} mode`);
        }
    }

    // Mining and collection sequences
    async mineBlockSequence(blocks) {
        for (const blockPos of blocks) {
            if (!this.bot.entity) break;
            
            const block = this.bot.blockAt(blockPos);
            if (block && this.bot.canDigBlock(block)) {
                try {
                    await this.bot.dig(block);
                    await this.sleep(500);
                } catch (err) {
                    console.log('Mining error:', err);
                }
            }
        }
    }

    async collectWoodSequence(blocks) {
        for (const blockPos of blocks) {
            if (!this.bot.entity) break;
            
            const block = this.bot.blockAt(blockPos);
            if (block && this.bot.canDigBlock(block)) {
                try {
                    await this.bot.dig(block);
                    await this.sleep(300);
                } catch (err) {
                    console.log('Wood collection error:', err);
                }
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Start the bot
console.log(`🎮 Starting Advanced Combined Bot`);
console.log(`📍 Server: ${SERVER_IP}:${SERVER_PORT}`);
console.log(`⚙️ Version: 1.21.10`);
console.log(`🔄 Auto-rotation: Every 2 hours`);

const combinedBot = new CombinedBot();

// Handle process events
process.on('SIGINT', () => {
    console.log('🛑 Shutting down bot gracefully...');
    if (combinedBot.bot) {
        combinedBot.bot.quit();
    }
    process.exit();
});

process.on('unhandledRejection', (err) => {
    console.log('❌ Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.log('❌ Uncaught exception:', err);
});

module.exports = combinedBot;
