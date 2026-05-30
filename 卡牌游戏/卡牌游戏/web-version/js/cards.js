// cards.js - 网页版卡牌游戏卡片系统

/** 试玩/测试：URL `?infiniteMana=1` 或关卡 `infinitePlayerMana: true` 时我方灵力视为无限 */
function yulingIsInfinitePlayerMana(levelConfig) {
    if (levelConfig && levelConfig.infinitePlayerMana) return true;
    if (typeof window === 'undefined') return false;
    try {
        return new URLSearchParams(window.location.search || '').get('infiniteMana') === '1';
    } catch (_) {
        return false;
    }
}

class Card {
    constructor(name, cost, attack, health, cardType = "minion", image = null, itemEffect = null, meta = null) {
        this.name = name;
        this.cost = cost;
        this.attack = attack;
        this.health = health;
        this.maxHealth = health;
        this.cardType = cardType;
        this.itemEffect = itemEffect;
        this.meta = meta == null ? {} : { ...meta };
        this.canAttack = false;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.element = null;
        this.image = image != null ? image : this.createDefaultImage();
    }

    isExternalArtUrl() {
        return typeof this.image === 'string' && this.image.startsWith('images/');
    }

    createDefaultImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 140;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createLinearGradient(0, 0, 100, 140);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, '#e6e6e6');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 100, 140);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 98, 138);

        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name.substring(0, 6), 50, 20);
        if (this.meta.idiom) {
            ctx.fillStyle = '#555';
            ctx.font = '10px Arial';
            ctx.fillText(this.meta.idiom.substring(0, 5), 50, 34);
        }

        ctx.fillStyle = '#00f';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`C:${this.cost}`, 15, 40);

        if (CardFactory.isSpellLikeCardType(this.cardType)) {
            const typeColor =
                this.cardType === 'jin' ? '#7a2e2e' : this.cardType === 'fabao' ? '#6a4a9e' : '#2a6b5e';
            const typeLabel =
                this.cardType === 'jin' ? '锦囊' : this.cardType === 'fabao' ? '法宝' : '道具';
            ctx.fillStyle = typeColor;
            ctx.font = '11px Arial';
            ctx.fillText(typeLabel, 50, 58);
            ctx.fillText(this.name.substring(0, 5), 50, 78);
        } else {
            ctx.fillStyle = '#f00';
            ctx.fillText(`A:${this.attack}`, 15, 60);

            ctx.fillStyle = '#00f';
            ctx.fillText(`H:${this.health}`, 85, 130);
        }

        return canvas.toDataURL();
    }

    createElement() {
        // 仅当节点仍在文档中时才复用；否则旧节点已被移出 DOM 仍复用会导致手牌区重影/残影
        if (this.element && this.element.isConnected) {
            return this.element;
        }
        this.element = null;

        const cardElement = document.createElement('div');
        cardElement.className = 'card card--framed';
        if (this.cardType === 'item') {
            cardElement.classList.add('card--item');
        } else if (this.cardType === 'jin') {
            cardElement.classList.add('card--jin');
        } else if (this.cardType === 'fabao') {
            cardElement.classList.add('card--fabao');
        }

        const frameRoot = document.createElement('div');
        frameRoot.className = 'card-frame-root';
        frameRoot.setAttribute('aria-hidden', 'true');

        const frameImg = document.createElement('img');
        frameImg.className = 'card-frame-img';
        frameImg.src = 'images/ui/card_frame_1024x1536_transparent.webp';
        frameImg.alt = '';
        frameImg.draggable = false;

        frameRoot.appendChild(frameImg);

        const body = document.createElement('div');
        body.className = 'card-body';

        const costElement = document.createElement('div');
        costElement.className = 'cost-stat';
        costElement.textContent = this.cost;

        const titleElement = document.createElement('div');
        titleElement.className = 'card-title';
        titleElement.textContent = this.name;

        const artElement = document.createElement('div');
        artElement.className = 'card-art';
        if (this.isExternalArtUrl()) {
            const src = this.image;
            const img = new Image();
            img.onload = () => {
                artElement.style.backgroundImage = `url('${src}')`;
            };
            img.onerror = () => {
                this.image = this.createDefaultImage();
                artElement.style.backgroundImage = `url('${this.image}')`;
            };
            img.src = src;
        } else {
            artElement.style.backgroundImage = `url('${this.image}')`;
        }

        const typeElement = document.createElement('div');
        typeElement.className = 'card-type';
        const typeLabelMap = {
            minion: '随从',
            spell: '术法',
            weapon: '法器',
            item: '道具',
            jin: '锦囊',
            fabao: '法宝'
        };
        typeElement.textContent = typeLabelMap[this.cardType] || this.cardType;

        const statsElement = document.createElement('div');
        statsElement.className = 'card-stats';

        if (CardFactory.isSpellLikeCardType(this.cardType)) {
            const hint = document.createElement('div');
            hint.className = 'card-item-hint';
            hint.textContent = this.meta.usageActual || CardFactory.getItemEffectSummary(this.itemEffect);
            statsElement.appendChild(hint);
        } else {
            const attackElement = document.createElement('div');
            attackElement.className = 'attack-stat';
            attackElement.textContent = this.attack;

            const healthElement = document.createElement('div');
            healthElement.className = 'health-stat';
            healthElement.textContent = this.health;

            statsElement.appendChild(attackElement);
            statsElement.appendChild(healthElement);
        }

        body.appendChild(costElement);
        body.appendChild(titleElement);
        body.appendChild(artElement);
        body.appendChild(typeElement);
        body.appendChild(statsElement);

        cardElement.appendChild(body);
        cardElement.appendChild(frameRoot);

        if (CardFactory.isSpellLikeCardType(this.cardType) && (this.meta.idiom || this.meta.usageDesign)) {
            const tip = [this.meta.idiom ? `成语：${this.meta.idiom}` : '', this.meta.usageDesign || ''].filter(Boolean).join('\n');
            cardElement.title = tip;
        }

        this.element = cardElement;
        return cardElement;
    }

    updateStats() {
        if (!this.element) return;
        if (CardFactory.isSpellLikeCardType(this.cardType)) return;

        const stats = this.element.querySelector('.card-stats');
        if (!stats) return;

        const attackEl = stats.querySelector('.attack-stat');
        const healthEl = stats.querySelector('.health-stat');

        if (attackEl) attackEl.textContent = this.attack;
        if (healthEl) {
            healthEl.textContent = this.health;
            healthEl.style.color = this.health <= this.maxHealth / 2 ? '#cf3c38' : '#b33631';
        }
    }

    setCanAttack(canAttack) {
        this.canAttack = canAttack;
        if (!this.element) return;

        if (canAttack) {
            this.element.classList.add('can-attack');
        } else {
            this.element.classList.remove('can-attack');
        }
    }
}

