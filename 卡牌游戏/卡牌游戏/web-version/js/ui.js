// ui.js - 网页版卡牌游戏UI逻辑

const CHARACTER_SELECT_PROFILES = [
    {
        image: 'images/heroes/player_0.png',
        name: '玄武守卫',
        title: '防御 · 护卫',
        desc: '重甲盾卫，稳守阵脚；擅护友方随从，以守势化解强敌锋芒。',
        stats: '英雄生命: 30'
    },
    {
        image: 'images/heroes/player_1.png',
        name: '逍遥剑客',
        title: '均衡 · 剑客',
        desc: '斗笠青衫，长剑在手；攻守均衡，身法飘逸，于敌阵间进退自如。',
        stats: '英雄生命: 30'
    },
    {
        image: 'images/heroes/player_2.png',
        name: '九尾灵狐',
        title: '机动 · 灵妖',
        desc: '尾影幻生，灵焰流转；身法灵动，以幻术扰敌阵脚，再以术法收束战局。',
        stats: '英雄生命: 30'
    },
    {
        image: 'images/heroes/player_3.png',
        name: '青云剑修',
        title: '输出 · 剑修',
        desc: '御剑行空，剑气如虹；擅正面压制，以锋芒撕开敌阵缺口。',
        stats: '英雄生命: 30'
    }
];

class UIManager {
    constructor(game) {
        this.game = game;
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingBar = document.getElementById('loadingBar');
        this.loadingStatus = document.getElementById('loadingStatus');
        this.characterSelection = document.getElementById('characterSelection');
        this.levelSelection = document.getElementById('levelSelection');
        this.levelOptionsContainer = document.getElementById('levelOptions');
        this.levelSelectName = document.getElementById('levelSelectName');
        this.levelSelectTarget = document.getElementById('levelSelectTarget');
        this.levelSelectMeta = document.getElementById('levelSelectMeta');
        this.levelConfirmBtn = document.getElementById('levelConfirmBtn');
        this.levelResultModal = document.getElementById('levelResultModal');
        this.levelResultTitle = document.getElementById('levelResultTitle');
        this.levelResultDetail = document.getElementById('levelResultDetail');
        this.levelPrimaryAction = document.getElementById('levelPrimaryAction');
        this.levelSecondaryAction = document.getElementById('levelSecondaryAction');
        this.bossClearVideoLayer = document.getElementById('bossClearVideoLayer');
        this.bossClearVideo = document.getElementById('bossClearVideo');
        this.bossClearVideoSkip = document.getElementById('bossClearVideoSkip');
        this._bossClearVideoComplete = null;
        this._bossVideoKeydown = null;
        this.aiActionTimer = null;
        this.messageTimer = null;
        this.lastPhaseBannerKey = '';
        this.slotsActive = false;
        this._characterSelectListIndex = 0;
        this._levelSelectListIndex = 0;

        this.setupCharacterSelection();
        this.setupLevelSelection();
        this.setupGameUI();
        this.bindEndTurnButton();
        this.bindResultActions();
        this.bindBossClearVideoLayer();
        this.bindDragSlotEffects();
        this.entryScreen = document.getElementById('entryScreen');
        this.entryDismissed = false;
    }

    _audio() {
        return typeof window !== 'undefined' && window.YulingAudio ? window.YulingAudio : null;
    }

    /** 选关/选角/结算等界面打开时，不应响应战场快捷键与结束回合（否则会偷改阶段）。 */
    isUiBlockingBattleShortcuts() {
        if (this.entryScreen && this.entryScreen.style.display !== 'none' && !this.entryDismissed) {
            return true;
        }
        if (this.loadingOverlay) {
            const disp = typeof window !== 'undefined' && window.getComputedStyle
                ? window.getComputedStyle(this.loadingOverlay).display
                : this.loadingOverlay.style.display;
            if (disp && disp !== 'none') return true;
        }
        if (this.levelSelection && this.levelSelection.style.display === 'flex') {
            return true;
        }
        if (this.characterSelection && this.characterSelection.style.display !== 'none') {
            return true;
        }
        if (this.levelResultModal && this.levelResultModal.style.display === 'flex') {
            return true;
        }
        if (this.bossClearVideoLayer) {
            const disp =
                typeof window !== 'undefined' && window.getComputedStyle
                    ? window.getComputedStyle(this.bossClearVideoLayer).display
                    : this.bossClearVideoLayer.style.display;
            if (disp === 'flex') return true;
        }
        return false;
    }

    setupEntryScreen() {
        if (!this.entryScreen) {
            void this.runLoadingSequence();
            return;
        }

        const dismissAndBoot = async () => {
            if (this.entryDismissed) return;
            this.entryDismissed = true;
            this.entryScreen.classList.add('entry-screen--hide');
            await this.sleep(440);
            this.entryScreen.style.display = 'none';
            await this.runLoadingSequence();
        };

        const btn = document.getElementById('entryStartBtn');
        btn?.addEventListener('click', () => {
            this._audio()?.playSfx('uiClick');
            void dismissAndBoot();
        });

        this.entryKeyHandler = (e) => {
            if (!this.entryScreen || this.entryScreen.style.display === 'none') return;
            if (e.key !== 'Enter') return;
            e.preventDefault();
            void dismissAndBoot();
        };
        document.addEventListener('keydown', this.entryKeyHandler);
    }

    bindEndTurnButton() {
        const endBtn = document.getElementById('endTurnButton');
        if (!endBtn) return;
        endBtn.addEventListener('click', () => {
            this._audio()?.playSfx('uiClick');
            if (this.isUiBlockingBattleShortcuts()) return;
            this.game.advancePhaseOrEndTurnFromPlayer();
        });
    }

