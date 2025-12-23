-- Film Genre Character Presets
-- Advanced character models with full characteristics (facial hair, hairstyles, clothing, accessories)

-- Add new columns to vs_actor_presets for advanced characteristics
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS skin_tone VARCHAR(20) DEFAULT 'medium';
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS hair_style VARCHAR(50);
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS hair_color VARCHAR(50);
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS facial_hair VARCHAR(50);
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS clothing_style VARCHAR(100);
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS accessories TEXT[];
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS facial_expression VARCHAR(50);
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS eye_color VARCHAR(30);
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS genre VARCHAR(50);
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS era VARCHAR(50);
ALTER TABLE vs_actor_presets ADD COLUMN IF NOT EXISTS mood VARCHAR(50);

-- ============================================================================
-- FILM NOIR CHARACTERS (8 presets)
-- ============================================================================
INSERT INTO vs_actor_presets (id, name, description, category, age, gender, height, weight, muscle, tags, skin_tone, hair_style, hair_color, facial_hair, clothing_style, accessories, facial_expression, eye_color, genre, era, mood) VALUES
('noir-detective-male', 'Film Noir Detective', 'Classic hard-boiled private eye, fedora and trench coat', 'film-character', 42, 1.0, 0.58, 0.55, 0.4, ARRAY['noir', 'detective', 'classic', '1940s'], 'fair', 'slicked-back', 'dark-brown', 'five-oclock-shadow', 'trench-coat-suit', ARRAY['fedora', 'cigarette', 'revolver'], 'suspicious', 'brown', 'film-noir', '1940s', 'mysterious'),
('noir-femme-fatale', 'Femme Fatale', 'Dangerous seductress with a secret agenda', 'film-character', 28, 0.0, 0.55, 0.4, 0.3, ARRAY['noir', 'femme-fatale', 'dangerous', '1940s'], 'fair', 'vintage-waves', 'platinum-blonde', NULL, 'evening-gown', ARRAY['pearl-necklace', 'cigarette-holder', 'clutch-purse'], 'seductive', 'blue', 'film-noir', '1940s', 'dangerous'),
('noir-mobster', 'Noir Mobster', 'Ruthless crime boss in pinstripe suit', 'film-character', 50, 1.0, 0.56, 0.65, 0.45, ARRAY['noir', 'mobster', 'gangster', '1940s'], 'olive', 'slicked-back', 'black', 'thin-mustache', 'pinstripe-suit', ARRAY['cigar', 'gold-ring', 'pocket-watch'], 'menacing', 'dark-brown', 'film-noir', '1940s', 'threatening'),
('noir-nightclub-singer', 'Nightclub Singer', 'Sultry jazz singer at a smoky club', 'film-character', 32, 0.0, 0.52, 0.45, 0.28, ARRAY['noir', 'singer', 'jazz', '1940s'], 'brown', 'pin-curls', 'black', NULL, 'sequin-dress', ARRAY['microphone', 'elbow-gloves', 'diamond-earrings'], 'melancholic', 'brown', 'film-noir', '1940s', 'sultry'),
('noir-corrupt-cop', 'Corrupt Police Officer', 'Morally compromised detective on the take', 'film-character', 45, 1.0, 0.6, 0.62, 0.42, ARRAY['noir', 'police', 'corrupt', '1940s'], 'medium', 'short-sides', 'grey-brown', 'mustache', 'police-uniform', ARRAY['badge', 'revolver', 'whiskey-flask'], 'cynical', 'grey', 'film-noir', '1940s', 'corrupt'),
('noir-wealthy-widow', 'Wealthy Widow', 'Mysterious heiress with dark secrets', 'film-character', 38, 0.0, 0.54, 0.42, 0.25, ARRAY['noir', 'wealthy', 'mysterious', '1940s'], 'fair', 'elegant-updo', 'auburn', NULL, 'fur-coat-dress', ARRAY['diamond-brooch', 'veil-hat', 'gloves'], 'composed', 'green', 'film-noir', '1940s', 'mysterious'),
('noir-journalist', 'Crusading Journalist', 'Determined reporter uncovering the truth', 'film-character', 35, 0.5, 0.55, 0.48, 0.35, ARRAY['noir', 'journalist', 'reporter', '1940s'], 'medium', 'newsboy-cut', 'brown', NULL, 'press-outfit', ARRAY['press-pass', 'notepad', 'camera'], 'determined', 'hazel', 'film-noir', '1940s', 'investigative'),
('noir-bartender', 'Wise Bartender', 'All-knowing bartender who hears everything', 'film-character', 55, 1.0, 0.55, 0.58, 0.38, ARRAY['noir', 'bartender', 'wise', '1940s'], 'dark', 'bald-sides', 'grey', 'handlebar-mustache', 'bartender-vest', ARRAY['towel', 'cocktail-shaker'], 'knowing', 'brown', 'film-noir', '1940s', 'wise'),