const CardFactory = {
    isSpellLikeCardType(t) {
        return t === 'item' || t === 'jin' || t === 'fabao';
    },

    /** 单套牌库中，同一随从名称最多可出现张数（与「同名最多两张」一致） */
    MINION_NAME_MAX_COPIES_PER_DECK: 2,

    randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    getNamePool(level) {
        const pools = {
            1: ['星尘学徒', '月湾守卫', '微光精灵', '晶核漫游者', '霜羽斥候'],
            2: ['星环骑士', '银月祭司', '幻雾猎手', '流光剑士', '苍穹驭手'],
            3: ['天穹执政官', '深空猎龙者', '寂灭先知', '永夜裁决者', '暮光大主教'],
            4: ['鹿影侍从', '虚空统御', '天命星魁', '渊影君王', '万象归零者']
        };
        return pools[level] || pools[1];
    },

    getStatRange(level, isAI) {
        const aiRanges = {
            1: { cost: [1, 5], attack: [1, 5], health: [1, 6] },
            2: { cost: [2, 6], attack: [2, 6], health: [2, 7] },
            3: { cost: [3, 7], attack: [3, 7], health: [3, 8] },
            4: { cost: [4, 8], attack: [4, 8], health: [4, 9] }
        };

        const playerRanges = {
            1: { cost: [1, 5], attack: [1, 5], health: [1, 6] },
            2: { cost: [1, 5], attack: [1, 5], health: [1, 6] },
            3: { cost: [1, 6], attack: [1, 6], health: [1, 7] },
            4: { cost: [2, 7], attack: [2, 7], health: [2, 8] }
        };

        const normalizedLevel = Math.max(1, Math.min(4, level));
        return isAI ? aiRanges[normalizedLevel] : playerRanges[normalizedLevel];
    },

    /** 全部关卡随从名称池（用于同名张数达上限时换名） */
    allMinionNames() {
        return [
            ...new Set([
                ...this.getNamePool(1),
                ...this.getNamePool(2),
                ...this.getNamePool(3),
                ...this.getNamePool(4)
            ])
        ];
    },

    createRandomMinion(level = 1, isAI = false, nameCounts = null) {
        const normalizedLevel = Math.max(1, Math.min(4, level));
        const names = this.getNamePool(normalizedLevel);
        const range = this.getStatRange(normalizedLevel, isAI);

        const cost = this.randomBetween(range.cost[0], range.cost[1]);
        const attack = this.randomBetween(range.attack[0], range.attack[1]);
        const health = this.randomBetween(range.health[0], range.health[1]);

        let name;
        if (!nameCounts) {
            name = names[Math.floor(Math.random() * names.length)];
        } else {
            const cap =
                typeof this.MINION_NAME_MAX_COPIES_PER_DECK === 'number'
                    ? this.MINION_NAME_MAX_COPIES_PER_DECK
                    : 2;
            const pickFrom = (arr) => {
                const ok = arr.filter((n) => (nameCounts[n] || 0) < cap);
                if (ok.length) return ok[Math.floor(Math.random() * ok.length)];
                return null;
            };
            const all = this.allMinionNames();
            name = pickFrom(names) || pickFrom(all);
            if (!name) {
                name = all.reduce((best, n) =>
                    (nameCounts[n] || 0) < (nameCounts[best] || 0) ? n : best, all[0]);
            }
            nameCounts[name] = (nameCounts[name] || 0) + 1;
        }

        const artPath = `images/cards/${name}.png`;

        return new Card(name, cost, attack, health, 'minion', artPath, null, null);
    },

    /**
     * 非随从牌：成语典故 + 完整设计说明（悬停 title）+ 当前引擎下的简化结算（卡面短说明）。
     */
    NON_MINION_BLUEPRINTS: [
        {
            idiom: '狐假虎威',
            name: '虎威借势',
            cardType: 'jin',
            cost: 2,
            itemEffect: { kind: 'damageHero', value: 3 },
            usageDesign: '指定一名攻击力高于你的角色，本回合你可以借用其攻击力发动一次攻击。使用后，该角色获得1点怒气。',
            usageActual: '「当前」对敌方英雄3点伤害。完整版：借高攻角色代打一攻，其为该源+1怒气。'
        },
        {
            idiom: '列子御风',
            name: '御风飞剑',
            cardType: 'fabao',
            cost: 2,
            itemEffect: { kind: 'damageHeroAndDraw', damage: 2, draw: 1 },
            usageDesign: '飞剑御风直刺敌阵之心，剑气过处风生云涌：对敌方英雄造成伤害，并借势抽牌。',
            usageActual: '「当前」对敌方英雄2点伤害，再抽1张牌。'
        },
        {
            idiom: '妙手回春',
            name: '回春丹瓶',
            cardType: 'fabao',
            cost: 2,
            itemEffect: { kind: 'healSelfAndDraw', heal: 4, draw: 1 },
            usageDesign: '瓶中丹药汲取灵泉精粹，服之气血再生、神思清明：稳固己身并借势补牌。',
            usageActual: '「当前」我方英雄回复4点生命，再抽1张牌。'
        },
        {
            idiom: '壶中日月',
            name: '凝灵葫',
            cardType: 'fabao',
            cost: 2,
            itemEffect: { kind: 'gainMana', value: 3 },
            usageDesign: '葫纳八方灵机，倾之可得一时充盈：将散逸灵气凝入己身，本回合可用法力增多。',
            usageActual: '「当前」本回合法力+3（不超过当前法力上限）。'
        },
        {
            idiom: '锦绣河山',
            name: '山河卷轴',
            cardType: 'fabao',
            cost: 3,
            itemEffect: { kind: 'healSelfAndDraw', heal: 3, draw: 2 },
            usageDesign: '展卷则千里江山如在目前：承山势之厚以固本，览幅员之广以开思路。',
            usageActual: '「当前」我方英雄回复3点生命，再抽2张牌。'
        },
        {
            idiom: '魂不守舍',
            name: '引魂灯',
            cardType: 'fabao',
            cost: 2,
            itemEffect: { kind: 'damageHeroAndDraw', damage: 1, draw: 2 },
            usageDesign: '青焰摇曳，照见敌阵气脉紊乱：扰其心志，灯影所至机缘自来。',
            usageActual: '「当前」对敌方英雄1点伤害，再抽2张牌。'
        },
        {
            idiom: '守株待兔',
            name: '守株陷阱',
            cardType: 'item',
            cost: 2,
            itemEffect: { kind: 'damageHero', value: 2 },
            usageDesign: '放置在自己场上。敌方第一次主动攻击你时进行判定；判定失败则攻击无效，并受到1点反伤。',
            usageActual: '「当前」对敌方英雄2点伤害。完整版：己方陷阱，敌首次攻你时判定，败则攻无效并受1反伤。'
        },
        {
            idiom: '塞翁失马',
            name: '祸福相依',
            cardType: 'jin',
            cost: 2,
            itemEffect: { kind: 'draw', value: 2 },
            usageDesign: '当你受到伤害或失去一张牌时使用，立即摸2张牌；若摸到道具牌，可额外回复1点生命。',
            usageActual: '「当前」摸2张牌。完整版：须于受伤或失牌时发动；摸到道具则+1生命。'
        },
        {
            idiom: '画蛇添足',
            name: '多此一举',
            cardType: 'jin',
            cost: 1,
            itemEffect: { kind: 'draw', value: 1 },
            usageDesign: '指定一名刚使用过技能的敌方角色，使其额外弃1张手牌；若无法弃牌，则该技能效果减半。',
            usageActual: '「当前」摸1张牌。完整版：指定刚用技的敌角色，其再弃1手牌，否则技能折半。'
        },
        {
            idiom: '亡羊补牢',
            name: '补牢之策',
            cardType: 'item',
            cost: 3,
            itemEffect: { kind: 'healSelf', value: 5 },
            usageDesign: '当你受到一次攻击后可装备此牌。装备后，下一次受到的伤害减少1点。若本回合已损失生命，则额外摸1张牌。',
            usageActual: '「当前」回复5生命。完整版：受击后可装备，下次伤害-1；本回合已损血则再摸1。'
        },
        {
            idiom: '滥竽充数',
            name: '混入队列',
            cardType: 'jin',
            cost: 3,
            itemEffect: { kind: 'draw', value: 2 },
            usageDesign: '指定己方一名低等级角色，使其伪装成高等级角色直到回合结束。敌方若攻击该角色，需要先弃1张牌。',
            usageActual: '「当前」摸2张牌。完整版：己方低等级伪装为高等级至回合末，敌攻其须先弃1牌。'
        },
        {
            idiom: '掩耳盗铃',
            name: '自欺烟幕',
            cardType: 'jin',
            cost: 1,
            itemEffect: { kind: 'damageHero', value: 2 },
            usageDesign: '使一名敌方角色本回合无法查看你的手牌、装备牌或陷阱牌；若其仍选择攻击你，攻击命中率降低。',
            usageActual: '「当前」对敌方英雄2点伤害。完整版：敌本回合不可窥你手牌/装备/陷阱；仍攻则命中降低。'
        },
        {
            idiom: '愚公移山',
            name: '移山之志',
            cardType: 'item',
            cost: 3,
            itemEffect: { kind: 'healSelf', value: 4 },
            usageDesign: '装备后，每回合开始放置1枚“坚持”标记。集满3枚后，可移除敌方场上一张防御类道具牌或障碍牌。',
            usageActual: '「当前」回复4生命。完整版：每回合+1「坚持」，满3枚可移除敌防御/障碍牌。'
        },
        {
            idiom: '鹬蚌相争',
            name: '渔翁得利',
            cardType: 'jin',
            cost: 3,
            itemEffect: { kind: 'draw', value: 2 },
            usageDesign: '当两名敌方角色互相造成伤害后使用，你立即摸2张牌，或选择其中一名受伤角色额外受到1点伤害。',
            usageActual: '「当前」摸2张牌。完整版：须于两敌互伤后发动；或改令其一额外受1伤。'
        },
        {
            idiom: '庖丁解牛',
            name: '游刃有余',
            cardType: 'item',
            cost: 2,
            itemEffect: { kind: 'draw', value: 1 },
            usageDesign: '装备后，你每回合第一次攻击若命中，可选择：摸1张牌，或减少目标1点防御。',
            usageActual: '「当前」摸1张牌。完整版：首击命中可选摸1或减目标1防。'
        }
    ],

    getItemEffectSummary(effect) {
        if (!effect || !effect.kind) return '';
        if (effect.kind === 'damageHero') return `对敌方英雄 ${effect.value} 伤害`;
        if (effect.kind === 'damageHeroAndDraw') {
            const d = effect.damage != null ? effect.damage : effect.value || 0;
            const dr = effect.draw != null ? effect.draw : 1;
            return `对敌方英雄 ${d} 伤害，抽 ${dr} 张牌`;
        }
        if (effect.kind === 'healSelf') return `我方英雄回复 ${effect.value} 生命`;
        if (effect.kind === 'healSelfAndDraw') {
            const h = effect.heal != null ? effect.heal : effect.value || 0;
            const dr = effect.draw != null ? effect.draw : 1;
            return `我方英雄回复 ${h} 生命，抽 ${dr} 张牌`;
        }
        if (effect.kind === 'draw') return `抽 ${effect.value || 1} 张牌`;
        if (effect.kind === 'gainMana') return `本回合法力 +${effect.value || 0}（不超过上限）`;
        return '';
    },

    createRandomItem(level = 1) {
        void level;
        const pool = this.NON_MINION_BLUEPRINTS;
        const def = pool[Math.floor(Math.random() * pool.length)];
        const artPath = `images/cards/${def.name}.png`;
        const meta = {
            idiom: def.idiom,
            usageDesign: def.usageDesign,
            usageActual: def.usageActual
        };
        return new Card(def.name, def.cost, 0, 0, def.cardType, artPath, { ...def.itemEffect }, meta);
    }
};