    setupLevelSelection() {
        if (!this.levelOptionsContainer || !this.game?.levelConfigs) return;

        this.levelOptionsContainer.innerHTML = '';
        this.game.levelConfigs.forEach((cfg, index) => {
            const opt = document.createElement('button');
            opt.type = 'button';
            opt.className = 'level-option';
            opt.dataset.levelIndex = String(index);
            opt.setAttribute('role', 'option');
            opt.textContent = `第 ${cfg.id} 关 · ${cfg.name}`;
            opt.addEventListener('click', () => {
                this._audio()?.playSfx('uiClick');
                this.applyLevelSelectionIndex(index);
            });
            this.levelOptionsContainer.appendChild(opt);
        });

        this.levelConfirmBtn?.addEventListener('click', () => {
            this._audio()?.playSfx('uiClick');
            this.confirmLevelSelection();
        });

        document.getElementById('levelSelectionHomeBtn')?.addEventListener('click', () => {
            this._audio()?.playSfx('uiClick');
            this.goBackToMainMenu();
        });

        this._levelSelectKeyHandler = (e) => {
            if (!this.levelSelection || this.levelSelection.style.display !== 'flex') return;
            const levelOptions = document.querySelectorAll('.level-option');
            if (!levelOptions.length) return;

            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                const next = (this._levelSelectListIndex + 1) % levelOptions.length;
                this.applyLevelSelectionIndex(next);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = (this._levelSelectListIndex - 1 + levelOptions.length) % levelOptions.length;
                this.applyLevelSelectionIndex(prev);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.confirmLevelSelection();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.goBackToMainMenu();
            }
        };
        document.addEventListener('keydown', this._levelSelectKeyHandler);
    }

    applyLevelSelectionIndex(listIndex) {
        const levelOptions = document.querySelectorAll('.level-option');
        if (listIndex < 0 || listIndex >= levelOptions.length) return;

        this._levelSelectListIndex = listIndex;
        levelOptions.forEach((opt, i) => {
            opt.classList.toggle('selected', i === listIndex);
        });

        const cfg = this.game.levelConfigs[listIndex];
        if (!cfg) return;

        if (this.levelSelectName) this.levelSelectName.textContent = cfg.name;
        if (this.levelSelectTarget) this.levelSelectTarget.textContent = `目标: ${cfg.target}`;
        if (this.levelSelectMeta) {
            this.levelSelectMeta.textContent =
                `敌方生命 ${cfg.enemyHealth} · 敌方起始灵力 ${cfg.enemyStartingMana} · 牌库强度 ${cfg.enemyDeckLevel}/${cfg.playerDeckLevel}`;
        }
    }

    confirmLevelSelection() {
        if (!this.levelSelection) return;

        const idx = this._levelSelectListIndex;
        this.game.initializeLevel(idx);
        this.initializeGameElements();
        this.game.updateUI();

        this.levelSelection.style.display = 'none';
        this.characterSelection.style.display = 'grid';
        this.applyCharacterSelectionIndex(this._characterSelectListIndex);
    }

    /** 选角界面返回上一步：回到关卡选择（不改已选关卡索引）。 */
    goBackFromCharacterToLevelSelection() {
        if (!this.levelSelection || !this.characterSelection) return;
        if (this.characterSelection.style.display === 'none') return;
        this.characterSelection.style.display = 'none';
        this.levelSelection.style.display = 'flex';
        this.applyLevelSelectionIndex(this._levelSelectListIndex);
    }

    /** 返回开场主界面（可再次「进入游戏」走载入与选关）。 */
    goBackToMainMenu() {
        if (!this.entryScreen) return;
        this.entryDismissed = false;
        if (this.levelSelection) this.levelSelection.style.display = 'none';
        if (this.characterSelection) this.characterSelection.style.display = 'none';
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('loading-hide');
            this.loadingOverlay.style.display = 'none';
        }
        this.entryScreen.classList.remove('entry-screen--hide');
        this.entryScreen.style.display = 'flex';
    }

    setupCharacterSelection() {
        this.characterSelectArt = document.getElementById('characterSelectArt');
        this.characterSelectName = document.getElementById('characterSelectName');
        this.characterSelectTitle = document.getElementById('characterSelectTitle');
        this.characterSelectDesc = document.getElementById('characterSelectDesc');
        this.characterSelectStats = document.getElementById('characterSelectStats');

        const characterOptions = document.querySelectorAll('.character-option');
        this._characterSelectListIndex = 0;

        const backBtn = document.getElementById('characterSelectionBackBtn');
        backBtn?.addEventListener('click', () => {
            this._audio()?.playSfx('uiClick');
            this.goBackFromCharacterToLevelSelection();
        });
        document.getElementById('characterSelectionHomeBtn')?.addEventListener('click', () => {
            this._audio()?.playSfx('uiClick');
            this.goBackToMainMenu();
        });

        characterOptions.forEach((option, index) => {
            if (index === 0) option.classList.add('selected');

            option.addEventListener('click', () => {
                this._audio()?.playSfx('uiClick');
                const idx = Array.from(characterOptions).indexOf(option);
                this.applyCharacterSelectionIndex(idx);
            });
        });

        this.characterInfiniteManaToggle = document.getElementById('characterInfiniteManaToggle');
        this.characterInfiniteManaToggle?.addEventListener('change', () => {
            this._audio()?.playSfx('uiClick');
        });

        document.addEventListener('keydown', (e) => {
            if (this.levelSelection && this.levelSelection.style.display === 'flex') return;
            if (this.characterSelection.style.display === 'none') return;

            if (e.key === 'Escape') {
                e.preventDefault();
                this.goBackFromCharacterToLevelSelection();
                return;
            }
            if (e.key === 'ArrowRight') {
                const next = (this._characterSelectListIndex + 1) % characterOptions.length;
                this.applyCharacterSelectionIndex(next);
            } else if (e.key === 'ArrowLeft') {
                const prev = (this._characterSelectListIndex - 1 + characterOptions.length) % characterOptions.length;
                this.applyCharacterSelectionIndex(prev);
            } else if (e.key === 'Enter') {
                const opt = characterOptions[this._characterSelectListIndex];
                this.startGame(opt.textContent.split(' - ')[0], parseInt(opt.dataset.character, 10));
            }
        });

        this.applyCharacterSelectionIndex(0);
    }

    applyCharacterSelectionIndex(listIndex) {
        const characterOptions = document.querySelectorAll('.character-option');
        if (listIndex < 0 || listIndex >= characterOptions.length) return;

        this._characterSelectListIndex = listIndex;
        characterOptions.forEach((opt, i) => {
            opt.classList.toggle('selected', i === listIndex);
        });

        const profile = CHARACTER_SELECT_PROFILES[listIndex];
        if (!profile) return;

        if (this.characterSelectArt) {
            this.characterSelectArt.src = profile.image;
            this.characterSelectArt.alt = profile.name;
        }
        if (this.characterSelectName) this.characterSelectName.textContent = profile.name;
        if (this.characterSelectTitle) this.characterSelectTitle.textContent = profile.title;
        if (this.characterSelectDesc) this.characterSelectDesc.textContent = profile.desc;
        if (this.characterSelectStats) this.characterSelectStats.textContent = profile.stats;
    }

    setupGameUI() {
        this.handContainer = document.getElementById('handArea');
        this.handCardsTrack = document.getElementById('handCardsTrack');
        this.battlefieldContainer = document.getElementById('battlefieldArea');
        this.gameContainer = document.getElementById('gameContainer');
        this.unitsLayer = document.getElementById('unitsLayer') || this.gameContainer;
        this.uiLayer = document.getElementById('uiLayer');

        this.opponentHandDisplay = document.getElementById('enemyHandPreview');
        this.opponentBattlefieldDisplay = document.getElementById('enemyBattleSlots');

        window.addEventListener('resize', () => this.refreshUI());
    }

    getContainerSize() {
        const rect = this.gameContainer.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            rect
        };
    }

    getBoardPosition(side, index, total = 1) {
        const { width, height } = this.getContainerSize();
        const zoneTop = height * 0.14;
        const zoneBottom = height * 0.72;
        const zoneWidth = width * 0.72;
        const zoneStartX = width * 0.14;

        const playerY = zoneBottom - height * 0.175;
        const enemyY = zoneTop + height * 0.072;

        const maxPer = typeof GameState.BATTLEFIELD_MAX_PER_SIDE === 'number' ? GameState.BATTLEFIELD_MAX_PER_SIDE : 1;
        const useDuelLanes = maxPer <= 1;

        if (useDuelLanes) {
            const midX = zoneStartX + zoneWidth / 2;
            const cardW = Math.min(120, Math.max(102, width * 0.074));
            const laneOffset = Math.min(zoneWidth * 0.15, 92);
            const x =
                side === 'player'
                    ? midX - laneOffset - cardW * 0.5
                    : midX + laneOffset - cardW * 0.5;
            return { x, y: side === 'player' ? playerY : enemyY };
        }

        const slotCount = Math.max(1, total);
        const spacing = Math.min(125, zoneWidth / (slotCount + 0.35));
        const usedWidth = spacing * Math.max(0, slotCount - 1);
        const centerX = zoneStartX + zoneWidth / 2;
        const startX = centerX - usedWidth / 2;

        return {
            x: startX + index * spacing,
            y: side === 'player' ? playerY : enemyY
        };
    }

    getHeroPosition(side, opts = {}) {
        const { width, height } = this.getContainerSize();
        const heroW = opts.width ?? Math.min(188, width * 0.14);
        const heroH = opts.height ?? Math.round(heroW * 1.5);

        if (side === 'player') {
            const leftPad = Math.max(12, width * 0.018);
            const dock = document.getElementById('playerDock');
            let y = height - Math.min(height * 0.34, 300) - heroH;
            if (dock && this.gameContainer) {
                const cr = this.gameContainer.getBoundingClientRect();
                const dr = dock.getBoundingClientRect();
                y = (dr.top - cr.top) - 10 - heroH;
            }
            return { x: leftPad, y };
        }

        return {
            x: width - heroW - width * 0.028,
            y: height * 0.125
        };
    }

    resetCardLayout(cardElement) {
        if (!cardElement) return;
        cardElement.style.position = '';
        cardElement.style.left = '';
        cardElement.style.top = '';
        cardElement.style.width = '';
        cardElement.style.height = '';
        cardElement.style.zIndex = '';
        cardElement.style.transform = '';
        cardElement.style.removeProperty('--drag-x');
        cardElement.style.removeProperty('--drag-y');
        cardElement.style.willChange = '';
    }

    /** 手牌：将卡名移出 .card-body，叠在装饰框 webp 之上，避免被框线压住 */
    promoteHandCardTitleAboveFrame(cardEl) {
        if (!cardEl || !cardEl.classList.contains('card--hand')) return;
        const body = cardEl.querySelector('.card-body');
        const title = cardEl.querySelector('.card-title');
        if (!body || !title) return;
        if (title.classList.contains('card-title--above-frame') && title.parentElement === cardEl) return;
        if (body.contains(title)) {
            body.removeChild(title);
            cardEl.insertBefore(title, body);
        }
        title.classList.add('card-title--above-frame');
    }

    bindDragSlotEffects() {
        const tryActivate = () => {
            if (this.game.gameState?.gameOver) return;
            if (!this.game.isPlayerTurn()) return;
            if (this.game.gameState.phase !== 'play') return;
            this.setSlotsActive(true);
        };

        const deactivate = () => this.setSlotsActive(false);

        document.addEventListener('mousedown', tryActivate);
        document.addEventListener('touchstart', tryActivate, { passive: true });
        document.addEventListener('mouseup', deactivate);
        document.addEventListener('touchend', deactivate);
        document.addEventListener('touchcancel', deactivate);
    }

    setSlotsActive(active) {
        if (this.slotsActive === active) return;
        this.slotsActive = active;
        const slots = this.battlefieldContainer?.querySelectorAll('.deploy-slot');
        if (!slots) return;
        slots.forEach(slot => slot.classList.toggle('slot-active', active));
    }

    getElementCenter(element) {
        if (!element || !this.gameContainer) return { x: 0, y: 0 };
        const rect = element.getBoundingClientRect();
        const containerRect = this.gameContainer.getBoundingClientRect();
        return {
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2
        };
    }

    /** 英雄受到伤害时在对应立绘上短时高亮 */
    flashHeroDamageHighlight(damagedPlayer) {
        const gs = this.game.gameState;
        if (!damagedPlayer || damagedPlayer !== gs.player1 && damagedPlayer !== gs.player2) return;

        const id = damagedPlayer === gs.player1 ? 'player1-hero' : 'player2-hero';
        const el = document.getElementById(id);
        if (!el) return;

        el.classList.remove('hero-card--damage-hit');
        void el.offsetWidth;
        el.classList.add('hero-card--damage-hit');

        const done = () => {
            el.classList.remove('hero-card--damage-hit');
        };
        el.addEventListener('animationend', done, { once: true });
        window.setTimeout(done, 900);
    }

    createPlayCardBurst(x, y) {
        const burst = document.createElement('div');
        burst.className = 'play-card-burst';
        burst.style.left = `${x}px`;
        burst.style.top = `${y}px`;
        this.gameContainer.appendChild(burst);
        window.setTimeout(() => burst.remove(), 520);
    }

    createSwordSlash(fromX, fromY, toX, toY) {
        const slash = document.createElement('div');
        slash.className = 'sword-slash';

        const dx = toX - fromX;
        const dy = toY - fromY;
        const length = Math.max(40, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);

        slash.style.left = `${fromX}px`;
        slash.style.top = `${fromY}px`;
        slash.style.width = `${length}px`;
        slash.style.transform = `rotate(${angle}rad)`;
        this.gameContainer.appendChild(slash);
        window.setTimeout(() => slash.remove(), 380);
    }

    createHitBurst(x, y, opts = {}) {
        if (!opts.skipHitSfx) this._audio()?.playSfx('hit');
        const burst = document.createElement('div');
        burst.className = 'hit-burst';
        burst.style.left = `${x}px`;
        burst.style.top = `${y}px`;
        this.gameContainer.appendChild(burst);
        window.setTimeout(() => burst.remove(), 420);
    }

    showTurnBanner(text) {
        const banner = document.createElement('div');
        banner.className = 'turn-banner';

        const inner = document.createElement('div');
        inner.className = 'turn-banner__inner';
        inner.textContent = text;
        banner.appendChild(inner);

        this.gameContainer.appendChild(banner);
        window.setTimeout(() => banner.remove(), 1400);
    }

    showPhaseBannerByState() {
        const phase = this.game.gameState.phase;
        const turn = this.game.gameState.turn;
        const key = `${turn}:${phase}`;
        if (this.lastPhaseBannerKey === key) return;

        this.lastPhaseBannerKey = key;
        this.showTurnBanner(phase === 'attack' ? '攻击阶段' : '出牌阶段');
    }

    bindBossClearVideoLayer() {
        if (this.bossClearVideoSkip) {
            this.bossClearVideoSkip.addEventListener('click', () => {
                this._audio()?.playSfx('uiClick');
                this._finishBossClearVideo();
            });
        }
    }

    playBossClearVideo(src, onComplete) {
        if (!this.bossClearVideoLayer || !this.bossClearVideo) {
            if (onComplete) onComplete();
            return;
        }

        /* 不打断上一段回调：仅静默清场，避免重复进入时误触发旧 onComplete */
        this._bossClearVideoComplete = null;
        if (this._bossVideoKeydown) {
            document.removeEventListener('keydown', this._bossVideoKeydown);
            this._bossVideoKeydown = null;
        }
        const vPrev = this.bossClearVideo;
        if (vPrev) {
            vPrev.pause();
            while (vPrev.firstChild) vPrev.removeChild(vPrev.firstChild);
            vPrev.removeAttribute('src');
            vPrev.load();
        }
        this.bossClearVideoLayer.style.display = 'none';
        this.bossClearVideoLayer.setAttribute('aria-hidden', 'true');

        this._bossClearVideoComplete = onComplete;
        this.bossClearVideoLayer.style.display = 'flex';
        this.bossClearVideoLayer.setAttribute('aria-hidden', 'false');

        const v = this.bossClearVideo;
        v.muted = false;
        v.pause();
        v.removeAttribute('src');
        while (v.firstChild) v.removeChild(v.firstChild);
        const source = document.createElement('source');
        source.src = src;
        source.type = 'video/mp4';
        v.appendChild(source);
        v.load();

        const onEnded = () => this._finishBossClearVideo();
        v.addEventListener('ended', onEnded, { once: true });
        v.addEventListener('error', onEnded, { once: true });

        this._bossVideoKeydown = e => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this._finishBossClearVideo();
            }
        };
        document.addEventListener('keydown', this._bossVideoKeydown);

        const tryPlay = () => {
            const p = v.play();
            if (p && typeof p.catch === 'function') {
                p.catch(() => {
                    v.muted = true;
                    return v.play().catch(() => this._finishBossClearVideo());
                });
            }
        };
        if (v.readyState >= 2) tryPlay();
        else v.addEventListener('canplay', tryPlay, { once: true });
    }

    _finishBossClearVideo() {
        const cb = this._bossClearVideoComplete;
        if (cb == null) return;
        this._bossClearVideoComplete = null;

        if (this._bossVideoKeydown) {
            document.removeEventListener('keydown', this._bossVideoKeydown);
            this._bossVideoKeydown = null;
        }

        const v = this.bossClearVideo;
        if (v) {
            v.pause();
            v.removeAttribute('src');
            while (v.firstChild) v.removeChild(v.firstChild);
            v.load();
        }
        if (this.bossClearVideoLayer) {
            this.bossClearVideoLayer.style.display = 'none';
            this.bossClearVideoLayer.setAttribute('aria-hidden', 'true');
        }

        cb();
    }

    bindResultActions() {
        if (this.levelPrimaryAction) {
            this.levelPrimaryAction.addEventListener('click', () => {
                this._audio()?.playSfx('uiClick');
                this.hideLevelResult();
                const action = this.levelPrimaryAction.dataset.action;

                if (action === 'next') {
                    if (this.game.goToNextLevel()) {
                        this.initializeGameElements();
                        this.showTemporaryMessage(`进入第 ${this.game.getCurrentLevelConfig().id} 关`, '#c5f3ff');
                    }
                } else if (action === 'retry') {
                    this.game.retryCurrentLevel();
                    this.initializeGameElements();
                }
            });
        }

        if (this.levelSecondaryAction) {
            this.levelSecondaryAction.addEventListener('click', () => {
                this._audio()?.playSfx('uiClick');
                this.hideLevelResult();
                if (this.levelSecondaryAction.dataset.action === 'retry') {
                    this.game.retryCurrentLevel();
                    this.initializeGameElements();
                }
            });
        }
    }

    async runLoadingSequence() {
        if (this.entryKeyHandler) {
            document.removeEventListener('keydown', this.entryKeyHandler);
            this.entryKeyHandler = null;
        }

        this.setLoadingProgress(8, '初始化星穹资源...');
        await this.sleep(260);

        this.setLoadingProgress(35, '生成关卡与卡组...');
        await this.sleep(320);

        this.setLoadingProgress(62, '构建梦幻战场界面...');
        this.initializeGameElements();
        await this.sleep(300);

        this.setLoadingProgress(86, '同步玩家状态...');
        this.game.updateUI();
        await this.sleep(260);

        this.setLoadingProgress(100, '准备完成，请选择关卡...');
        await this.sleep(220);

        this.hideLoadingOverlay();
        if (this.levelSelection) {
            this.levelSelection.style.display = 'flex';
            this.applyLevelSelectionIndex(this._levelSelectListIndex);
        } else {
            this.characterSelection.style.display = 'grid';
            this.applyCharacterSelectionIndex(this._characterSelectListIndex);
        }
    }

    setLoadingProgress(percent, text) {
        if (this.loadingBar) this.loadingBar.style.width = `${percent}%`;
        if (this.loadingStatus) this.loadingStatus.textContent = text;
    }

    hideLoadingOverlay() {
        if (!this.loadingOverlay) return;
        this.loadingOverlay.classList.add('loading-hide');
        window.setTimeout(() => {
            this.loadingOverlay.style.display = 'none';
        }, 460);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    startGame(characterName, characterIndex = 0) {
        this.characterSelection.style.display = 'none';
        this.game.gameState.player1.name = characterName;
        this.game.gameState.player1.heroImage = `images/heroes/player_${characterIndex}.png`;
        this.game.gameState.player1.heroElement = null;
        const fromToggle = this.characterInfiniteManaToggle?.checked === true;
        const fromUrlOrLevel =
            typeof yulingIsInfinitePlayerMana === 'function'
                ? yulingIsInfinitePlayerMana(this.game.gameState.levelConfig)
                : false;
        this.game.gameState.player1.infiniteMana = fromToggle || fromUrlOrLevel;
        this.initializeGameElements();
    }

    initializeGameElements() {
        this.clearAllCardElements();
        if (!this.battlefieldContainer) return;
        this.battlefieldContainer.innerHTML = '<span id="battlefieldLabel" class="battlefield-area__hint">拖拽随从时显示落点</span><div class="deploy-slots" aria-hidden="true"><div class="deploy-slot"></div></div>';
        this.slotsActive = false;
        this.addHeroElements();
        this.refreshUI();
    }

    clearAllCardElements() {
        document.querySelectorAll('.card').forEach(card => card.remove());

        const p1 = this.game.gameState.player1;
        const p2 = this.game.gameState.player2;
        [...p1.hand, ...p1.battlefield, ...p2.hand, ...p2.battlefield].forEach(card => {
            card.element = null;
        });
    }

    computeHeroPlateDimensions() {
        const cw = this.gameContainer.getBoundingClientRect().width;
        const plateW = Math.min(168, Math.max(132, cw * 0.102));
        const plateH = Math.round(plateW * 1.5);
        return { width: plateW, height: plateH };
    }

    applyHeroPlateSize(heroEl, plateWidth, plateHeight) {
        heroEl.style.width = `${plateWidth}px`;
        heroEl.style.height = `${plateHeight}px`;

        const portrait = heroEl.querySelector('.hero-card__portrait');
        const plate = heroEl.querySelector('.hero-card__plate');

        if (portrait) {
            portrait.style.removeProperty('width');
            portrait.style.removeProperty('height');
        }

        if (plate) {
            plate.style.removeProperty('width');
            plate.style.removeProperty('height');
        }
    }

    addHeroElements() {
        const oldP1 = document.getElementById('player1-hero');
        const oldP2 = document.getElementById('player2-hero');
        if (oldP1) oldP1.remove();
        if (oldP2) oldP2.remove();
        this.game.gameState.player1.heroElement = null;
        this.game.gameState.player2.heroElement = null;

        const { width: plateW, height: plateH } = this.computeHeroPlateDimensions();

        const player1Hero = this.game.gameState.player1.createHeroElement();
        player1Hero.id = 'player1-hero';
        player1Hero.style.zIndex = '86';
        this.applyHeroPlateSize(player1Hero, plateW, plateH);
        this.unitsLayer.appendChild(player1Hero);
        const p1Pos = this.getHeroPosition('player', {
            width: player1Hero.offsetWidth,
            height: player1Hero.offsetHeight
        });
        player1Hero.style.left = `${p1Pos.x}px`;
        player1Hero.style.top = `${p1Pos.y}px`;

        const player2Hero = this.game.gameState.player2.createHeroElement();
        player2Hero.id = 'player2-hero';
        player2Hero.style.zIndex = '86';
        this.applyHeroPlateSize(player2Hero, plateW, plateH);
        this.unitsLayer.appendChild(player2Hero);
        const p2Pos = this.getHeroPosition('enemy', {
            width: player2Hero.offsetWidth,
            height: player2Hero.offsetHeight
        });
        player2Hero.style.left = `${p2Pos.x}px`;
        player2Hero.style.top = `${p2Pos.y}px`;

        player2Hero.onclick = () => {
            if (!this.game.isPlayerTurn()) return;
            if (this.game.gameState.phase === 'attack' && this.game.gameState.selectedAttacker) {
                this._audio()?.playSfx('uiClick');
                this.performAttack(this.game.gameState.selectedAttacker, null);
            }
        };
    }

    refreshUI() {
        this.updateHandDisplay();
        this.updateBattlefieldDisplay();
        this.updateOpponentDisplay();
        this.game.gameState.player1.updateHeroDisplay();
        this.game.gameState.player2.updateHeroDisplay();
        this.repositionHeroElements();
        this.game.updateUI();
        this.showPhaseBannerByState();
    }

    repositionHeroElements() {
        const p1 = document.getElementById('player1-hero');
        const p2 = document.getElementById('player2-hero');
        const { width: plateW, height: plateH } = this.computeHeroPlateDimensions();
        if (p1) {
            this.applyHeroPlateSize(p1, plateW, plateH);
            const pos = this.getHeroPosition('player', { width: p1.offsetWidth, height: p1.offsetHeight });
            p1.style.left = `${pos.x}px`;
            p1.style.top = `${pos.y}px`;
        }
        if (p2) {
            this.applyHeroPlateSize(p2, plateW, plateH);
            const pos = this.getHeroPosition('enemy', { width: p2.offsetWidth, height: p2.offsetHeight });
            p2.style.left = `${pos.x}px`;
            p2.style.top = `${pos.y}px`;
        }
    }

    updateHandDisplay() {
        const player = this.game.gameState.player1;

        if (!this.handCardsTrack) return;

        const dragged =
            this.game.isDragging && this.game.draggedCard ? this.game.draggedCard : null;
        const dragEl = dragged?.element ?? null;

        // 移除 #gameContainer 内所有「己方手牌」节点（含 #handArea 内深层），避免仅清 :scope> 漏掉残留层
        if (this.gameContainer) {
            this.gameContainer.querySelectorAll('.card[data-owner="current"]').forEach((el) => {
                if (dragEl && el === dragEl) return;
                el.remove();
            });
        }

        if (this.handCardsTrack) {
            [...this.handCardsTrack.children].forEach((node) => node.remove());
        }

        player.hand.forEach((card) => {
            if (dragged === card) {
                return;
            }
            if (card.element && card.element !== dragEl) {
                card.element.remove();
                card.element = null;
            }
            card.element = card.createElement();
            card.element.dataset.owner = 'current';
            card.element.classList.add('card--hand');
            delete card.element.dataset.area;
            delete card.element.dataset.side;
            this.resetCardLayout(card.element);
            this.promoteHandCardTitleAboveFrame(card.element);

            card.element.onclick = (e) => {
                e.stopPropagation();
                this._audio()?.playSfx('uiClick');
                if (!this.game.isPlayerTurn()) return;
                if (this.game.gameState.phase !== 'play') {
                    if (card.cardType === 'item') {
                        this.showTemporaryMessage('道具仅在出牌阶段点击使用', '#ffd1e6');
                    } else if (card.cardType === 'jin') {
                        this.showTemporaryMessage('锦囊仅在出牌阶段点击使用', '#ffd1e6');
                    } else if (card.cardType === 'fabao') {
                        this.showTemporaryMessage('法宝仅在出牌阶段点击使用', '#ffd1e6');
                    } else {
                        this.showTemporaryMessage('随从请在出牌阶段打出', '#ffd1e6');
                    }
                    return;
                }
                if (!player.hasPlayableMana(card.cost)) {
                    this.showTemporaryMessage('法力值不足!', '#ffd1e6');
                    return;
                }
                this.playCard(card, { showHint: true });
            };

            this.handCardsTrack.appendChild(card.element);
        });

        const handCap = typeof GameState.HAND_SIZE_MAX === 'number' ? GameState.HAND_SIZE_MAX : 5;
        const handHint = document.getElementById('playerHandSizeHint');
        if (handHint) handHint.textContent = `${player.hand.length}/${handCap}`;
    }

    updateBattlefieldDisplay() {
        const battlefieldCards = document.querySelectorAll('.card[data-area="battlefield"]');
        battlefieldCards.forEach(card => card.remove());

        const player = this.game.gameState.player1;
        const ai = this.game.gameState.player2;

        player.battlefield.forEach((minion, index) => {
            minion.element = minion.createElement();
            const pos = this.getBoardPosition('player', index, player.battlefield.length);
            minion.element.style.position = 'absolute';
            minion.element.style.zIndex = '75';
            minion.element.style.left = `${pos.x}px`;
            minion.element.style.top = `${pos.y}px`;
            minion.element.dataset.area = 'battlefield';
            minion.element.dataset.side = 'own';

            minion.element.onclick = (e) => {
                e.stopPropagation();
                this._audio()?.playSfx('uiClick');
                if (!this.game.isPlayerTurn()) return;
                if (this.game.gameState.phase === 'attack' && minion.canAttack) {
                    this.game.gameState.selectedAttacker = minion;
                    this.highlightSelected(minion);
                }
            };

            this.unitsLayer.appendChild(minion.element);
        });

        ai.battlefield.forEach((minion, index) => {
            minion.element = minion.createElement();
            const pos = this.getBoardPosition('enemy', index, ai.battlefield.length);
            minion.element.style.position = 'absolute';
            minion.element.style.zIndex = '75';
            minion.element.style.left = `${pos.x}px`;
            minion.element.style.top = `${pos.y}px`;
            minion.element.dataset.area = 'battlefield';
            minion.element.dataset.side = 'opponent';

            minion.element.onclick = (e) => {
                e.stopPropagation();
                this._audio()?.playSfx('uiClick');
                if (!this.game.isPlayerTurn()) return;
                if (this.game.gameState.selectedAttacker) {
                    this.performAttack(this.game.gameState.selectedAttacker, minion);
                }
            };

            this.unitsLayer.appendChild(minion.element);
        });

        this.addHeroElements();
    }

    updateOpponentDisplay() {
        const handCount = this.game.gameState.player2.hand.length;
        if (this.opponentHandDisplay) {
            this.opponentHandDisplay.textContent = `敌方手牌: ${handCount}张`;
        }
        const badge = document.getElementById('enemyHandCountBadge');
        if (badge) {
            badge.textContent = String(handCount);
        }
        if (this.opponentBattlefieldDisplay) {
            this.opponentBattlefieldDisplay.textContent = `敌方出牌区 · ${this.game.gameState.player2.battlefield.length} 个单位`;
        }
    }

    highlightSelected(card) {
        document.querySelectorAll('.card').forEach(c => {
            c.style.outline = '';
            c.style.outlineOffset = '';
        });

        if (card && card.element) {
            card.element.style.outline = '3px solid #f6dcff';
            card.element.style.outlineOffset = '2px';
        }
    }

    playCard(card, options = {}) {
        const { showHint = true } = options;
        const currentPlayer = this.game.gameState.currentPlayer;

        if (!currentPlayer.hasPlayableMana(card.cost)) {
            if (showHint) this.showTemporaryMessage('法力值不足!', '#ffd1e6');
            return false;
        }

        const handIndex = currentPlayer.hand.indexOf(card);
        if (handIndex === -1) return false;

        if (CardFactory.isSpellLikeCardType(card.cardType)) {
            if (this.game.gameState.phase !== 'play') {
                if (showHint) {
                    const phaseMsg =
                        card.cardType === 'jin'
                            ? '锦囊仅在出牌阶段使用!'
                            : card.cardType === 'fabao'
                                ? '法宝仅在出牌阶段使用!'
                                : '道具仅在出牌阶段使用!';
                    this.showTemporaryMessage(phaseMsg, '#ffd1e6');
                }
                return false;
            }

            currentPlayer.hand.splice(handIndex, 1);
            if (!currentPlayer.infiniteMana) currentPlayer.mana -= card.cost;
            this._audio()?.playSfx('playCard');
            void this.runHandNonMinionRevealSequence(card, options);
            return true;
        }

        const burstPoint = this.getElementCenter(card.element);

        currentPlayer.hand.splice(handIndex, 1);
        if (card.cardType === 'minion') {
            const cap = GameState.BATTLEFIELD_MAX_PER_SIDE;
            while (currentPlayer.battlefield.length >= cap) {
                const gone = currentPlayer.battlefield.shift();
                if (gone) gone.element = null;
            }
        }
        currentPlayer.battlefield.push(card);
        if (!currentPlayer.infiniteMana) currentPlayer.mana -= card.cost;
        card.setCanAttack(false);

        this._audio()?.playSfx('playCard');
        this.refreshUI();
        this.createPlayCardBurst(burstPoint.x, burstPoint.y);
        this.animateCardPlay(card);
        if (currentPlayer === this.game.gameState.player1) {
            this.game.gameState.applyFifteenthTurnPlayerCardBossExecuteIfNeeded(this.game.gameState.player1);
            this.checkBattleResult();
            this.refreshUI();
        }
        return true;
    }

    /**
     * 道具 / 锦囊 / 法宝：战场展示克隆卡 → 结算 → 破碎消失。
     */
    async runHandNonMinionRevealSequence(card, options = {}) {
        void options;
        const wasInputEnabled = this.game.inputEnabled;
        if (this.game.isPlayerTurn()) this.game.inputEnabled = false;

        try {
            const gs = this.game.gameState;
            const current = gs.currentPlayer;
            const isPlayer = current === gs.player1;
            const side = isPlayer ? 'player' : 'enemy';
            const bfLen = isPlayer ? gs.player1.battlefield.length : gs.player2.battlefield.length;

            const ghost = card.createElement();
            ghost.classList.add('card--reveal-play-ghost');
            ghost.removeAttribute('data-owner');
            delete ghost.dataset.owner;

            const pos = this.getBoardPosition(side, 0, Math.max(1, bfLen));
            ghost.style.position = 'absolute';
            ghost.style.left = `${pos.x}px`;
            ghost.style.top = `${pos.y}px`;
            ghost.style.zIndex = '82';

            card.element = null;
            this.refreshUI();
            this.unitsLayer.appendChild(ghost);

            await this.sleep(720);

            const heroDmg = isPlayer ? this.getItemEffectHeroDamage(card) : 0;
            const heroEl = this.getOpponentHeroElement(gs);
            const useBeam = heroDmg > 0 && heroEl && ghost.isConnected;

            if (useBeam) {
                const fromPt = this.getElementCenter(ghost);
                const toPt = this.getElementCenter(heroEl);
                await this.playSpellHeroBeam(fromPt.x, fromPt.y, toPt.x, toPt.y);
                this.resolveItemCard(card, { suppressHeroDamage: true });
                this.applyDeferredSpellHeroDamage(gs, heroDmg);
            } else {
                this.resolveItemCard(card);
            }

            this.refreshUI();
            gs.player1.updateHeroDisplay();
            gs.player2.updateHeroDisplay();

            ghost.classList.add('card--reveal-shatter');
            await this.sleep(520);

            let burstAt = { x: pos.x + ghost.offsetWidth / 2, y: pos.y + ghost.offsetHeight / 2 };
            if (ghost.isConnected) {
                burstAt = this.getElementCenter(ghost);
            }
            ghost.remove();
            this.createPlayCardBurst(burstAt.x, burstAt.y);
            if (isPlayer) {
                gs.applyFifteenthTurnPlayerCardBossExecuteIfNeeded(gs.player1);
            }
            this.checkBattleResult();
            this.refreshUI();
        } finally {
            if (this.game.isPlayerTurn()) this.game.inputEnabled = wasInputEnabled;
        }
    }

    /** 非随从牌效果中对「敌方英雄」造成的伤害量（用于直伤红线演出）。 */
    getItemEffectHeroDamage(card) {
        const e = card && card.itemEffect;
        if (!e || !e.kind) return 0;
        if (e.kind === 'damageHero') return Math.max(0, e.value || 0);
        if (e.kind === 'damageHeroAndDraw') {
            return Math.max(0, e.damage != null ? e.damage : e.value || 0);
        }
        return 0;
    }

    getOpponentHeroElement(gs) {
        const opp = gs && gs.opponent;
        if (!opp) return null;
        const id = opp === gs.player1 ? 'player1-hero' : 'player2-hero';
        return document.getElementById(id);
    }

    /** 红色能量线：约 0.35s 后移除（与随从攻击的 sword-slash 分离）。 */
    playSpellHeroBeam(fromX, fromY, toX, toY) {
        return new Promise(resolve => {
            if (!this.gameContainer) {
                resolve();
                return;
            }
            const beam = document.createElement('div');
            beam.className = 'spell-hero-beam';
            const dx = toX - fromX;
            const dy = toY - fromY;
            const length = Math.max(40, Math.hypot(dx, dy));
            const angle = Math.atan2(dy, dx);
            beam.style.left = `${fromX}px`;
            beam.style.top = `${fromY}px`;
            beam.style.width = `${length}px`;
            beam.style.transform = `rotate(${angle}rad)`;
            this.gameContainer.appendChild(beam);
            this._audio()?.playSfx('spellBeam');
            window.setTimeout(() => {
                beam.remove();
                resolve();
            }, 350);
        });
    }

    showHeroSpellDamageFloater(amount, x, y) {
        if (!this.gameContainer || !amount) return;
        const el = document.createElement('div');
        el.className = 'hero-spell-damage-float';
        el.textContent = `-${amount}`;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        this.gameContainer.appendChild(el);
        window.setTimeout(() => el.remove(), 950);
    }

    /** 红线结束后再扣血、受击高亮、爆点与飘字（仅直伤部分）。 */
    applyDeferredSpellHeroDamage(gs, amount) {
        if (!gs || !amount) return;
        const opp = gs.opponent;
        const prev = opp.health;
        opp.health = Math.max(0, prev - amount);
        if (opp.health >= prev) return;
        this.flashHeroDamageHighlight(opp);
        const heroEl = this.getOpponentHeroElement(gs);
        if (heroEl) {
            const c = this.getElementCenter(heroEl);
            this._audio()?.playSfx('spellHeroHit');
            this.createHitBurst(c.x, c.y, { skipHitSfx: true });
            this.showHeroSpellDamageFloater(amount, c.x, c.y - 24);
        }
    }

    resolveItemCard(card, opts = {}) {
        const suppressHero = opts.suppressHeroDamage === true;
        const gs = this.game.gameState;
        const player = gs.currentPlayer;
        const opponent = gs.opponent;
        const e = card.itemEffect;
        if (!e || !e.kind) return;

        if (e.kind === 'damageHero') {
            if (!suppressHero) {
                const prev = opponent.health;
                opponent.health -= e.value || 0;
                if (opponent.health < 0) opponent.health = 0;
                if (opponent.health < prev) this.flashHeroDamageHighlight(opponent);
            }
        } else if (e.kind === 'healSelf') {
            const cap = typeof player.maxHeroHealth === 'number' ? player.maxHeroHealth : 30;
            player.health = Math.min(cap, player.health + (e.value || 0));
        } else if (e.kind === 'healSelfAndDraw') {
            const healVal = e.heal != null ? e.heal : e.value || 0;
            const cap = typeof player.maxHeroHealth === 'number' ? player.maxHeroHealth : 30;
            player.health = Math.min(cap, player.health + healVal);
            const nDraw = Math.max(1, e.draw != null ? e.draw : 1);
            if (gs.phase === 'play' && card.cardType === 'jin') return;
            const handMax = typeof GameState.HAND_SIZE_MAX === 'number' ? GameState.HAND_SIZE_MAX : 5;
            for (let i = 0; i < nDraw; i++) {
                if (player.hand.length >= handMax) break;
                if (player.deck.length === 0) break;
                player.hand.push(player.deck.pop());
                this._audio()?.playSfx('draw');
            }
        } else if (e.kind === 'gainMana') {
            if (!player.infiniteMana) {
                const add = Math.max(0, e.value || 0);
                const cap = typeof player.maxMana === 'number' ? player.maxMana : 10;
                player.mana = Math.min(cap, player.mana + add);
            }
        } else if (e.kind === 'damageHeroAndDraw') {
            const dmg = e.damage != null ? e.damage : e.value || 0;
            if (!suppressHero) {
                const prev = opponent.health;
                opponent.health -= dmg;
                if (opponent.health < 0) opponent.health = 0;
                if (opponent.health < prev) this.flashHeroDamageHighlight(opponent);
            }
            const nDraw = Math.max(1, e.draw != null ? e.draw : 1);
            if (gs.phase === 'play' && card.cardType === 'jin') return;
            const handMax = typeof GameState.HAND_SIZE_MAX === 'number' ? GameState.HAND_SIZE_MAX : 5;
            for (let i = 0; i < nDraw; i++) {
                if (player.hand.length >= handMax) break;
                if (player.deck.length === 0) break;
                player.hand.push(player.deck.pop());
                this._audio()?.playSfx('draw');
            }
        } else if (e.kind === 'draw') {
            // 出牌阶段：锦囊的抽牌不生效；道具仍可摸牌至手牌上限。
            if (gs.phase === 'play' && card.cardType === 'jin') return;
            const n = Math.max(1, e.value || 1);
            const handMax = typeof GameState.HAND_SIZE_MAX === 'number' ? GameState.HAND_SIZE_MAX : 5;
            for (let i = 0; i < n; i++) {
                if (player.hand.length >= handMax) break;
                if (player.deck.length === 0) break;
                player.hand.push(player.deck.pop());
                this._audio()?.playSfx('draw');
            }
        }
    }

    animateCardPlay(card) {
        if (!card.element) return;

        card.element.style.transition = 'transform 0.3s ease';
        card.element.style.transform = 'scale(1.08)';
        setTimeout(() => {
            card.element.style.transform = 'scale(1)';
        }, 300);
    }

    performAttack(attacker, target) {
        if (!attacker || !attacker.canAttack) return false;
        if (attacker.cardType && attacker.cardType !== 'minion') return false;

        this._audio()?.playSfx('attack');

        if (target) {
            target.health -= attacker.attack;
            attacker.health -= target.attack;

            if (target.health <= 0) {
                const battlefield = this.game.gameState.opponent.battlefield;
                const index = battlefield.indexOf(target);
                if (index !== -1) {
                    battlefield.splice(index, 1);
                    if (target.element) target.element.remove();
                }
            }

            if (attacker.health <= 0) {
                const battlefield = this.game.gameState.currentPlayer.battlefield;
                const index = battlefield.indexOf(attacker);
                if (index !== -1) {
                    battlefield.splice(index, 1);
                    if (attacker.element) attacker.element.remove();
                }
            }
        } else {
            const opp = this.game.gameState.opponent;
            const prev = opp.health;
            opp.health -= attacker.attack;
            if (opp.health < prev) this.flashHeroDamageHighlight(opp);
        }

        attacker.setCanAttack(false);
        if (target && target.element) target.updateStats();
        attacker.updateStats();

        this.animateAttack(attacker, target);
        this.game.gameState.selectedAttacker = null;
        this.refreshUI();
        this.checkBattleResult();
        return true;
    }

    animateAttack(attacker, target) {
        if (!attacker.element) return;

        const containerRect = this.gameContainer.getBoundingClientRect();
        const attackerCenter = this.getElementCenter(attacker.element);
        let targetCenter = null;

        attacker.element.style.transition = 'left 0.3s ease, top 0.3s ease, transform 0.3s ease';
        const originalLeft = attacker.element.style.left;
        const originalTop = attacker.element.style.top;

        if (target && target.element) {
            const targetRect = target.element.getBoundingClientRect();
            targetCenter = {
                x: targetRect.left - containerRect.left + targetRect.width / 2,
                y: targetRect.top - containerRect.top + targetRect.height / 2
            };
            attacker.element.style.left = `${targetCenter.x - 50}px`;
            attacker.element.style.top = `${targetCenter.y - 70}px`;
        } else {
            const enemyHero = document.getElementById('player2-hero');
            targetCenter = enemyHero ? this.getElementCenter(enemyHero) : {
                x: Math.min(containerRect.width - 60, attackerCenter.x + 180),
                y: Math.max(80, attackerCenter.y - 100)
            };
            attacker.element.style.transform = 'translateX(50px) scale(1.16)';
        }

        if (targetCenter) {
            this.createSwordSlash(attackerCenter.x, attackerCenter.y, targetCenter.x, targetCenter.y);
            this.createHitBurst(targetCenter.x, targetCenter.y);
        }

        setTimeout(() => {
            attacker.element.style.left = originalLeft;
            attacker.element.style.top = originalTop;
            attacker.element.style.transform = 'scale(1)';
        }, 300);
    }

    afterTurnSwitched() {
        this.refreshUI();
        this.maybeRunAITurn();
    }

    maybeRunAITurn() {
        if (this.game.gameState.gameOver) return;
        if (this.game.gameState.currentPlayer !== this.game.gameState.player2) return;

        this.game.inputEnabled = false;
        this.runAITurn();
    }

    runAITurn() {
        const aiPlayer = this.game.gameState.player2;
        const aiTradeBias = this.game.gameState.levelConfig?.aiTradeBias || 1;

        this.game.gameState.phase = 'play';
        this.game.updateUI();

        const aiCardScore = (card) => {
            if (CardFactory.isSpellLikeCardType(card.cardType)) {
                const eff = card.itemEffect;
                if (!eff) return 4;
                if (eff.kind === 'damageHero') return 8 + (eff.value || 0) * 1.8;
                if (eff.kind === 'damageHeroAndDraw') {
                    const d = eff.damage != null ? eff.damage : eff.value || 0;
                    const dr = eff.draw != null ? eff.draw : 1;
                    return 9 + d * 1.6 + dr * 1.4;
                }
                if (eff.kind === 'healSelf') {
                    const low = aiPlayer.health <= (aiPlayer.maxHeroHealth || 30) * 0.42;
                    return (low ? 10 : 3) + (eff.value || 0) * 0.35;
                }
                if (eff.kind === 'healSelfAndDraw') {
                    const h = eff.heal != null ? eff.heal : eff.value || 0;
                    const dr = eff.draw != null ? eff.draw : 1;
                    const low = aiPlayer.health <= (aiPlayer.maxHeroHealth || 30) * 0.42;
                    return (low ? 9 : 4) + h * 0.35 + dr * 1.4;
                }
                if (eff.kind === 'gainMana') {
                    const room = Math.max(0, (aiPlayer.maxMana || 0) - (aiPlayer.mana || 0));
                    const v = eff.value || 0;
                    const useful = Math.min(room, v);
                    return 5.5 + useful * 1.35 + (v - useful) * 0.15;
                }
                if (eff.kind === 'draw') return 6.5 + (eff.value || 1) * 1.5;
                return 4;
            }
            return card.attack + card.health + card.cost * 0.45;
        };

        const selectBestPlayableCard = () => {
            const playable = aiPlayer.hand.filter((c) => {
                if (c.cost > aiPlayer.mana) return false;
                return true;
            });
            if (!playable.length) return null;

            return playable.sort((a, b) => aiCardScore(b) - aiCardScore(a))[0];
        };

        const playNextCard = () => {
            if (this.game.gameState.gameOver) return;

            const card = selectBestPlayableCard();
            if (!card) {
                this.game.gameState.phase = 'attack';
                this.game.updateUI();
                setTimeout(runAttackPhase, 420);
                return;
            }

            const played = this.playCard(card, { showHint: false });
            const delay = played && CardFactory.isSpellLikeCardType(card.cardType) ? 1280 : 460;
            if (played) {
                setTimeout(playNextCard, delay);
            } else {
                setTimeout(() => {
                    this.game.gameState.phase = 'attack';
                    this.game.updateUI();
                    runAttackPhase();
                }, 420);
            }
        };

        const runAttackPhase = () => {
            const attackers = [...aiPlayer.battlefield].filter(card => card.canAttack && card.health > 0);
            let attackCursor = 0;

            const performNextAttack = () => {
                if (this.game.gameState.gameOver) return;

                if (attackCursor >= attackers.length) {
                    setTimeout(() => {
                        this.game.gameState.endTurn();
                        this.game.inputEnabled = true;
                        this.refreshUI();
                    }, 380);
                    return;
                }

                const attacker = attackers[attackCursor];
                attackCursor += 1;

                if (!attacker || !attacker.canAttack || attacker.health <= 0) {
                    setTimeout(performNextAttack, 300);
                    return;
                }

                const target = this.chooseBestAITarget(attacker, aiTradeBias);
                this.performAttack(attacker, target);
                setTimeout(performNextAttack, 430);
            };

            performNextAttack();
        };

        this.aiActionTimer = setTimeout(playNextCard, 520);
    }

    chooseBestAITarget(attacker, tradeBias = 1) {
        const enemyMinions = this.game.gameState.opponent.battlefield;
        if (!enemyMinions.length) return null;

        let bestTarget = null;
        let bestScore = Number.NEGATIVE_INFINITY;

        enemyMinions.forEach(target => {
            const canKillTarget = attacker.attack >= target.health;
            const survives = attacker.health > target.attack;

            let score = (target.attack * 1.4 + target.health) - (target.cost * 0.2);
            if (canKillTarget) score += 5 * tradeBias;
            if (survives) score += 4 * tradeBias;
            if (!survives) score -= 2.4;
            if (!canKillTarget) score -= 1.4;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        });

        if (bestScore < 4.2 && this.game.gameState.opponent.health > attacker.attack) return null;
        return bestTarget;
    }

    checkBattleResult() {
        if (!this.game.gameState.checkGameOver()) return;

        const playerWon = this.game.gameState.winner === this.game.gameState.player1;
        const level = this.game.getCurrentLevelConfig();

        if (playerWon) {
            this._audio()?.playSfx('victory');
            if (this.game.hasNextLevel()) {
                this.showLevelResult(
                    `第${level.id}关胜利`,
                    `你已击败 ${level.name}，可进入下一关。`,
                    { label: '进入下一关', action: 'next' },
                    { label: '重试本关', action: 'retry' }
                );
            } else {
                const totalLevels = this.game.levelConfigs.length;
                const showFinalPanel = () => {
                    this.showLevelResult(
                        '最终胜利',
                        `你已通关全部 ${totalLevels} 关，星穹战役圆满结束。`,
                        { label: `重玩「${level.name}」`, action: 'retry' },
                        null
                    );
                };
                const clip = level && level.bossClearVideo;
                if (clip) {
                    this.playBossClearVideo(clip, showFinalPanel);
                } else {
                    showFinalPanel();
                }
            }
        } else {
            this._audio()?.playSfx('defeat');
            this.showLevelResult(
                `第${level.id}关失败`,
                '敌方压制了你的战线，请调整策略后重试。',
                { label: '重试本关', action: 'retry' },
                null
            );
        }

        this.game.inputEnabled = false;
    }

    showLevelResult(title, detail, primary, secondary) {
        if (!this.levelResultModal) return;

        this.levelResultTitle.textContent = title;
        this.levelResultDetail.textContent = detail;

        if (primary) {
            this.levelPrimaryAction.style.display = 'inline-flex';
            this.levelPrimaryAction.textContent = primary.label;
            this.levelPrimaryAction.dataset.action = primary.action;
        } else {
            this.levelPrimaryAction.style.display = 'none';
            this.levelPrimaryAction.dataset.action = '';
        }

        if (secondary) {
            this.levelSecondaryAction.style.display = 'inline-flex';
            this.levelSecondaryAction.textContent = secondary.label;
            this.levelSecondaryAction.dataset.action = secondary.action;
        } else {
            this.levelSecondaryAction.style.display = 'none';
            this.levelSecondaryAction.dataset.action = '';
        }

        this.levelResultModal.style.display = 'flex';
    }

    hideLevelResult() {
        if (!this.levelResultModal) return;

        this.levelResultModal.style.display = 'none';
        this.game.inputEnabled = true;
        this.game.gameState.gameOver = false;
        this.game.gameState.winner = null;

        if (this.aiActionTimer) {
            clearTimeout(this.aiActionTimer);
            this.aiActionTimer = null;
        }
    }

    showTemporaryMessage(message, color = '#f7ecff') {
        let messageEl = document.getElementById('temporary-game-message');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'temporary-game-message';
            messageEl.style.position = 'fixed';
            messageEl.style.top = '50%';
            messageEl.style.left = '50%';
            messageEl.style.transform = 'translate(-50%, -50%)';
            messageEl.style.background = 'rgba(17, 20, 42, 0.85)';
            messageEl.style.padding = '12px 22px';
            messageEl.style.borderRadius = '8px';
            messageEl.style.border = '1px solid rgba(197, 223, 255, 0.62)';
            messageEl.style.zIndex = '3000';
            messageEl.style.fontWeight = 'bold';
            messageEl.style.fontSize = '18px';
            document.body.appendChild(messageEl);
        }

        messageEl.textContent = message;
        messageEl.style.color = color;
        messageEl.style.display = 'block';

        if (this.messageTimer) clearTimeout(this.messageTimer);
        this.messageTimer = setTimeout(() => {
            messageEl.style.display = 'none';
            this.messageTimer = null;
        }, 1200);
    }
}

Game.prototype.initializeUI = function() {
    this.uiManager = new UIManager(this);
};

document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
    window.game.initializeUI();
    window.game.uiManager.setupEntryScreen();
});