-- ============================================================================
-- SCI-FI CHARACTERS (10 presets)
-- ============================================================================
('scifi-astronaut-male', 'Space Explorer', 'Brave astronaut on interstellar missions', 'film-character', 35, 1.0, 0.62, 0.55, 0.6, ARRAY['scifi', 'astronaut', 'space', 'explorer'], 'medium', 'buzz-cut', 'brown', 'stubble', 'space-suit', ARRAY['helmet', 'oxygen-pack', 'communicator'], 'determined', 'blue', 'sci-fi', 'future', 'heroic'),
('scifi-astronaut-female', 'Female Space Commander', 'Commanding officer of deep space vessel', 'film-character', 40, 0.0, 0.56, 0.5, 0.55, ARRAY['scifi', 'astronaut', 'commander', 'space'], 'olive', 'short-practical', 'black', NULL, 'command-uniform', ARRAY['rank-insignia', 'tablet', 'sidearm'], 'authoritative', 'brown', 'sci-fi', 'future', 'commanding'),
('scifi-android', 'Humanoid Android', 'Advanced AI in human form, subtle uncanny valley', 'film-character', 30, 0.5, 0.58, 0.48, 0.45, ARRAY['scifi', 'android', 'ai', 'robot'], 'fair', 'perfect-smooth', 'synthetic-silver', NULL, 'minimalist-suit', ARRAY['led-implants', 'interface-port'], 'neutral', 'artificial-blue', 'sci-fi', 'future', 'uncanny'),
('scifi-alien-humanoid', 'Humanoid Alien', 'Alien species with human-like features', 'film-character', 100, 0.5, 0.65, 0.45, 0.5, ARRAY['scifi', 'alien', 'extraterrestrial'], 'blue-grey', 'bald', NULL, NULL, 'alien-robes', ARRAY['translator-device', 'alien-jewelry'], 'serene', 'violet', 'sci-fi', 'future', 'otherworldly'),
('scifi-cyberpunk-hacker', 'Cyberpunk Hacker', 'Underground hacker with neural implants', 'film-character', 26, 0.5, 0.52, 0.42, 0.35, ARRAY['scifi', 'cyberpunk', 'hacker', 'underground'], 'fair', 'mohawk-neon', 'neon-pink', NULL, 'tech-jacket', ARRAY['neural-jack', 'holo-visor', 'cyber-arm'], 'intense', 'cyber-green', 'sci-fi', 'near-future', 'rebellious'),
('scifi-space-marine', 'Space Marine', 'Elite soldier in powered armor', 'film-character', 32, 1.0, 0.68, 0.72, 0.85, ARRAY['scifi', 'military', 'marine', 'soldier'], 'brown', 'military-high-tight', 'black', 'goatee', 'power-armor', ARRAY['plasma-rifle', 'grenades', 'dog-tags'], 'fierce', 'brown', 'sci-fi', 'future', 'aggressive'),
('scifi-scientist', 'Mad Scientist', 'Brilliant but unhinged researcher', 'film-character', 55, 1.0, 0.54, 0.48, 0.3, ARRAY['scifi', 'scientist', 'mad', 'genius'], 'fair', 'wild-einstein', 'white', 'goatee', 'lab-coat', ARRAY['goggles', 'strange-device', 'clipboard'], 'manic', 'grey', 'sci-fi', 'any', 'unhinged'),
('scifi-rebel-leader', 'Rebel Leader', 'Charismatic leader of resistance movement', 'film-character', 38, 0.0, 0.55, 0.5, 0.55, ARRAY['scifi', 'rebel', 'leader', 'resistance'], 'brown', 'braided-warrior', 'black', NULL, 'tactical-vest', ARRAY['blaster', 'communicator', 'resistance-patch'], 'inspiring', 'brown', 'sci-fi', 'future', 'revolutionary'),
('scifi-bounty-hunter', 'Bounty Hunter', 'Ruthless hunter tracking targets across the galaxy', 'film-character', 35, 1.0, 0.6, 0.58, 0.65, ARRAY['scifi', 'bounty-hunter', 'mercenary'], 'olive', 'ponytail-rough', 'dark-brown', 'full-beard', 'armored-suit', ARRAY['jetpack', 'tracking-device', 'multiple-weapons'], 'cold', 'amber', 'sci-fi', 'future', 'ruthless'),
('scifi-ship-captain', 'Starship Captain', 'Seasoned captain of interstellar freighter', 'film-character', 48, 1.0, 0.58, 0.55, 0.45, ARRAY['scifi', 'captain', 'pilot', 'smuggler'], 'medium', 'roguish-medium', 'salt-pepper', 'scruffy-beard', 'flight-jacket', ARRAY['blaster', 'lucky-charm', 'captain-insignia'], 'charming', 'blue', 'sci-fi', 'future', 'roguish'),