class Player {
    constructor(name, heroColor = '#3498db', heroImage = null) {
        this.name = name;
        this.health = 30;
        this.maxHeroHealth = 30;
        this.maxMana = 0;
        this.mana = 0;
        /** 为 true 时不扣灵力、任意费用可打出；界面显示 ∞ */
        this.infiniteMana = false;
        this.deck = [];
        this.hand = [];
        this.battlefield = [];
        this.heroColor = heroColor;
        this.heroImage = heroImage;
        this.heroElement = null;
        this.healthEl = null;
        this.manaEl = null;
    }

    hasPlayableMana(cost) {
        const c = typeof cost === 'number' ? cost : 0;
        return !!this.infiniteMana || this.mana >= c;
    }

    getManaOrbShortText() {
        if (this.infiniteMana) return '∞ / ∞';
        return `${this.mana} / ${this.maxMana}`;
    }

    getManaHeroLineText() {
        if (this.infiniteMana) return '法力 ∞ / ∞';
        return `法力 ${this.mana} / ${this.maxMana}`;
    }

    createHeroElement() {
        if (this.heroElement) return this.heroElement;

        const heroElement = document.createElement('div');
        heroElement.className = 'hero-card';
        heroElement.style.position = 'absolute';

        const portrait = document.createElement('div');
        portrait.className = 'hero-card__portrait';

        const plate = document.createElement('div');
        plate.className = 'hero-card__plate';

        const baseGradient = 'linear-gradient(160deg, rgba(15, 33, 30, 0.36), rgba(15, 33, 30, 0.64))';
        if (!this.heroImage) {
            plate.style.background = `${baseGradient}, ${this.heroColor}`;
        } else if (typeof this.heroImage === 'string' && this.heroImage.startsWith('images/')) {
            plate.style.background = `${baseGradient}, ${this.heroColor}`;
            const src = this.heroImage;
            const img = new Image();
            img.onload = () => {
                /* 不再叠深色渐变，避免战场英雄立绘发灰；可读性交给 CSS ::before 轻微晕光 */
                plate.style.background = `url('${src}') center / cover no-repeat`;
            };
            img.onerror = () => {};
            img.src = src;
        } else {
            plate.style.background = `url('${this.heroImage}') center / cover no-repeat`;
        }

        const healthContainer = document.createElement('div');
        healthContainer.className = 'hero-card__meter';

        const healthEl = document.createElement('div');
        healthEl.className = 'hero-card__value';
        healthEl.dataset.role = 'hero-health';
        healthEl.textContent = `HP: ${this.health}`;

        this.healthEl = healthEl;
        healthContainer.appendChild(healthEl);

        const manaContainer = document.createElement('div');
        manaContainer.className = 'hero-card__meter';

        const manaEl = document.createElement('div');
        manaEl.className = 'hero-card__value';
        manaEl.dataset.role = 'hero-mana';
        manaEl.textContent = this.getManaHeroLineText();

        this.manaEl = manaEl;
        manaContainer.appendChild(manaEl);

        heroElement.setAttribute('aria-label', this.name);

        const statsRow = document.createElement('div');
        statsRow.className = 'hero-card__stats';
        statsRow.appendChild(healthContainer);
        statsRow.appendChild(manaContainer);

        portrait.appendChild(plate);
        heroElement.appendChild(portrait);
        heroElement.appendChild(statsRow);

        this.heroElement = heroElement;
        return heroElement;
    }

