/**
 * 《寓灵录》统一音频管理
 * - 不在业务代码里散落 new Audio()
 * - 资源缺失：console.warn，不抛错、不打断游戏
 * - BGM：进入页面即尝试播放（循环）；若浏览器拦截，首次点击后自动重试
 * - 音效 SFX：须在首次用户手势解锁后才播放（与 BGM 策略分离）
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'yulinglu_audio_v1';

    /** 默认资源路径（可将文件放到 web-version/audio/… 下） */
    const DEFAULT_PATHS = {
        uiClick: 'audio/sfx/ui-click.mp3',
        playCard: 'audio/sfx/play-card.mp3',
        draw: 'audio/sfx/draw.mp3',
        attack: 'audio/sfx/attack.mp3',
        hit: 'audio/sfx/hit.mp3',
        spellBeam: 'audio/sfx/spell-beam.mp3',
        spellHeroHit: 'audio/sfx/spell-hero-hit.mp3',
        victory: 'audio/sfx/victory.mp3',
        defeat: 'audio/sfx/defeat.mp3',
        bgm: 'audio/bgm/main-theme.mp3'
    };

    function clamp01(n) {
        const x = Number(n);
        if (Number.isNaN(x)) return 1;
        return Math.max(0, Math.min(1, x));
    }

    class YulingAudioManager {
        constructor() {
            this.paths = { ...DEFAULT_PATHS };
            /** @type {Set<string>} */
            this._warnedMissing = new Set();
            this._unlocked = false;
            this._unlockListeners = [];
            this.masterVolume = 1;
            this.sfxVolume = 1;
            this.bgmVolume = 0.42;
            /** @type {HTMLAudioElement | null} */
            this._bgmEl = null;
            this._bgmUrl = null;
            this._pendingBgmUrl = null;
            this._loadSettings();
            this._bindUserGestureUnlock();
            this._schedulePageLoadBgm();
        }

        /** 进入网址后尽快尝试播放 BGM（不等待点击） */
        _schedulePageLoadBgm() {
            const run = () => {
                try {
                    this.playBgm(this.paths.bgm);
                } catch (e) {
                    console.warn('[寓灵录][Audio] 页面加载 BGM 启动失败:', e);
                }
            };
            if (typeof window === 'undefined') return;
            if (document.readyState === 'complete') {
                window.setTimeout(run, 0);
            } else {
                window.addEventListener('load', () => window.setTimeout(run, 0), { once: true });
            }
        }

        _loadSettings() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return;
                const o = JSON.parse(raw);
                if (typeof o.masterVolume === 'number') this.masterVolume = clamp01(o.masterVolume);
                if (typeof o.sfxVolume === 'number') this.sfxVolume = clamp01(o.sfxVolume);
                if (typeof o.bgmVolume === 'number') this.bgmVolume = clamp01(o.bgmVolume);
            } catch (_) {
                /* ignore */
            }
        }

        saveSettings() {
            try {
                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify({
                        masterVolume: this.masterVolume,
                        sfxVolume: this.sfxVolume,
                        bgmVolume: this.bgmVolume
                    })
                );
            } catch (_) {
                /* ignore */
            }
        }

        /** 总音量 0–1 */
        setMasterVolume(v) {
            this.masterVolume = clamp01(v);
            this._applyBgmVolume();
            this.saveSettings();
        }

        /** 音效相对总音量 0–1 */
        setSfxVolume(v) {
            this.sfxVolume = clamp01(v);
            this.saveSettings();
        }

        /** 背景音乐相对总音量 0–1 */
        setBgmVolume(v) {
            this.bgmVolume = clamp01(v);
            this._applyBgmVolume();
            this.saveSettings();
        }

        getVolumes() {
            return {
                masterVolume: this.masterVolume,
                sfxVolume: this.sfxVolume,
                bgmVolume: this.bgmVolume
            };
        }

        /** 覆盖某类音效 URL（便于换皮或 CDN） */
        setPath(key, url) {
            if (url == null || url === '') return;
            const prev = this.paths[key];
            if (prev) this._warnedMissing.delete(prev);
            this.paths[key] = url;
        }

        _warnMissingOnce(url, label) {
            if (!url || this._warnedMissing.has(url)) return;
            this._warnedMissing.add(url);
            console.warn('[寓灵录][Audio] 音效文件不可用（将静默跳过）:', label || url, url);
        }

        _bindUserGestureUnlock() {
            const onGesture = () => {
                this.unlock();
            };
            const opts = { capture: true, passive: true };
            ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => {
                const fn = (e) => {
                    if (ev === 'keydown' && e && (e.metaKey || e.ctrlKey || e.altKey)) return;
                    onGesture();
                };
                document.addEventListener(ev, fn, opts);
                this._unlockListeners.push([ev, fn, opts]);
            });
        }

        _removeUnlockListeners() {
            while (this._unlockListeners.length) {
                const [ev, fn, opts] = this._unlockListeners.pop();
                document.removeEventListener(ev, fn, opts);
            }
        }

        /** 首次用户交互后调用；之后方可播放 */
        unlock() {
            if (this._unlocked) return;
            this._unlocked = true;
            this._removeUnlockListeners();
            if (this._pendingBgmUrl) {
                const u = this._pendingBgmUrl;
                this._pendingBgmUrl = null;
                this.playBgm(u);
            }
        }

        isUnlocked() {
            return this._unlocked;
        }

        _applyBgmVolume() {
            if (!this._bgmEl) return;
            this._bgmEl.volume = clamp01(this.masterVolume * this.bgmVolume);
        }

        /**
         * 播放一次性音效（可叠加）
         * @param {'uiClick'|'playCard'|'draw'|'attack'|'hit'|'spellBeam'|'spellHeroHit'|'victory'|'defeat'} key
         */
        playSfx(key) {
            if (!this._unlocked) return;
            const url = this.paths[key];
            if (!url) return;

            let audio;
            try {
                audio = new Audio(url);
            } catch (e) {
                console.warn('[寓灵录][Audio] 无法创建 Audio:', key, e);
                return;
            }

            audio.volume = clamp01(this.masterVolume * this.sfxVolume);
            audio.addEventListener(
                'error',
                () => {
                    this._warnMissingOnce(url, key);
                },
                { once: true }
            );
            const p = audio.play();
            if (p && typeof p.catch === 'function') {
                p.catch((err) => {
                    console.warn('[寓灵录][Audio] play() 被拒绝或失败:', key, err);
                });
            }
        }

        /**
         * 开始 / 切换 BGM（与是否已解锁 SFX 无关）
         * @param {string} [url] 不传则用 paths.bgm
         */
        requestBgm(url) {
            this.playBgm(url || this.paths.bgm);
        }

        playBgm(url) {
            if (!url) return;
            if (this._bgmEl && this._bgmUrl === url && !this._bgmEl.paused) return;

            this.stopBgm(false);

            let el;
            try {
                el = new Audio(url);
            } catch (e) {
                console.warn('[寓灵录][Audio] BGM 无法创建:', e);
                return;
            }

            el.loop = true;
            el.volume = clamp01(this.masterVolume * this.bgmVolume);
            el.addEventListener(
                'error',
                () => {
                    this._warnMissingOnce(url, 'bgm');
                    try {
                        el.pause();
                    } catch (_) {
                        /* ignore */
                    }
                    this._bgmEl = null;
                    this._bgmUrl = null;
                },
                { once: true }
            );

            this._bgmEl = el;
            this._bgmUrl = url;
            const p = el.play();
            if (p && typeof p.catch === 'function') {
                p.catch((err) => {
                    console.warn(
                        '[寓灵录][Audio] BGM 自动播放被浏览器拦截，将在首次点击页面后开始:',
                        err && err.name ? err.name : err
                    );
                    try {
                        el.pause();
                        el.removeAttribute('src');
                        el.load();
                    } catch (_) {
                        /* ignore */
                    }
                    this._bgmEl = null;
                    this._bgmUrl = null;
                    this._pendingBgmUrl = url;
                });
            }
        }

        /** @param {boolean} [clearPending=true] */
        stopBgm(clearPending = true) {
            if (clearPending) this._pendingBgmUrl = null;
            if (this._bgmEl) {
                try {
                    this._bgmEl.pause();
                    this._bgmEl.removeAttribute('src');
                    this._bgmEl.load();
                } catch (_) {
                    /* ignore */
                }
            }
            this._bgmEl = null;
            this._bgmUrl = null;
        }
    }

    if (typeof window !== 'undefined') {
        window.YulingAudio = new YulingAudioManager();
    }
})();