-- ============================================================================
-- WESTERN CHARACTERS (8 presets)
-- ============================================================================
('western-gunslinger', 'Gunslinger', 'Legendary quick-draw outlaw or lawman', 'film-character', 38, 1.0, 0.6, 0.52, 0.5, ARRAY['western', 'gunslinger', 'cowboy'], 'medium', 'long-rugged', 'brown', 'stubble', 'duster-coat', ARRAY['dual-revolvers', 'cowboy-hat', 'spurs'], 'stoic', 'steel-grey', 'western', '1880s', 'dangerous'),
('western-sheriff', 'Town Sheriff', 'Lawman keeping order in the frontier', 'film-character', 45, 1.0, 0.58, 0.58, 0.48, ARRAY['western', 'sheriff', 'lawman'], 'fair', 'short-neat', 'grey-brown', 'thick-mustache', 'vest-shirt', ARRAY['sheriff-star', 'rifle', 'cowboy-hat'], 'stern', 'blue', 'western', '1880s', 'authoritative'),
('western-saloon-girl', 'Saloon Girl', 'Spirited entertainer at the local saloon', 'film-character', 25, 0.0, 0.52, 0.45, 0.3, ARRAY['western', 'saloon', 'dancer'], 'fair', 'ringlet-curls', 'red', NULL, 'saloon-dress', ARRAY['feather-boa', 'fan', 'garter'], 'flirtatious', 'green', 'western', '1880s', 'playful'),
('western-outlaw', 'Notorious Outlaw', 'Wanted criminal with a price on their head', 'film-character', 35, 1.0, 0.58, 0.55, 0.55, ARRAY['western', 'outlaw', 'bandit', 'criminal'], 'olive', 'long-wild', 'black', 'full-beard-wild', 'dusty-clothes', ARRAY['bandana-mask', 'revolver', 'stolen-gold'], 'menacing', 'dark-brown', 'western', '1880s', 'dangerous'),
('western-native-chief', 'Native American Chief', 'Dignified leader of indigenous people', 'film-character', 55, 1.0, 0.6, 0.58, 0.5, ARRAY['western', 'native', 'chief', 'leader'], 'brown', 'long-braids', 'black-grey', NULL, 'traditional-regalia', ARRAY['headdress', 'peace-pipe', 'medicine-bag'], 'dignified', 'brown', 'western', '1880s', 'wise'),
('western-prospector', 'Gold Prospector', 'Grizzled miner seeking fortune', 'film-character', 60, 1.0, 0.54, 0.52, 0.4, ARRAY['western', 'prospector', 'miner', 'gold'], 'fair', 'balding-wild', 'white', 'long-grey-beard', 'worn-clothes', ARRAY['pickaxe', 'gold-pan', 'mule'], 'hopeful', 'blue', 'western', '1880s', 'determined'),
('western-rancher-woman', 'Ranch Owner', 'Strong woman running her own cattle ranch', 'film-character', 40, 0.0, 0.55, 0.52, 0.45, ARRAY['western', 'rancher', 'independent'], 'medium', 'practical-bun', 'brown', NULL, 'ranch-wear', ARRAY['rifle', 'lasso', 'cowboy-hat'], 'resilient', 'hazel', 'western', '1880s', 'determined'),
('western-preacher', 'Frontier Preacher', 'Man of faith with a mysterious past', 'film-character', 50, 1.0, 0.58, 0.5, 0.42, ARRAY['western', 'preacher', 'religious'], 'fair', 'slicked-formal', 'black', 'clean-shaven', 'black-suit', ARRAY['bible', 'cross', 'hidden-gun'], 'righteous', 'grey', 'western', '1880s', 'mysterious'),