    updateHeroDisplay() {
        if (!this.heroElement) return;

        if (this.healthEl) this.healthEl.textContent = `HP: ${this.health}`;
        if (this.manaEl) this.manaEl.textContent = this.getManaHeroLineText();
    }
}

class GameState {
    constructor() {
        this.player1 = null;
        this.player2 = null;
        this.currentPlayer = null;
        this.opponent = null;
        this.turn = 1;
        this.phase = "play";
        this.selectedAttacker = null;
        this.gameOver = false;
        this.winner = null;
        this.levelConfig = null;
    }

    initializeGame(levelConfig = {}) {
        const defaultLevelConfig = {
            id: 1,
            name: '星尘试炼',
            enemyHealth: 30,
            enemyStartingMana: 0,
            enemyDeckLevel: 1,
            playerDeckLevel: 1,
            aiTradeBias: 1
        };

        this.levelConfig = { ...defaultLevelConfig, ...levelConfig };

        const playerName = this.player1?.name || 'Player1';

        this.player1 = new Player(playerName, '#5e7ce0');
        this.player1.infiniteMana = yulingIsInfinitePlayerMana(this.levelConfig);
        const enemyName = this.levelConfig.enemyName || '星域守卫';
        const enemyAccent = this.levelConfig.enemyAccent || '#b054b8';
        this.player2 = new Player(enemyName, enemyAccent);
        this.player2.health = this.levelConfig.enemyHealth;
        this.player2.maxHeroHealth = this.levelConfig.enemyHealth;
        this.player2.heroImage =
            this.levelConfig.enemyHeroImage || `images/heroes/enemy_${this.levelConfig.id}.png`;

        this.currentPlayer = this.player1;
        this.opponent = this.player2;
        this.turn = 1;
        this.phase = 'play';
        this.gameOver = false;
        this.winner = null;
        this.selectedAttacker = null;

        this.player1.deck = this.createDeck('player');
        this.player2.deck = this.createDeck('ai');

        for (let i = 0; i < 3; i++) {
            if (this.player1.deck.length > 0) {
                this.player1.hand.push(this.player1.deck.pop());
                if (typeof window !== 'undefined' && window.YulingAudio) window.YulingAudio.playSfx('draw');
            }
            if (this.player2.deck.length > 0) {
                this.player2.hand.push(this.player2.deck.pop());
            }
        }

        this.player2.maxMana = Math.max(0, this.levelConfig.enemyStartingMana);
        this.player2.mana = this.player2.maxMana;

        this.startTurn(this.player1);
        this.ensureOpeningHandHasPlayableCard(this.player1);
    }

