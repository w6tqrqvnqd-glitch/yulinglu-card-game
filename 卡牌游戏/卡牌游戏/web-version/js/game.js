// game.js - 网页版卡牌游戏渲染与输入调度

/** 手牌随从：按下后移动超过该距离（平方）才视为拖拽，减轻误触、利于「点打出」 */
const HAND_DRAG_THRESHOLD_SQ = 49;

class Game {
    constructor() {
        this.levelConfigs = [
            {
                id: 1,
                name: '星尘试炼',
                target: '击败星尘守卫',
                enemyHealth: 30,
                enemyStartingMana: 0,
                enemyDeckLevel: 1,
                playerDeckLevel: 1,
                aiTradeBias: 1
            },
            {
                id: 2,
                name: '幻月精英战',
                target: '击败幻月混沌',
                battleBackground: 'images/level2-main-bg.png',
                enemyName: '幻月混沌',
                enemyAccent: '#7c5cdc',
                enemyHealth: 34,
                enemyStartingMana: 1,
                enemyDeckLevel: 2,
                playerDeckLevel: 1,
                aiTradeBias: 1.25
            },
            {
                id: 3,
                name: '永夜Boss战',
                target: '击败永夜主宰',
                battleBackground: 'images/level3-main-bg.png',
                enemyHealth: 40,
                enemyStartingMana: 2,
                enemyDeckLevel: 3,
                playerDeckLevel: 2,
                aiTradeBias: 1.45
            },
            {
                id: 4,
                name: '最终决战',
                target: '击败云月鹿君',
                battleBackground: 'images/level4-main-bg.png',
                enemyHealth: 46,
                enemyStartingMana: 3,
                enemyDeckLevel: 4,
                playerDeckLevel: 3,
                aiTradeBias: 1.58,
                /** 通关全关最后一关后播放 */
                bossClearVideo: 'videos/boss-clear.mp4'
            }
        ];

        this.currentLevelIndex = 0;
        this.gameState = new GameState();
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDragging = false;
        this.draggedCard = null;
        /** @type {{ card: any, startClientX: number, startClientY: number } | null} */
        this.pendingHandDrag = null;
        this._dragRaf = null;
        /** @type {{ clientX: number, clientY: number } | null} */
        this._dragPendingCoords = null;
        this.inputEnabled = true;

        this.canvas.width = 1200;
        this.canvas.height = 800;

        this.turnInfoEl = document.getElementById('turnInfo');
        this.phaseInfoEl = document.getElementById('phaseInfo');
        this.playerInfoEl = document.getElementById('playerInfo');
        this.levelInfoEl = document.getElementById('levelInfo');
        this.levelTargetEl = document.getElementById('levelTarget');
        this.instructionTextEl = document.getElementById('instructionText');
        this.playerManaDisplayEl = document.getElementById('playerManaDisplay');
        this.gameContainerEl = document.getElementById('gameContainer');

        this.initializeEventListeners();
        this.initializeLevel(this.currentLevelIndex);
        this.updateUI();
        this.render();
    }

    advancePhaseOrEndTurnFromPlayer() {
        if (!this.inputEnabled) return;
        if (this.uiManager?.isUiBlockingBattleShortcuts?.()) return;
        if (this.gameState.currentPlayer !== this.gameState.player1) return;

        if (this.gameState.phase === 'play') {
            this.gameState.phase = 'attack';
        } else if (this.gameState.phase === 'attack') {
            this.gameState.endTurn();
            if (this.uiManager) {
                this.uiManager.afterTurnSwitched();
            }
        }
        this.updateUI();
    }

    initializeLevel(levelIndex) {
        const retainedName = this.gameState?.player1?.name || 'Player1';
        const retainedHeroImage = this.gameState?.player1?.heroImage ?? null;
        this.currentLevelIndex = Math.max(0, Math.min(this.levelConfigs.length - 1, levelIndex));
        const levelConfig = this.levelConfigs[this.currentLevelIndex];
        this.gameState.initializeGame(levelConfig);
        this.gameState.player1.name = retainedName;
        if (retainedHeroImage) {
            this.gameState.player1.heroImage = retainedHeroImage;
        }
        this.applyBattleBackground();
    }