-- ============================================================================
-- HORROR CHARACTERS (10 presets)
-- ============================================================================
('horror-vampire-male', 'Classic Vampire', 'Immortal blood-drinker, aristocratic and deadly', 'film-character', 300, 1.0, 0.62, 0.48, 0.45, ARRAY['horror', 'vampire', 'undead', 'gothic'], 'pale', 'slicked-back-formal', 'black', 'clean-shaven', 'victorian-cape', ARRAY['fangs', 'signet-ring', 'cane'], 'predatory', 'red', 'horror', 'any', 'seductive'),
('horror-vampire-female', 'Vampire Countess', 'Ancient vampire noblewoman', 'film-character', 500, 0.0, 0.55, 0.42, 0.35, ARRAY['horror', 'vampire', 'undead', 'gothic'], 'pale', 'flowing-dark', 'jet-black', NULL, 'gothic-gown', ARRAY['fangs', 'blood-pendant', 'dark-crown'], 'hypnotic', 'crimson', 'horror', 'any', 'deadly'),
('horror-werewolf', 'Werewolf (Human Form)', 'Cursed shapeshifter in human state', 'film-character', 32, 1.0, 0.65, 0.68, 0.75, ARRAY['horror', 'werewolf', 'shapeshifter', 'cursed'], 'medium', 'wild-thick', 'dark-brown', 'heavy-stubble', 'torn-clothes', ARRAY['claw-marks', 'wolf-pendant', 'torn-shirt'], 'tormented', 'amber-gold', 'horror', 'any', 'feral'),
('horror-ghost-woman', 'Vengeful Spirit', 'Ghostly apparition seeking justice', 'film-character', 25, 0.0, 0.52, 0.38, 0.2, ARRAY['horror', 'ghost', 'spirit', 'supernatural'], 'deathly-pale', 'long-disheveled', 'black-wet', NULL, 'white-gown-torn', ARRAY['none'], 'anguished', 'white-clouded', 'horror', 'any', 'tragic'),
('horror-slasher-villain', 'Slasher Villain', 'Unstoppable masked killer', 'film-character', 40, 1.0, 0.7, 0.75, 0.8, ARRAY['horror', 'slasher', 'killer', 'villain'], 'pale', 'hidden-mask', 'unknown', NULL, 'jumpsuit-coveralls', ARRAY['machete', 'hockey-mask', 'gloves'], 'emotionless', 'hidden', 'horror', 'modern', 'menacing'),
('horror-witch', 'Dark Witch', 'Practitioner of dark magic', 'film-character', 45, 0.0, 0.54, 0.45, 0.3, ARRAY['horror', 'witch', 'magic', 'occult'], 'olive', 'wild-grey-streaks', 'black-grey', NULL, 'witch-robes', ARRAY['spellbook', 'crystal-ball', 'familiar-cat'], 'sinister', 'black', 'horror', 'any', 'malevolent'),
('horror-zombie', 'Undead Walker', 'Reanimated corpse, decaying but mobile', 'film-character', 35, 0.5, 0.55, 0.5, 0.3, ARRAY['horror', 'zombie', 'undead', 'apocalypse'], 'grey-green', 'patchy-rotting', 'dirty-brown', 'patchy', 'torn-dirty-clothes', ARRAY['wounds', 'missing-flesh'], 'vacant', 'milky-white', 'horror', 'modern', 'mindless'),
('horror-final-girl', 'Final Girl', 'Resourceful survivor of horror scenario', 'film-character', 19, 0.0, 0.52, 0.42, 0.35, ARRAY['horror', 'survivor', 'hero', 'final-girl'], 'fair', 'ponytail-messy', 'brown', NULL, 'casual-torn', ARRAY['improvised-weapon', 'flashlight'], 'terrified-determined', 'blue', 'horror', 'modern', 'survivor'),
('horror-creepy-child', 'Creepy Child', 'Unsettling child with supernatural connection', 'film-character', 8, 0.5, 0.22, 0.3, 0.2, ARRAY['horror', 'child', 'creepy', 'supernatural'], 'pale', 'straight-dark', 'black', NULL, 'old-fashioned-dress', ARRAY['doll', 'drawings'], 'blank-stare', 'dark-unblinking', 'horror', 'any', 'unsettling'),
('horror-cult-leader', 'Cult Leader', 'Charismatic leader of sinister cult', 'film-character', 55, 1.0, 0.58, 0.52, 0.4, ARRAY['horror', 'cult', 'leader', 'occult'], 'fair', 'long-flowing', 'white', 'trimmed-beard', 'ceremonial-robes', ARRAY['ritual-knife', 'pendant', 'book-of-shadows'], 'mesmerizing', 'piercing-blue', 'horror', 'any', 'fanatical'),