    ensureOpeningHandHasPlayableCard(player) {
        if (player.infiniteMana) return;
        const mana = player.mana;
        if (player.hand.some(c => c.cost <= mana)) return;
        const deckIdx = player.deck.findIndex(c => c.cost <= mana);
        if (deckIdx === -1) return;
        const handIdx = player.hand.findIndex(c => c.cost > mana);
        const swapHandIdx = handIdx === -1 ? 0 : handIdx;
        const tmp = player.hand[swapHandIdx];
        player.hand[swapHandIdx] = player.deck[deckIdx];
        player.deck[deckIdx] = tmp;
    }

    createDeck(owner = 'player') {
        const deck = [];
        const level = owner === 'ai' ? this.levelConfig.enemyDeckLevel : this.levelConfig.playerDeckLevel;
        const isAI = owner === 'ai';
        const noMinions =
            typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search || '').get('noMinions') === '1';
        const skipMinions = noMinions && owner === 'player';
        const minionCount = skipMinions ? 0 : 12;
        const itemCount = skipMinions ? 20 : 8;

        const minionNameCounts = {};
        for (let i = 0; i < minionCount; i++) {
            deck.push(CardFactory.createRandomMinion(level, isAI, minionNameCounts));
        }
        for (let i = 0; i < itemCount; i++) {
            deck.push(CardFactory.createRandomItem(level));
        }

        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        return deck;
    }

    startTurn(player) {
        player.maxMana = Math.min(10, player.maxMana + 1);
        player.mana = player.maxMana;

        const handMax = GameState.HAND_SIZE_MAX;
        if (player.deck.length > 0 && player.hand.length < handMax) {
            player.hand.push(player.deck.pop());
            if (typeof window !== 'undefined' && window.YulingAudio) window.YulingAudio.playSfx('draw');
        }

        for (const minion of player.battlefield) {
            minion.setCanAttack(true);
        }
    }

    endTurn() {
        if (this.gameOver) return;

        [this.currentPlayer, this.opponent] = [this.opponent, this.currentPlayer];
        this.turn++;
        this.phase = 'play';
        this.selectedAttacker = null;
        this.startTurn(this.currentPlayer);
    }

    checkGameOver() {
        if (this.player1.health <= 0) {
            this.gameOver = true;
            this.winner = this.player2;
            return true;
        }

        if (this.player2.health <= 0) {
            this.gameOver = true;
            this.winner = this.player1;
            return true;
        }

        return false;
    }

    /**
     * 当全局「回合」计数 ≥ GameState.TURN_BOSS_CARD_EXECUTE（默认 15）时：
     * 我方从手牌打出任意一张牌后，敌方英雄（Boss）生命立即归零（视为秒杀）。与顶栏「回合」数字一致。
     * @param {Player} actor 须为 player1
     */
    applyFifteenthTurnPlayerCardBossExecuteIfNeeded(actor) {
        const minTurn =
            typeof GameState.TURN_BOSS_CARD_EXECUTE === 'number' ? GameState.TURN_BOSS_CARD_EXECUTE : 15;
        if (this.gameOver) return;
        if (!actor || actor !== this.player1) return;
        if (this.turn < minTurn) return;
        if (!this.player2) return;
        if (this.player2.health <= 0) return;
        this.player2.health = 0;
    }
}