    applyBattleBackground() {
        if (!this.gameContainerEl) return;
        const path = this.getCurrentLevelConfig().battleBackground || 'images/main-bg.png';
        this.gameContainerEl.style.setProperty('--battle-bg-image', `url('${path}')`);
    }

    getCurrentLevelConfig() {
        return this.levelConfigs[this.currentLevelIndex];
    }

    hasNextLevel() {
        return this.currentLevelIndex < this.levelConfigs.length - 1;
    }

    goToNextLevel() {
        if (!this.hasNextLevel()) return false;
        this.initializeLevel(this.currentLevelIndex + 1);
        return true;
    }

    retryCurrentLevel() {
        this.initializeLevel(this.currentLevelIndex);
    }

    initializeEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.inputEnabled) return;
            if (this.uiManager?.isUiBlockingBattleShortcuts?.()) return;

            if (e.code === 'Space' && this.gameState.currentPlayer === this.gameState.player1) {
                e.preventDefault();
                this.advancePhaseOrEndTurnFromPlayer();
            }
        });

        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    isPlayerTurn() {
        return this.gameState.currentPlayer === this.gameState.player1;
    }

    handleMouseDown(e) {
        if (!this.inputEnabled) return;
        if (e.button !== 0) return;
        const t = e.target;
        if (t && typeof t.closest === 'function') {
            if (t.closest('button, a, input, select, textarea, [role="dialog"]')) return;
        }
        if (this.uiManager?.isUiBlockingBattleShortcuts?.()) return;
        if (!this.isPlayerTurn()) return;
        this.handleDragStart(e.clientX, e.clientY);
    }

    handleMouseMove(e) {
        if (this.pendingHandDrag && !this.isDragging) {
            const dx = e.clientX - this.pendingHandDrag.startClientX;
            const dy = e.clientY - this.pendingHandDrag.startClientY;
            if (dx * dx + dy * dy >= HAND_DRAG_THRESHOLD_SQ) {
                this.beginCardDrag(
                    this.pendingHandDrag.card,
                    e.clientX,
                    e.clientY
                );
                this.pendingHandDrag = null;
            }
        }
        if (this.isDragging) {
            this.handleDrag(e.clientX, e.clientY);
        }
    }

    handleMouseUp(e) {
        this.handleDragEnd(e.clientX, e.clientY);
    }

    handleTouchStart(e) {
        if (!this.inputEnabled || !this.isPlayerTurn()) return;
        if (this.uiManager?.isUiBlockingBattleShortcuts?.()) return;
        const touch = e.touches[0];
        // 全局 preventDefault 会吞掉 click：手牌里锦囊/道具只靠点击打出，触摸时必须放行。
        if (this.isNonMinionHandCardAtClient(touch.clientX, touch.clientY)) {
            return;
        }
        e.preventDefault();
        this.handleDragStart(touch.clientX, touch.clientY);
    }

    /** 触摸点是否落在己方手牌中的锦囊/道具上（此类牌仅支持点击使用，不能拖拽）。 */
    isNonMinionHandCardAtClient(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const hand = this.gameState.currentPlayer?.hand;
        if (!hand) return false;
        for (const card of hand) {
            if (card.cardType !== 'item' && card.cardType !== 'jin' && card.cardType !== 'fabao') continue;
            if (card.element && this.isPointInElement(card.element, x, y)) return true;
        }
        return false;
    }

    handleTouchMove(e) {
        if (this.pendingHandDrag && !this.isDragging && e.touches[0]) {
            const touch = e.touches[0];
            const dx = touch.clientX - this.pendingHandDrag.startClientX;
            const dy = touch.clientY - this.pendingHandDrag.startClientY;
            if (dx * dx + dy * dy >= HAND_DRAG_THRESHOLD_SQ) {
                e.preventDefault();
                this.beginCardDrag(
                    this.pendingHandDrag.card,
                    touch.clientX,
                    touch.clientY
                );
                this.pendingHandDrag = null;
            }
        }
        if (this.isDragging) {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) this.handleDrag(touch.clientX, touch.clientY);
        }
    }

    handleTouchEnd(e) {
        if (e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            this.handleDragEnd(touch.clientX, touch.clientY);
        }
    }

    handleDragStart(clientX, clientY) {
        this.pendingHandDrag = null;

        const rect = this.canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        for (let i = 0; i < this.gameState.currentPlayer.hand.length; i++) {
            const card = this.gameState.currentPlayer.hand[i];
            if (card.cardType === 'item' || card.cardType === 'jin' || card.cardType === 'fabao') {
                continue;
            }
            if (card.element && this.isPointInElement(card.element, x, y)) {
                if (this.gameState.phase === 'play' && this.gameState.currentPlayer.hasPlayableMana(card.cost)) {
                    this.pendingHandDrag = {
                        card,
                        startClientX: clientX,
                        startClientY: clientY
                    };
                    break;
                }
            }
        }

        for (let i = 0; i < this.gameState.currentPlayer.battlefield.length; i++) {
            const minion = this.gameState.currentPlayer.battlefield[i];
            if (this.gameState.phase === 'attack' && minion.canAttack && this.isPointInElement(minion.element, x, y)) {
                this.gameState.selectedAttacker = minion;
                if (this.uiManager) this.uiManager.highlightSelected(minion);
                break;
            }
        }
    }

    beginCardDrag(card, clientX, clientY) {
        if (!card?.element || this.isDragging) return;
        const gc = this.gameContainerEl;
        if (!gc) return;

        const cardRect = card.element.getBoundingClientRect();
        const cr = gc.getBoundingClientRect();
        card.dragOffsetX = clientX - cardRect.left;
        card.dragOffsetY = clientY - cardRect.top;

        this.isDragging = true;
        this.draggedCard = card;
        card.isDragging = true;
        card.element.classList.add('dragging');

        const x0 = cardRect.left - cr.left;
        const y0 = cardRect.top - cr.top;
        card.element.style.position = 'absolute';
        card.element.style.left = '0';
        card.element.style.top = '0';
        card.element.style.setProperty('--drag-x', `${x0}px`);
        card.element.style.setProperty('--drag-y', `${y0}px`);
        card.element.style.zIndex = '220';
        card.element.style.willChange = 'transform';

        gc.classList.add('is-hand-dragging');
        gc.appendChild(card.element);
    }

    cancelDragFrame() {
        if (this._dragRaf != null) {
            cancelAnimationFrame(this._dragRaf);
            this._dragRaf = null;
        }
        this._dragPendingCoords = null;
    }

    handleDrag(clientX, clientY) {
        if (!this.draggedCard?.element) return;
        this._dragPendingCoords = { clientX, clientY };
        if (this._dragRaf != null) return;
        this._dragRaf = requestAnimationFrame(() => {
            this._dragRaf = null;
            const p = this._dragPendingCoords;
            this._dragPendingCoords = null;
            if (!p || !this.draggedCard?.element) return;
            const gc = this.gameContainerEl;
            if (!gc) return;
            const cr = gc.getBoundingClientRect();
            const x = p.clientX - cr.left - this.draggedCard.dragOffsetX;
            const y = p.clientY - cr.top - this.draggedCard.dragOffsetY;
            this.draggedCard.element.style.setProperty('--drag-x', `${x}px`);
            this.draggedCard.element.style.setProperty('--drag-y', `${y}px`);
        });
    }

    handleDragEnd(clientX, clientY) {
        if (this.pendingHandDrag && !this.isDragging) {
            this.pendingHandDrag = null;
        }

        if (this.draggedCard?.element && this.gameContainerEl) {
            const cr = this.gameContainerEl.getBoundingClientRect();
            const x = clientX - cr.left - this.draggedCard.dragOffsetX;
            const y = clientY - cr.top - this.draggedCard.dragOffsetY;
            this.draggedCard.element.style.setProperty('--drag-x', `${x}px`);
            this.draggedCard.element.style.setProperty('--drag-y', `${y}px`);
        }

        this.cancelDragFrame();

        if (!this.draggedCard || !this.isPlayerTurn()) {
            this.isDragging = false;
            this.draggedCard = null;
            return;
        }

        const gc = this.gameContainerEl;
        const rect = gc ? gc.getBoundingClientRect() : this.canvas.getBoundingClientRect();
        const y = clientY - rect.top;

        if (y < rect.height * 0.74 && this.uiManager && this.gameState.phase === 'play') {
            this.uiManager.playCard(this.draggedCard);
        }

        this.resetCardPosition(this.draggedCard);
        this.isDragging = false;
        this.draggedCard = null;
    }

    resetCardPosition(card) {
        card.isDragging = false;
        if (!card.element) return;

        card.element.classList.remove('dragging');
        card.element.style.zIndex = '';
        this.gameContainerEl?.classList.remove('is-hand-dragging');

        const handIndex = this.gameState.currentPlayer.hand.indexOf(card);
        if (handIndex !== -1 && this.uiManager && this.uiManager.handCardsTrack) {
            this.uiManager.resetCardLayout(card.element);
            this.uiManager.handCardsTrack.appendChild(card.element);
            if (typeof this.uiManager.promoteHandCardTitleAboveFrame === 'function') {
                this.uiManager.promoteHandCardTitleAboveFrame(card.element);
            }
        }
    }

    isPointInElement(element, x, y) {
        if (!element) return false;

        const rect = element.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();

        const elemX = rect.left - canvasRect.left;
        const elemY = rect.top - canvasRect.top;

        return x >= elemX && x <= elemX + rect.width && y >= elemY && y <= elemY + rect.height;
    }

    updateUI() {
        const level = this.getCurrentLevelConfig();
        if (this.turnInfoEl) this.turnInfoEl.textContent = `回合: ${this.gameState.turn}`;
        if (this.phaseInfoEl) this.phaseInfoEl.textContent = `阶段: ${this.gameState.phase === 'play' ? '出牌' : '攻击'}`;
        if (this.playerInfoEl) this.playerInfoEl.textContent = `玩家: ${this.gameState.currentPlayer.name}`;
        if (this.levelInfoEl) {
            const total = this.levelConfigs.length;
            this.levelInfoEl.textContent = `关卡 ${level.id}/${total} · ${level.name}`;
        }
        if (this.levelTargetEl) this.levelTargetEl.textContent = `目标: ${level.target}`;

        if (this.playerManaDisplayEl && this.gameState.player1) {
            const p = this.gameState.player1;
            this.playerManaDisplayEl.textContent = p.getManaOrbShortText();
        }

        if (!this.instructionTextEl) return;
        if (this.gameState.currentPlayer !== this.gameState.player1) {
            this.instructionTextEl.textContent = '敌回合';
        } else if (this.gameState.phase === 'play') {
            this.instructionTextEl.textContent = '随从：每方场上仅一只（新上场顶替旧随从）· 拖/点打出 · 锦囊/法宝/道具点击 · 空格切阶段';
        } else {
            this.instructionTextEl.textContent = '选己方随从点敌 · 空格结束';
        }
    }

    drawBackground() {
        // 主背景由 #gameContainer 的 --battle-bg-image 提供；画布保持透明以免盖住战场图。
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawBackground();
        requestAnimationFrame(this.render.bind(this));
    }
}

Game.prototype.initializeUI = function() {
    this.uiManager = new UIManager(this);
};