-- ============================================================================
-- FANTASY CHARACTERS (12 presets)
-- ============================================================================
('fantasy-warrior-male', 'Barbarian Warrior', 'Fierce fighter from the northern lands', 'film-character', 30, 1.0, 0.72, 0.7, 0.9, ARRAY['fantasy', 'warrior', 'barbarian', 'fighter'], 'fair', 'long-braided', 'blonde', 'braided-beard', 'fur-armor', ARRAY['battle-axe', 'shield', 'war-paint'], 'fierce', 'ice-blue', 'fantasy', 'medieval', 'savage'),
('fantasy-warrior-female', 'Shield Maiden', 'Battle-hardened woman warrior', 'film-character', 28, 0.0, 0.58, 0.55, 0.7, ARRAY['fantasy', 'warrior', 'shield-maiden', 'fighter'], 'fair', 'braided-battle', 'red', NULL, 'leather-armor', ARRAY['sword', 'round-shield', 'war-braids'], 'determined', 'green', 'fantasy', 'medieval', 'fearless'),
('fantasy-wizard', 'Arcane Wizard', 'Master of mystical arts', 'film-character', 70, 1.0, 0.56, 0.48, 0.3, ARRAY['fantasy', 'wizard', 'mage', 'magic'], 'fair', 'long-white', 'white', 'long-white-beard', 'wizard-robes', ARRAY['staff', 'spellbook', 'crystal'], 'wise', 'silver', 'fantasy', 'medieval', 'mystical'),
('fantasy-elf-male', 'Elven Archer', 'Graceful immortal woodland dweller', 'film-character', 300, 1.0, 0.62, 0.42, 0.45, ARRAY['fantasy', 'elf', 'archer', 'immortal'], 'fair', 'long-straight', 'silver-blonde', 'clean-shaven', 'elven-leather', ARRAY['longbow', 'quiver', 'elven-cloak'], 'serene', 'violet', 'fantasy', 'medieval', 'ethereal'),
('fantasy-elf-female', 'Elven Sorceress', 'Ancient elf with powerful magic', 'film-character', 500, 0.0, 0.55, 0.4, 0.35, ARRAY['fantasy', 'elf', 'sorceress', 'magic'], 'fair', 'flowing-ethereal', 'platinum', NULL, 'elven-gown', ARRAY['staff-crystal', 'circlet', 'runes'], 'enigmatic', 'gold', 'fantasy', 'medieval', 'magical'),
('fantasy-dwarf', 'Dwarf Smith', 'Stout craftsman and fierce fighter', 'film-character', 150, 1.0, 0.35, 0.7, 0.75, ARRAY['fantasy', 'dwarf', 'smith', 'warrior'], 'medium', 'long-wild', 'red', 'massive-braided-beard', 'forge-armor', ARRAY['hammer', 'anvil-pendant', 'ale-mug'], 'gruff', 'brown', 'fantasy', 'medieval', 'stubborn'),
('fantasy-rogue', 'Shadow Rogue', 'Cunning thief and assassin', 'film-character', 28, 0.5, 0.55, 0.45, 0.5, ARRAY['fantasy', 'rogue', 'thief', 'assassin'], 'olive', 'hooded-short', 'black', 'light-stubble', 'shadow-leather', ARRAY['daggers', 'lockpicks', 'hood'], 'calculating', 'dark-brown', 'fantasy', 'medieval', 'cunning'),
('fantasy-paladin', 'Holy Paladin', 'Divine warrior in shining armor', 'film-character', 35, 1.0, 0.65, 0.62, 0.7, ARRAY['fantasy', 'paladin', 'knight', 'holy'], 'fair', 'short-noble', 'brown', 'trimmed-beard', 'plate-armor', ARRAY['holy-sword', 'shield-emblem', 'holy-symbol'], 'righteous', 'gold', 'fantasy', 'medieval', 'noble'),
('fantasy-dragon-rider', 'Dragon Rider', 'Elite warrior bonded with dragon', 'film-character', 32, 0.0, 0.58, 0.52, 0.6, ARRAY['fantasy', 'dragon', 'rider', 'elite'], 'olive', 'windswept-long', 'silver', NULL, 'dragon-scale-armor', ARRAY['dragon-helm', 'lance', 'dragon-bond-mark'], 'commanding', 'amber', 'fantasy', 'medieval', 'bonded'),
('fantasy-necromancer', 'Dark Necromancer', 'Wielder of death magic', 'film-character', 60, 1.0, 0.56, 0.45, 0.35, ARRAY['fantasy', 'necromancer', 'dark-magic', 'villain'], 'pale', 'thin-grey', 'grey', 'pointed-goatee', 'dark-robes', ARRAY['skull-staff', 'necronomicon', 'bone-jewelry'], 'malevolent', 'green-glow', 'fantasy', 'medieval', 'evil'),
('fantasy-princess', 'Warrior Princess', 'Noble-born fighter who leads armies', 'film-character', 24, 0.0, 0.55, 0.48, 0.5, ARRAY['fantasy', 'princess', 'warrior', 'noble'], 'fair', 'elegant-battle', 'auburn', NULL, 'royal-armor', ARRAY['sword', 'crown-circlet', 'family-crest'], 'regal', 'emerald', 'fantasy', 'medieval', 'noble'),
('fantasy-bard', 'Traveling Bard', 'Charismatic storyteller and musician', 'film-character', 30, 0.5, 0.55, 0.48, 0.35, ARRAY['fantasy', 'bard', 'musician', 'storyteller'], 'medium', 'rakish-medium', 'brown', 'stylish-stubble', 'colorful-clothes', ARRAY['lute', 'feathered-hat', 'coin-pouch'], 'charming', 'hazel', 'fantasy', 'medieval', 'charismatic'),