/** 每名玩家手牌张数上限（回合开始摸牌与效果抽牌均不可超过） */
GameState.HAND_SIZE_MAX = 5;
/** 全局回合计数 ≥ 该值时，我方每打出一张手牌即秒杀敌方 Boss（与顶栏「回合」一致） */
GameState.TURN_BOSS_CARD_EXECUTE = 15;
/** 每方战场同时存在的随从数量上限；超出时再打出会顶替场上随从（旧随从消亡） */
GameState.BATTLEFIELD_MAX_PER_SIDE = 1;

class DamageNumber {
    constructor(value, x, y, color = 'red') {
        this.value = value;
        this.x = x;
        this.y = y;
        this.color = color;
        this.alpha = 1;
        this.element = this.createElement();
        this.startTime = Date.now();
        this.duration = 1000;
    }

    createElement() {
        const element = document.createElement('div');
        element.className = 'damage-number';
        element.textContent = `-${this.value}`;
        element.style.color = this.color;
        element.style.left = `${this.x}px`;
        element.style.top = `${this.y}px`;
        element.style.opacity = this.alpha;
        document.getElementById('gameContainer').appendChild(element);
        return element;
    }

    update() {
        const elapsed = Date.now() - this.startTime;
        if (elapsed > this.duration) {
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
            return false;
        }

        const progress = elapsed / this.duration;
        this.y -= 1;
        this.alpha = 1 - progress;
        this.element.style.top = `${this.y}px`;
        this.element.style.opacity = this.alpha;
        return true;
    }
}

window.Card = Card;
window.Player = Player;
window.GameState = GameState;
window.CardFactory = CardFactory;
window.DamageNumber = DamageNumber;