-- ============================================================================
-- ACTION/THRILLER CHARACTERS (8 presets)
-- ============================================================================
('action-spy-male', 'Secret Agent', 'Suave international spy', 'film-character', 38, 1.0, 0.6, 0.55, 0.6, ARRAY['action', 'spy', 'agent', 'suave'], 'medium', 'styled-classic', 'dark-brown', 'clean-shaven', 'tuxedo', ARRAY['pistol', 'watch-gadget', 'martini'], 'confident', 'blue', 'action', 'modern', 'cool'),
('action-spy-female', 'Female Operative', 'Deadly and sophisticated agent', 'film-character', 32, 0.0, 0.55, 0.48, 0.55, ARRAY['action', 'spy', 'agent', 'deadly'], 'olive', 'sleek-bob', 'black', NULL, 'tactical-dress', ARRAY['concealed-weapon', 'earpiece', 'high-heels'], 'dangerous', 'brown', 'action', 'modern', 'lethal'),
('action-mercenary', 'Elite Mercenary', 'Battle-hardened soldier of fortune', 'film-character', 40, 1.0, 0.65, 0.68, 0.8, ARRAY['action', 'mercenary', 'soldier', 'elite'], 'brown', 'military-fade', 'black', 'tactical-beard', 'tactical-gear', ARRAY['assault-rifle', 'body-armor', 'dog-tags'], 'hardened', 'brown', 'action', 'modern', 'professional'),
('action-martial-artist', 'Martial Arts Master', 'Disciplined fighter with deadly skills', 'film-character', 35, 1.0, 0.58, 0.52, 0.7, ARRAY['action', 'martial-arts', 'fighter', 'master'], 'olive', 'topknot', 'black', 'thin-beard', 'training-gi', ARRAY['nunchaku', 'hand-wraps', 'dragon-tattoo'], 'focused', 'dark-brown', 'action', 'modern', 'disciplined'),
('action-hacker', 'Elite Hacker', 'Genius computer infiltrator', 'film-character', 26, 0.5, 0.52, 0.42, 0.3, ARRAY['action', 'hacker', 'tech', 'genius'], 'fair', 'messy-tech', 'dyed-blue', NULL, 'hoodie-casual', ARRAY['laptop', 'energy-drink', 'headphones'], 'intense', 'brown', 'action', 'modern', 'focused'),
('action-getaway-driver', 'Getaway Driver', 'Expert driver for heist crews', 'film-character', 30, 1.0, 0.56, 0.5, 0.45, ARRAY['action', 'driver', 'heist', 'expert'], 'medium', 'short-cool', 'brown', 'designer-stubble', 'driving-jacket', ARRAY['racing-gloves', 'car-keys', 'sunglasses'], 'cool', 'grey', 'action', 'modern', 'cool'),
('action-assassin', 'Professional Assassin', 'Cold, efficient killer for hire', 'film-character', 35, 0.0, 0.55, 0.48, 0.55, ARRAY['action', 'assassin', 'killer', 'professional'], 'fair', 'severe-ponytail', 'black', NULL, 'tactical-black', ARRAY['sniper-rifle', 'silenced-pistol', 'garrote'], 'emotionless', 'grey', 'action', 'modern', 'cold'),
('action-corrupt-businessman', 'Corrupt CEO', 'Wealthy villain pulling strings', 'film-character', 55, 1.0, 0.58, 0.6, 0.35, ARRAY['action', 'villain', 'corporate', 'corrupt'], 'fair', 'silver-executive', 'silver', 'clean-shaven', 'expensive-suit', ARRAY['gold-watch', 'cigar', 'bodyguards'], 'smug', 'cold-blue', 'action', 'modern', 'ruthless'),

-- ============================================================================
-- PERIOD DRAMA CHARACTERS (8 presets)
-- ============================================================================
('period-victorian-gentleman', 'Victorian Gentleman', 'Wealthy aristocrat of the British Empire', 'film-character', 45, 1.0, 0.6, 0.55, 0.4, ARRAY['period', 'victorian', 'gentleman', 'aristocrat'], 'fair', 'parted-pomade', 'brown', 'mutton-chops', 'victorian-suit', ARRAY['top-hat', 'cane', 'pocket-watch'], 'dignified', 'blue', 'period-drama', '1880s', 'refined'),
('period-victorian-lady', 'Victorian Lady', 'High society woman navigating constraints', 'film-character', 28, 0.0, 0.52, 0.42, 0.25, ARRAY['period', 'victorian', 'lady', 'society'], 'fair', 'elaborate-updo', 'auburn', NULL, 'corset-gown', ARRAY['parasol', 'fan', 'cameo-brooch'], 'composed', 'green', 'period-drama', '1880s', 'restrained'),
('period-regency-rake', 'Regency Rake', 'Charming but scandalous gentleman', 'film-character', 32, 1.0, 0.62, 0.52, 0.45, ARRAY['period', 'regency', 'rake', 'romantic'], 'fair', 'romantic-tousled', 'dark-brown', 'clean-shaven', 'regency-coat', ARRAY['cravat', 'riding-crop', 'love-letters'], 'roguish', 'dark-brown', 'period-drama', '1810s', 'seductive'),
('period-regency-debutante', 'Regency Debutante', 'Young woman entering society', 'film-character', 18, 0.0, 0.52, 0.4, 0.25, ARRAY['period', 'regency', 'debutante', 'innocent'], 'fair', 'empire-curls', 'blonde', NULL, 'empire-waist-gown', ARRAY['dance-card', 'gloves', 'pearls'], 'hopeful', 'blue', 'period-drama', '1810s', 'innocent'),
('period-medieval-king', 'Medieval King', 'Powerful monarch ruling the realm', 'film-character', 50, 1.0, 0.6, 0.62, 0.5, ARRAY['period', 'medieval', 'king', 'royalty'], 'fair', 'shoulder-length', 'grey-brown', 'royal-beard', 'royal-robes', ARRAY['crown', 'scepter', 'royal-ring'], 'commanding', 'grey', 'period-drama', 'medieval', 'powerful'),
('period-medieval-queen', 'Medieval Queen', 'Cunning queen playing the game of thrones', 'film-character', 35, 0.0, 0.54, 0.48, 0.3, ARRAY['period', 'medieval', 'queen', 'royalty'], 'fair', 'elaborate-medieval', 'black', NULL, 'royal-gown', ARRAY['crown', 'poison-ring', 'royal-seal'], 'calculating', 'green', 'period-drama', 'medieval', 'scheming'),
('period-renaissance-artist', 'Renaissance Artist', 'Brilliant painter of the Italian masters', 'film-character', 40, 1.0, 0.56, 0.5, 0.4, ARRAY['period', 'renaissance', 'artist', 'creative'], 'olive', 'artist-long', 'brown', 'artistic-goatee', 'artist-smock', ARRAY['paintbrush', 'palette', 'sketchbook'], 'passionate', 'brown', 'period-drama', '1500s', 'inspired'),
('period-18th-pirate', 'Golden Age Pirate', 'Swashbuckling sea captain', 'film-character', 38, 1.0, 0.58, 0.55, 0.55, ARRAY['period', 'pirate', 'captain', 'adventure'], 'medium', 'dreadlocks-beads', 'black', 'braided-beard', 'pirate-coat', ARRAY['cutlass', 'tricorn-hat', 'compass'], 'roguish', 'brown', 'period-drama', '1700s', 'adventurous'),

-- ============================================================================
-- ASIAN CINEMA CHARACTERS (8 presets)
-- ============================================================================
('asian-samurai', 'Ronin Samurai', 'Masterless warrior seeking redemption', 'film-character', 40, 1.0, 0.58, 0.55, 0.65, ARRAY['asian', 'samurai', 'ronin', 'warrior'], 'olive', 'topknot-traditional', 'black', 'stubble', 'ronin-robes', ARRAY['katana', 'wakizashi', 'straw-hat'], 'stoic', 'dark-brown', 'asian-cinema', 'edo-period', 'honorable'),
('asian-geisha', 'Geisha Artist', 'Elegant entertainer and artist', 'film-character', 25, 0.0, 0.5, 0.38, 0.25, ARRAY['asian', 'geisha', 'artist', 'elegant'], 'fair', 'elaborate-geisha', 'black', NULL, 'kimono-elaborate', ARRAY['fan', 'shamisen', 'hair-ornaments'], 'graceful', 'brown', 'asian-cinema', 'edo-period', 'mysterious'),
('asian-ninja', 'Shadow Ninja', 'Deadly assassin from the shadows', 'film-character', 28, 0.5, 0.55, 0.48, 0.65, ARRAY['asian', 'ninja', 'assassin', 'shadow'], 'olive', 'hidden-hood', 'black', 'clean-shaven', 'ninja-shozoku', ARRAY['shuriken', 'ninjato', 'smoke-bombs'], 'invisible', 'dark', 'asian-cinema', 'edo-period', 'deadly'),
('asian-wuxia-hero', 'Wuxia Hero', 'Flying martial arts master', 'film-character', 30, 1.0, 0.6, 0.52, 0.7, ARRAY['asian', 'wuxia', 'martial-arts', 'hero'], 'olive', 'flowing-warrior', 'black', 'thin-mustache', 'silk-robes', ARRAY['jian-sword', 'flute', 'scroll'], 'noble', 'brown', 'asian-cinema', 'ancient-china', 'heroic'),
('asian-wuxia-heroine', 'Wuxia Heroine', 'Deadly woman warrior seeking vengeance', 'film-character', 26, 0.0, 0.55, 0.45, 0.6, ARRAY['asian', 'wuxia', 'martial-arts', 'heroine'], 'fair', 'high-ponytail', 'black', NULL, 'warrior-dress', ARRAY['dual-swords', 'throwing-needles', 'jade-pendant'], 'fierce', 'brown', 'asian-cinema', 'ancient-china', 'vengeful'),
('asian-yakuza', 'Yakuza Boss', 'Powerful organized crime leader', 'film-character', 50, 1.0, 0.58, 0.6, 0.5, ARRAY['asian', 'yakuza', 'crime', 'boss'], 'olive', 'slicked-back', 'grey-black', 'clean-shaven', 'expensive-suit', ARRAY['irezumi-tattoos', 'gold-chain', 'missing-finger'], 'intimidating', 'black', 'asian-cinema', 'modern', 'powerful'),
('asian-shaolin-monk', 'Shaolin Monk', 'Disciplined warrior monk', 'film-character', 35, 1.0, 0.58, 0.52, 0.75, ARRAY['asian', 'shaolin', 'monk', 'martial-arts'], 'olive', 'bald-shaved', NULL, 'clean-shaven', 'monk-robes', ARRAY['staff', 'prayer-beads', 'burn-marks'], 'peaceful', 'brown', 'asian-cinema', 'ancient-china', 'disciplined'),
('asian-k-drama-lead', 'K-Drama Lead', 'Charismatic modern romantic hero', 'film-character', 28, 1.0, 0.6, 0.5, 0.45, ARRAY['asian', 'k-drama', 'romantic', 'modern'], 'fair', 'k-pop-styled', 'dark-brown', 'clean-shaven', 'designer-casual', ARRAY['smartphone', 'luxury-watch', 'sports-car-keys'], 'dreamy', 'brown', 'asian-cinema', 'modern', 'romantic'),

-- ============================================================================
-- SUPERHERO/COMIC CHARACTERS (8 presets)
-- ============================================================================
('superhero-caped-hero', 'Caped Crusader', 'Dark vigilante protecting the city', 'film-character', 35, 1.0, 0.65, 0.62, 0.75, ARRAY['superhero', 'vigilante', 'dark', 'hero'], 'fair', 'short-brooding', 'black', 'stubble', 'armored-suit', ARRAY['cape', 'utility-belt', 'grappling-hook'], 'brooding', 'blue', 'superhero', 'modern', 'dark'),
('superhero-super-soldier', 'Super Soldier', 'Enhanced patriotic hero', 'film-character', 32, 1.0, 0.68, 0.65, 0.85, ARRAY['superhero', 'soldier', 'enhanced', 'patriot'], 'fair', 'classic-side-part', 'blonde', 'clean-shaven', 'tactical-suit', ARRAY['shield', 'helmet', 'stripes'], 'noble', 'blue', 'superhero', 'modern', 'heroic'),
('superhero-amazon-warrior', 'Amazon Warrior', 'Divine warrior princess', 'film-character', 800, 0.0, 0.6, 0.55, 0.7, ARRAY['superhero', 'amazon', 'warrior', 'divine'], 'olive', 'flowing-dark', 'black', NULL, 'amazon-armor', ARRAY['lasso', 'sword', 'tiara'], 'powerful', 'blue', 'superhero', 'mythic', 'noble'),
('superhero-speedster', 'Lightning Speedster', 'Fastest person alive', 'film-character', 25, 1.0, 0.58, 0.48, 0.55, ARRAY['superhero', 'speedster', 'fast', 'hero'], 'medium', 'aerodynamic-short', 'brown', 'clean-shaven', 'speed-suit', ARRAY['lightning-emblem', 'visor', 'earpiece'], 'energetic', 'green', 'superhero', 'modern', 'quick'),
('superhero-genius-billionaire', 'Genius Billionaire', 'Tech genius in powered armor', 'film-character', 42, 1.0, 0.58, 0.55, 0.5, ARRAY['superhero', 'genius', 'tech', 'billionaire'], 'medium', 'styled-goatee', 'dark-brown', 'van-dyke', 'power-armor', ARRAY['arc-reactor', 'ai-assistant', 'hud-display'], 'arrogant', 'brown', 'superhero', 'modern', 'genius'),
('superhero-mutant-leader', 'Mutant Leader', 'Telepathic leader of mutant heroes', 'film-character', 60, 1.0, 0.56, 0.5, 0.35, ARRAY['superhero', 'mutant', 'telepath', 'leader'], 'fair', 'bald', NULL, 'clean-shaven', 'formal-suit', ARRAY['wheelchair', 'cerebro-helmet'], 'wise', 'blue', 'superhero', 'modern', 'wise'),
('superhero-anti-hero', 'Regenerating Anti-Hero', 'Wise-cracking mercenary with healing factor', 'film-character', 35, 1.0, 0.6, 0.58, 0.7, ARRAY['superhero', 'anti-hero', 'mercenary', 'humor'], 'scarred', 'masked', 'unknown', NULL, 'red-black-suit', ARRAY['dual-katanas', 'pistols', 'pouches'], 'irreverent', 'hidden', 'superhero', 'modern', 'chaotic'),
('superhero-villain-mastermind', 'Criminal Mastermind', 'Genius villain with elaborate plans', 'film-character', 50, 1.0, 0.58, 0.55, 0.4, ARRAY['superhero', 'villain', 'genius', 'mastermind'], 'fair', 'bald-chrome', NULL, 'clean-shaven', 'villain-suit', ARRAY['power-armor', 'kryptonite', 'lair-controls'], 'calculating', 'green', 'superhero', 'modern', 'evil')

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    age = EXCLUDED.age,
    gender = EXCLUDED.gender,
    height = EXCLUDED.height,
    weight = EXCLUDED.weight,
    muscle = EXCLUDED.muscle,
    tags = EXCLUDED.tags,
    skin_tone = EXCLUDED.skin_tone,
    hair_style = EXCLUDED.hair_style,
    hair_color = EXCLUDED.hair_color,
    facial_hair = EXCLUDED.facial_hair,
    clothing_style = EXCLUDED.clothing_style,
    accessories = EXCLUDED.accessories,
    facial_expression = EXCLUDED.facial_expression,
    eye_color = EXCLUDED.eye_color,
    genre = EXCLUDED.genre,
    era = EXCLUDED.era,
    mood = EXCLUDED.mood;

-- Count total presets
-- SELECT COUNT(*) as total, category FROM vs_actor_presets GROUP BY category ORDER BY category;

