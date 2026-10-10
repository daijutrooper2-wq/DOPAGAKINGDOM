        const firebaseConfig = {
            apiKey: "AIzaSyDcg_dK3F59_A-paZq4tjIW4ie1LNjLucA",
            authDomain: "dopa-b5f00.firebaseapp.com",
            projectId: "dopa-b5f00",
            storageBucket: "dopa-b5f00.firebasestorage.app",
            messagingSenderId: "945171468237",
            appId: "1:945171468237:web:08e2cfe173e65a5693be84",
            measurementId: "G-KT3YCNWLPR"
        };
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'dopa-kingdom-rpg';
        window.fbAppId = appId;
        window.fbUser = null;

        const firebaseReady = (async () => {
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
            const { getAuth, signInAnonymously, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
            const { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, deleteDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

            window.fbApp = initializeApp(firebaseConfig);
            window.fbDb = getFirestore(window.fbApp);
            window.fbAuth = getAuth(window.fbApp);

            window.fbDoc = doc;
            window.fbSetDoc = setDoc;
            window.fbGetDoc = getDoc;
            window.fbUpdateDoc = updateDoc;
            window.fbOnSnapshot = onSnapshot;
            window.fbDeleteDoc = deleteDoc;
            window.fbCollection = collection;

            window._firebaseAuthHelpers = { signInAnonymously, onAuthStateChanged };
        })().catch((err) => {
            console.warn("Firebase SDK load error:", err);
        });

        window.initFirebaseOnline = async function() {
            await firebaseReady;
            if (!window.fbAuth || !window._firebaseAuthHelpers) return false;
            const { signInAnonymously, onAuthStateChanged } = window._firebaseAuthHelpers;
            return new Promise((resolve) => {
                onAuthStateChanged(window.fbAuth, async (user) => {
                    if (user) {
                        window.fbUser = user;
                        resolve(true);
                    } else {
                        try {
                            const userCred = await signInAnonymously(window.fbAuth);
                            window.fbUser = userCred.user;
                            resolve(true);
                        } catch (err) {
                            console.warn("Firebase Auth Error:", err);
                            resolve(false);
                        }
                    }
                });
            });
        };

        class CharacterRenderer {
            // 4. 画像のキャッシュ管理用オブジェクト
            static imageCache = {};

            static getImage(src) {
                if (!src) return null;
                if (!this.imageCache[src]) {
                    const img = new Image();
                    img.isLoaded = false;
                    img.hasError = false;
                    img.onload = () => { 
                        img.isLoaded = true; 
                        if (typeof updateBattleUI === 'function') updateBattleUI();
                        // キャラ選択画面等のCanvasを自動再描画
                        Object.keys(CHARACTER_DATA).forEach(id => {
                            const cvs = document.getElementById(`select-cvs-${id}`);
                            if (cvs) {
                                const c = CHARACTER_DATA[id];
                                let targetPath = c.image;
                                if (targetPath === src) {
                                    CharacterRenderer.drawCharacter(cvs, id);
                                }
                            }
                        });
                    };
                    img.onerror = () => { 
                        img.hasError = true; 
                        console.error("画像読み込みエラー (Image Load Error):", src);
                    };
                    img.src = src;
                    this.imageCache[src] = img;
                }
                return this.imageCache[src];
            }

            static drawCharacter(canvas, charId, isMiniZou = false) {
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                const w = canvas.width;
                const h = canvas.height;

                // 7. 特殊状態（王冠、チャージ、ミニぞう等）に応じた画像パスの判定
                let targetCharId = charId;
                if (isMiniZou) targetCharId = 'minizou';

                const charData = CHARACTER_DATA[targetCharId] || CHARACTER_DATA[charId];
let imagePath = null;
if (charData) {
    // 特殊状態の専用画像（chargedImage）があり、かつチャージ状態の場合のみ優先、それ以外は image を使用
    if (charId.includes('charged') && charData.chargedImage) {
        imagePath = charData.chargedImage;
    } else {
        imagePath = charData.image;
    }
}
                if (charId === 'dopagaking_crown') {
                    imagePath = CHARACTER_DATA['dopagaking']?.chargedImage || CHARACTER_DATA['dopagaking']?.image;
                }

                const img = this.getImage(imagePath);

                // 5. 画像が設定されており、読み込み成功している場合は画像を描画
                if (img && img.isLoaded && !img.hasError) {
                    ctx.clearRect(0, 0, w, h);
                    ctx.imageSmoothingEnabled = false; // 8. ピクセルアートがぼやけない設定

                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(0, 0, w, h);

                    // 影の描画（既存演出を維持）
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.beginPath();
                    ctx.ellipse(w / 2, h - 10, w * 0.38, h * 0.09, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // 8. 縦横比を維持してCanvas内に収める
                    const hRatio = w / img.width;
                    const vRatio = h / img.height;
                    const ratio = Math.min(hRatio, vRatio);
                    const centerShiftX = (w - img.width * ratio) / 2;
                    const centerShiftY = (h - img.height * ratio) / 2;

                    ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);
                    return;
                }

                // 3, 5. 画像未設定・ロード失敗時のフォールバック（従来のドット絵描画）
                ctx.clearRect(0, 0, w, h);
                ctx.imageSmoothingEnabled = false;

                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, w, h);

                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath();
                ctx.ellipse(w / 2, h - 10, w * 0.38, h * 0.09, 0, 0, Math.PI * 2);
                ctx.fill();

                const pixelSize = Math.max(2, Math.floor(w / 32));
                const offsetX = Math.floor((w - 32 * pixelSize) / 2);
                const offsetY = Math.floor((h - 32 * pixelSize) / 2);

                const drawPx = (x, y, color, sizeX = 1, sizeY = 1) => {
                    ctx.fillStyle = color;
                    ctx.fillRect(offsetX + x * pixelSize, offsetY + y * pixelSize, sizeX * pixelSize, sizeY * pixelSize);
                };

                if (isMiniZou) {
                    this.drawMiniZou(drawPx);
                    return;
                }

                switch (charId) {
                    case 'dopagaking': this.drawDopagaking(drawPx, false); break;
                    case 'dopagaking_charged': this.drawDopagaking(drawPx, true); break;
                    case 'dopagaking_crown': this.drawCrown(drawPx); break;
                    case 'courtney': this.drawCourtney(drawPx); break;
                    case 'courtney_charged': this.drawCourtneyCharged(drawPx); break;
                    case 'ndaihyo': this.drawNdaihyo(drawPx); break;
                    case 'pasha': this.drawPasha(drawPx); break;
                    case 'pasha_dark': this.drawPashaDark(drawPx); break;
                    case 'iwaba': this.drawIwaba(drawPx); break;
                    case 'momo': this.drawMomo(drawPx); break;
                    case 'moenan': this.drawMoenan(drawPx); break;
                    case 'asaiomizu': this.drawAsaiomizu(drawPx); break;
                    default: this.drawGeneric(drawPx); break;
                }
            }

            // --- 以下の従来の描画メソッド（drawCrown, drawDopagaking, drawCourtney 等）はそのまま残す ---

static drawCrown(p) {
                if (typeof p !== 'function') return;
                // 王冠アイコンの描画処理（チャージ1～4回目用）
                for (let y = 14; y <= 22; y++) { for (let x = 6; x <= 25; x++) p(x, y, '#f59e0b'); }
                for (let y = 18; y <= 22; y++) { for (let x = 8; x <= 23; x++) p(x, y, '#d97706'); }
                p(6, 8, '#fde047', 3, 6); p(14, 8, '#fde047', 4, 6); p(23, 8, '#fde047', 3, 6);
                p(7, 10, '#ef4444', 1, 2); p(15, 10, '#3b82f6', 2, 2); p(24, 10, '#ef4444', 1, 2);
            }


static drawDopagaking(p, isCharged) {
    if (typeof p !== 'function') return;
    // 頭部・王冠の描画
    for (let y = 6; y <= 11; y++) { for (let x = 10; x <= 21; x++) p(x, y, isCharged ? '#3b82f6' : '#f59e0b'); }
    // 王冠のトゲ
    p(10, 4, '#fde047', 2, 2); p(15, 4, '#fde047', 2, 2); p(20, 4, '#fde047', 2, 2);
    // 顔・ヒゲ・体
    for (let y = 12; y <= 26; y++) { for (let x = 9; x <= 22; x++) p(x, y, '#1e293b'); }
    p(12, 14, '#ffffff', 3, 2); p(17, 14, '#ffffff', 3, 2); // 目
    p(14, 18, '#cbd5e1', 4, 3); // ヒゲ
}




            static drawCourtney(p) {
                if (typeof p !== 'function') return;
                for (let y = 14; y <= 27; y++) { for (let x = 10; x <= 21; x++) p(x, y, '#f472b6'); }
                for (let y = 6; y <= 13; y++) { for (let x = 10; x <= 21; x++) p(x, y, '#fbcfe8'); }
                for (let x = 9; x <= 22; x++) p(x, 5, '#db2777');
                p(12, 9, '#831843', 2, 2); p(17, 9, '#831843', 2, 2);
                p(14, 12, '#e11d48', 4, 1);
            }

            static drawCourtneyCharged(p) {
                if (typeof p !== 'function') return;
                // 専用アイコン：ピンク色の円形が二つ並んでおり、それぞれの円の真ん中に「濃いピンク色の小さい点」
                for (let y = 10; y <= 22; y++) {
                    for (let x = 6; x <= 15; x++) {
                        let dx = x - 10.5; let dy = y - 16;
                        if (dx*dx + dy*dy <= 20) p(x, y, '#f472b6');
                    }
                    for (let x = 16; x <= 25; x++) {
                        let dx = x - 20.5; let dy = y - 16;
                        if (dx*dx + dy*dy <= 20) p(x, y, '#f472b6');
                    }
                }
                p(10, 16, '#831843', 2, 2);
                p(20, 16, '#831843', 2, 2);
            }

            static drawNdaihyo(p) {
                for (let y = 14; y <= 27; y++) { for (let x = 9; x <= 22; x++) p(x, y, '#1e293b'); }
                for (let y = 14; y <= 24; y++) p(15, y, '#ffffff', 2, 1);
                p(15, 16, '#ef4444', 2, 3);
                for (let y = 6; y <= 13; y++) { for (let x = 10; x <= 21; x++) p(x, y, '#fde047'); }
                for (let x = 9; x <= 22; x++) p(x, 5, '#0f172a');
                for (let y = 6; y <= 9; y++) { p(9, y, '#0f172a'); p(22, y, '#0f172a'); }
                p(12, 6, '#0f172a', 3, 2);
                p(11, 8, '#38bdf8', 3, 2); p(17, 8, '#38bdf8', 3, 2); p(14, 8, '#94a3b8', 3, 1);
                for (let i = 0; i < 9; i++) { p(6 - Math.floor(i/3), 21 - i, '#b45309', 2, 2); }
                p(6, 22, '#f87171', 2, 3);
            }

            static drawPasha(p) {
                for (let y = 14; y <= 28; y++) { for (let x = 8; x <= 23; x++) p(x, y, '#2e1065'); }
                for (let x = 8; x <= 23; x++) p(x, 28, '#f59e0b');
                for (let y = 14; y <= 28; y++) p(15, y, '#f59e0b');
                for (let y = 6; y <= 13; y++) { for (let x = 11; x <= 20; x++) p(x, y, '#fde047'); }
                for (let x = 10; x <= 21; x++) p(x, 5, '#1e1b4b');
                for (let y = 6; y <= 11; y++) { p(10, y, '#1e1b4b'); p(21, y, '#1e1b4b'); }
                p(15, 6, '#1e1b4b'); p(15, 7, '#1e1b4b');
                p(13, 9, '#ef4444'); p(18, 9, '#ef4444');
                p(6, 16, '#38bdf8', 3, 5); p(7, 17, '#ffffff', 1, 3);
                p(22, 16, '#94a3b8', 3, 3); p(23, 15, '#c084fc', 2, 2);
            }

            static drawPashaDark(p) {
                for (let y = 14; y <= 28; y++) { for (let x = 8; x <= 23; x++) p(x, y, '#0f0728'); }
                for (let x = 8; x <= 23; x++) p(x, 28, '#7c3aed');
                for (let y = 14; y <= 28; y++) p(15, y, '#7c3aed');
                for (let y = 6; y <= 13; y++) { for (let x = 11; x <= 20; x++) p(x, y, '#fde047'); }
                for (let x = 10; x <= 21; x++) p(x, 5, '#090514');
                for (let y = 6; y <= 11; y++) { p(10, y, '#090514'); p(21, y, '#090514'); }
                p(13, 9, '#dc2626'); p(18, 9, '#dc2626');
                p(6, 16, '#c084fc', 3, 5); p(7, 17, '#ffffff', 1, 3);
                p(22, 16, '#7c3aed', 3, 3); p(23, 15, '#ef4444', 2, 2);
            }

            static drawIwaba(p) {
                for (let y = 14; y <= 27; y++) { for (let x = 9; x <= 22; x++) p(x, y, '#15803d'); }
                for (let y = 15; y <= 26; y++) { p(9, y, '#f97316', 3, 1); p(20, y, '#f97316', 3, 1); }
                for (let y = 6; y <= 13; y++) { for (let x = 10; x <= 21; x++) p(x, y, '#4ade80'); }
                for (let x = 9; x <= 22; x++) p(x, 5, '#94a3b8');
                for (let y = 6; y <= 10; y++) { p(9, y, '#94a3b8'); p(22, y, '#94a3b8'); }
                p(15, 6, '#475569');
                p(12, 8, '#000000', 8, 3); p(13, 9, '#38bdf8', 2, 1); p(17, 9, '#38bdf8', 2, 1);
                p(13, 14, '#facc15', 6, 2); p(6, 17, '#64748b', 3, 4);
            }

            static drawMomo(p) {
                for (let y = 13; y <= 28; y++) { for (let x = 7; x <= 24; x++) p(x, y, '#ec4899'); }
                for (let y = 15; y <= 26; y++) { for (let x = 12; x <= 19; x++) p(x, y, '#be185d'); }
                p(14, 18, '#fef08a', 4, 4);
                for (let y = 5; y <= 12; y++) { for (let x = 10; x <= 21; x++) p(x, y, '#fbcfe8'); }
                for (let x = 9; x <= 22; x++) p(x, 4, '#db2777');
                for (let y = 5; y <= 9; y++) { p(9, y, '#db2777'); p(22, y, '#db2777'); }
                p(15, 5, '#9d174d');
                p(12, 8, '#831843', 2, 2); p(18, 8, '#831843', 2, 2);
                p(5, 14, '#7e22ce', 3, 4); p(6, 13, '#22c55e', 2, 1);
            }

            static drawMiniZou(p) {
                for (let y = 10; y <= 26; y++) { for (let x = 8; x <= 24; x++) p(x, y, '#60a5fa'); }
                for (let y = 8; y <= 18; y++) { p(4, y, '#93c5fd', 4, 1); p(24, y, '#93c5fd', 4, 1); }
                p(12, 12, '#1e3a8a', 2, 3); p(20, 12, '#1e3a8a', 2, 3);
                p(13, 13, '#ffffff', 1, 1); p(21, 13, '#ffffff', 1, 1);
                p(15, 16, '#3b82f6', 3, 7); p(16, 21, '#3b82f6', 4, 3);
                p(20, 20, '#7e22ce', 4, 5); p(21, 19, '#22c55e', 2, 1);
            }

            static drawMoenan(p) {
                for (let y = 14; y <= 27; y++) { for (let x = 10; x <= 21; x++) p(x, y, '#991b1b'); }
                p(13, 16, '#f87171', 6, 2);
                for (let y = 7; y <= 13; y++) { for (let x = 10; x <= 21; x++) p(x, y, '#ffedd5'); }
                p(15, 1, '#ef4444', 2, 6); p(15, 1, '#fde047', 2, 2);
                p(11, 3, '#ef4444', 3, 5); p(8, 5, '#ef4444', 3, 4); p(7, 4, '#fde047', 2, 2);
                p(18, 3, '#ef4444', 3, 5); p(21, 5, '#ef4444', 3, 4); p(22, 4, '#fde047', 2, 2);
                p(12, 9, '#000000', 3, 2); p(17, 9, '#000000', 3, 2); p(13, 9, '#ef4444', 1, 1);
                p(7, 18, '#dc2626', 3, 3); p(22, 18, '#dc2626', 3, 3);
            }

            static drawAsaiomizu(p) {
                for (let y = 3; y <= 9; y++) {
                    for (let x = 8; x <= 23; x++) {
                        if ((x + y) % 2 === 0) p(x, y, '#78350f');
                        else p(x, y, '#451a03');
                    }
                }
                p(7, 4, '#78350f', 2, 2); p(23, 4, '#78350f', 2, 2);
                p(6, 6, '#451a03', 2, 3); p(24, 6, '#451a03', 2, 3);
                for (let y = 9; y <= 15; y++) { for (let x = 10; x <= 21; x++) p(x, y, '#fed7aa'); }
                p(12, 11, '#000000', 2, 2); p(18, 11, '#000000', 2, 1); p(15, 13, '#f43f5e', 2, 1);
                for (let y = 16; y <= 27; y++) { for (let x = 9; x <= 22; x++) p(x, y, '#0284c7'); }
                p(14, 16, '#ffffff', 4, 6);
                p(20, 24, '#ffffff', 5, 5); p(21, 25, '#000000', 3, 3);
            }

            static drawGeneric(p) {
                for (let y = 8; y <= 24; y++) { for (let x = 8; x <= 24; x++) p(x, y, '#6b7280'); }
            }
        }

        class SoundSystem {
            constructor() {
                this.ctx = null;
                this.enabled = true;
                this.bgmEnabled = false;
                this.bgmInterval = null;
                this.bgmStep = 0;
            }

            init() {
                if (!this.ctx) {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    this.ctx = new AudioCtx();
                }
            }

            toggleSound() {
                this.enabled = !this.enabled;
                const statusEl = document.getElementById('sound-status');
                if (statusEl) statusEl.innerText = this.enabled ? 'ON' : 'OFF';
                if (this.enabled) this.playSelect();
            }

            toggleBGM() {
                this.bgmEnabled = !this.bgmEnabled;
                const statusEl = document.getElementById('bgm-status');
                if (statusEl) statusEl.innerText = this.bgmEnabled ? 'ON' : 'OFF';
                if (this.bgmEnabled) this.startBGM(); else this.stopBGM();
            }

            startBGM() {
                this.stopBGM();
                if (!this.bgmEnabled) return;
                this.init();

                const melody = [261.63, 293.66, 329.63, 392.00, 329.63, 392.00, 440.00, 523.25];
                const bass = [130.81, 130.81, 164.81, 164.81, 174.61, 174.61, 196.00, 196.00];

                this.bgmStep = 0;
                this.bgmInterval = setInterval(() => {
                    if (!this.bgmEnabled) return;
                    const note = melody[this.bgmStep % melody.length];
                    const bassNote = bass[Math.floor(this.bgmStep / 2) % bass.length];
                    
                    this.playTone(note, 0.1, 'square', 0.03);
                    this.playTone(bassNote, 0.15, 'triangle', 0.05);
                    this.bgmStep++;
                }, 160);
            }

            stopBGM() {
                if (this.bgmInterval) {
                    clearInterval(this.bgmInterval);
                    this.bgmInterval = null;
                }
            }

            playTone(freq, duration, type = 'square', gainValue = 0.08) {
                if (!this.enabled) return;
                this.init();
                try {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = type;
                    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + duration);
                } catch(e) {}
            }

            playSelect() { this.playTone(440, 0.08, 'square', 0.08); }
            playHit() {
                if (!this.enabled) return;
                this.init();
                try {
                    const bufferSize = this.ctx.sampleRate * 0.12;
                    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                    const output = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
                    const whiteNoise = this.ctx.createBufferSource();
                    whiteNoise.buffer = buffer;
                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(900, this.ctx.currentTime);
                    const gain = this.ctx.createGain();
                    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
                    whiteNoise.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
                    whiteNoise.start();
                } catch(e) {}
            }
            playHeal() {
                if (!this.enabled) return;
                this.playTone(523.25, 0.09, 'sine', 0.1);
                setTimeout(() => this.playTone(659.25, 0.09, 'sine', 0.1), 70);
                setTimeout(() => this.playTone(783.99, 0.12, 'sine', 0.1), 140);
                setTimeout(() => this.playTone(1046.50, 0.22, 'sine', 0.1), 210);
            }
            playBuff() {
                if (!this.enabled) return;
                this.playTone(300, 0.08, 'sawtooth', 0.08);
                setTimeout(() => this.playTone(450, 0.08, 'sawtooth', 0.08), 60);
                setTimeout(() => this.playTone(600, 0.12, 'sawtooth', 0.08), 120);
            }
            playSpecial() {
                if (!this.enabled) return;
                this.playTone(220, 0.1, 'sawtooth', 0.12);
                setTimeout(() => this.playTone(440, 0.1, 'square', 0.12), 90);
                setTimeout(() => this.playTone(330, 0.1, 'sawtooth', 0.12), 180);
                setTimeout(() => this.playTone(660, 0.2, 'square', 0.15), 270);
            }
            playVictory() {
                if (!this.enabled) return;
                const notes = [523.25, 659.25, 783.99, 1046.50, 880.00, 1046.50];
                notes.forEach((freq, idx) => setTimeout(() => this.playTone(freq, 0.18, 'triangle', 0.15), idx * 130));
            }
            playDefeat() {
                if (!this.enabled) return;
                const notes = [440, 392, 349, 220];
                notes.forEach((freq, idx) => setTimeout(() => this.playTone(freq, 0.25, 'sawtooth', 0.15), idx * 180));
            }
            playCharacterSound(charId) {
                if (!this.enabled) return;
                switch (charId) {
                    case 'courtney':
                        this.playTone(587.33, 0.08, 'sine', 0.1);
                        setTimeout(() => this.playTone(880.00, 0.15, 'sine', 0.12), 60);
                        break;
                    case 'pasha':
                    case 'pasha_dark':
                        this.playTone(1200, 0.04, 'square', 0.15);
                        setTimeout(() => this.playTone(800, 0.06, 'sawtooth', 0.1), 30);
                        break;
                    case 'ndaihyo':
                        this.playTone(880, 0.05, 'square', 0.15);
                        setTimeout(() => this.playTone(1760, 0.08, 'triangle', 0.15), 40);
                        break;
                    case 'dopagaking':
                        [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => this.playTone(f, 0.06, 'triangle', 0.08), i * 50));
                        break;
                    case 'iwaba':
                        this.playTone(110, 0.1, 'sawtooth', 0.12);
                        setTimeout(() => this.playTone(220, 0.1, 'square', 0.1), 80);
                        break;
                    case 'momo':
                        this.playTone(150, 0.15, 'sine', 0.15);
                        setTimeout(() => this.playTone(100, 0.2, 'triangle', 0.12), 100);
                        break;
                    case 'moenan':
                        this.playTone(300, 0.06, 'sawtooth', 0.12);
                        setTimeout(() => this.playTone(150, 0.12, 'square', 0.15), 50);
                        break;
                    case 'asaiomizu':
                        this.playTone(660, 0.05, 'sine', 0.12);
                        setTimeout(() => this.playTone(990, 0.1, 'triangle', 0.12), 50);
                        break;
                    default:
                        this.playHit();
                        break;
                }
            }

            playOpeningMelody() {
                if (!this.enabled) return;
                const notes = [220, 246.94, 261.63, 329.63, 392.00, 440.00, 523.25, 659.25];
                notes.forEach((freq, idx) => setTimeout(() => this.playTone(freq, 0.12, 'square', 0.08), idx * 110));
            }

            playAwakeningSound() {
                if (!this.enabled) return;
                this.playTone(150, 0.3, 'sawtooth', 0.1);
                setTimeout(() => this.playTone(300, 0.3, 'triangle', 0.12), 150);
                setTimeout(() => this.playTone(600, 0.4, 'sine', 0.15), 300);
            }

            playCutinSound() {
                if (!this.enabled) return;
                this.playTone(440, 0.08, 'square', 0.15);
                setTimeout(() => this.playTone(880, 0.12, 'sawtooth', 0.15), 60);
            }

            playClashSound() {
                if (!this.enabled) return;
                this.playTone(100, 0.25, 'sawtooth', 0.2);
                setTimeout(() => this.playTone(200, 0.15, 'square', 0.15), 100);
                setTimeout(() => this.playTone(80, 0.35, 'triangle', 0.25), 200);
            }

            playTitleSound() {
                if (!this.enabled) return;
                const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
                notes.forEach((freq, idx) => setTimeout(() => this.playTone(freq, 0.22, 'triangle', 0.18), idx * 120));
            }
        }
        const audioSystem = new SoundSystem();

        let playerState = {
            dopa: 1000,
            unlockedChars: ['iwaba', 'asaiomizu', 'ndaihyo', 'courtney', 'pasha_dark'], 
            selectedPlayerChar: 'courtney',
            selectedEnemyChar: 'pasha',
            playerName: '名無しファイター',
            selectedIcon: 'courtney',
            totalBattles: 0,
            wins: 0,
            losses: 0,
            charUsage: {},
            battleHistory: []
        };

        let activeBattle = null;

        let openingTimer = null;
        let openingKeyHandler = null;

        function cleanupOpening() {
            if (openingTimer) {
                clearTimeout(openingTimer);
                openingTimer = null;
            }
            if (openingKeyHandler) {
                window.removeEventListener('keydown', openingKeyHandler);
                openingKeyHandler = null;
            }
        }

        function renderOpeningScreen() {
            if (activeBattle) {
                activeBattle.destroy();
                activeBattle = null;
            }
            cleanupOpening();

            const container = document.getElementById('screen-container');
            
            const handleSkip = () => {
                cleanupOpening();
                renderHomeScreen();
            };

            openingKeyHandler = (e) => {
                if (['Enter', 'Space', 'Escape'].includes(e.code) || e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleSkip();
                }
            };
            window.addEventListener('keydown', openingKeyHandler);

            const renderScene = (sceneNum) => {
                if (!document.getElementById('screen-container') || !container.innerHTML.includes('opening-stage')) {
                    return;
                }

                const stage = document.getElementById('opening-stage');
                if (!stage) return;

                switch (sceneNum) {
                    case 1:
                        audioSystem.playAwakeningSound();
                        stage.innerHTML = `
                            <div class="flex flex-col items-center justify-center space-y-6 animate-cutin w-full">
                                <div class="pixel-box-gold p-8 bg-black/90 w-full max-w-lg text-center relative overflow-hidden border-amber-400">
                                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div class="w-32 h-32 bg-amber-500/20 rounded-full animate-opening-pulse blur-xl"></div>
                                    </div>
                                    <h3 class="text-xs sm:text-sm text-amber-300 font-mono tracking-widest mb-2">SCENE 1 : AWAKENING</h3>
                                    <h2 class="text-xl sm:text-2xl font-bold text-amber-400 font-pixel mb-4">🌟 DOPAエネルギーの覚醒 🌟</h2>
                                    <p class="text-xs sm:text-sm text-slate-200 leading-relaxed font-mono">
                                        静まり返った宇宙の闇から、王国を包み込む<br>神聖なるエネルギー「DOPA」の核が今、目覚めようとしている……！
                                    </p>
                                </div>
                            </div>
                        `;
                        openingTimer = setTimeout(() => renderScene(2), 3500);
                        break;

                    case 2:
                        audioSystem.playOpeningMelody();
                        stage.innerHTML = `
                            <div class="flex flex-col items-center justify-center space-y-6 animate-cutin w-full">
                                <div class="pixel-box p-8 bg-slate-950 w-full max-w-lg text-center relative overflow-hidden border-blue-500">
                                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                                        <div class="w-full h-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>
                                    </div>
                                    <h3 class="text-xs sm:text-sm text-blue-300 font-mono tracking-widest mb-2">SCENE 2 : DOPAGA KINGDOM</h3>
                                    <h2 class="text-xl sm:text-2xl font-bold text-blue-400 font-pixel mb-4">👑 黄金と光のドパガ王国 👑</h2>
                                    <p class="text-xs sm:text-sm text-slate-200 leading-relaxed font-mono">
                                        溢れるDOPAの光に導かれ、<br>栄光あるドパガキングダムの城塞が悠然と姿を現す！
                                    </p>
                                </div>
                            </div>
                        `;
                        openingTimer = setTimeout(() => renderScene(3), 3500);
                        break;

                    case 3:
                        audioSystem.playCutinSound();
                        stage.innerHTML = `
                            <div class="flex flex-col items-center justify-center space-y-4 animate-cutin w-full">
                                <h3 class="text-xs sm:text-sm text-pink-400 font-mono tracking-widest">SCENE 3 : FIGHTERS ASSEMBLE</h3>
                                <h2 class="text-lg sm:text-xl font-bold text-amber-300 font-pixel mb-2">⚡ 伝説のファイターたち集結 ⚡</h2>
                                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
                                    <div class="pixel-box p-3 bg-slate-900 flex flex-col items-center animate-cutin border-pink-400">
                                        <canvas id="op-cvs-courtney" width="60" height="60" class="pixel-box bg-slate-950 mb-1"></canvas>
                                        <span class="text-xs font-bold text-pink-300">コートニー</span>
                                    </div>
                                    <div class="pixel-box p-3 bg-slate-900 flex flex-col items-center animate-cutin border-yellow-400">
                                        <canvas id="op-cvs-ndaihyo" width="60" height="60" class="pixel-box bg-slate-950 mb-1"></canvas>
                                        <span class="text-xs font-bold text-yellow-300">N高代表</span>
                                    </div>
                                    <div class="pixel-box p-3 bg-slate-900 flex flex-col items-center animate-cutin border-purple-400">
                                        <canvas id="op-cvs-pasha" width="60" height="60" class="pixel-box bg-slate-950 mb-1"></canvas>
                                        <span class="text-xs font-bold text-purple-300">パシャ僧</span>
                                    </div>
                                    <div class="pixel-box p-3 bg-slate-900 flex flex-col items-center animate-cutin border-amber-400">
                                        <canvas id="op-cvs-dopagaking" width="60" height="60" class="pixel-box bg-slate-950 mb-1"></canvas>
                                        <span class="text-xs font-bold text-amber-400">ドパガキング</span>
                                    </div>
                                </div>
                                <p class="text-xs text-slate-300 font-mono mt-2">王国に迫る闇を払うため、<br>個性豊かな最強の挑戦者たちが今ここに立ち上がる！</p>
                            </div>
                        `;
                        setTimeout(() => {
                            ['courtney', 'ndaihyo', 'pasha', 'dopagaking'].forEach(id => {
                                const cvs = document.getElementById(`op-cvs-${id}`);
                                if (cvs) CharacterRenderer.drawCharacter(cvs, id);
                            });
                        }, 50);
                        openingTimer = setTimeout(() => renderScene(4), 4000);
                        break;

                    case 4:
                        audioSystem.playClashSound();
                        stage.innerHTML = `
                            <div class="flex flex-col items-center justify-center space-y-6 animate-opening-shake w-full">
                                <div class="pixel-box p-8 bg-red-950/90 w-full max-w-lg text-center border-red-500 shadow-2xl">
                                    <h3 class="text-xs sm:text-sm text-red-300 font-mono tracking-widest mb-2">SCENE 4 : CLASH</h3>
                                    <h2 class="text-xl sm:text-2xl font-bold text-yellow-300 font-pixel mb-4">💥 激突・光と闇の決戦 💥</h2>
                                    <p class="text-xs sm:text-sm text-slate-100 leading-relaxed font-mono">
                                        交錯するエネルギーと熱気！<br>すべてを賭けた激闘の幕が、今まさに切って落とされる！
                                    </p>
                                </div>
                            </div>
                        `;
                        openingTimer = setTimeout(() => renderScene(5), 3000);
                        break;

                    case 5:
                        audioSystem.playTitleSound();
                        stage.innerHTML = `
                            <div class="flex flex-col items-center justify-center space-y-6 animate-logo-glow w-full">
                                <div class="pixel-box-gold p-8 bg-amber-950/95 w-full max-w-lg text-center border-4 border-amber-300 shadow-2xl relative">
                                    <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-pixel text-[10px] px-3 py-1 rounded font-bold">
                                        🌟 決定版・神バランス調整版 EX 🌟
                                    </div>
                                    <h1 class="text-2xl sm:text-4xl font-black text-amber-300 font-pixel tracking-wider drop-shadow-[0_4px_0_rgba(0,0,0,1)] mb-3">
                                        DOPAGA KINGDOM RPG
                                    </h1>
                                    <p class="text-xs sm:text-sm text-amber-100 font-mono mb-6">
                                        王国に真の平和を取り戻せ！<br>最強の王者の座を掴むのは誰だ――？
                                    </p>
                                    <button onclick="renderHomeScreen()" class="pixel-btn pixel-btn-primary px-8 py-3 text-base font-bold font-pixel shadow-lg">
                                        冒険へ出発！ ▶
                                    </button>
                                </div>
                            </div>
                        `;
                        break;
                }
            };

            container.innerHTML = `
                <div class="relative w-full flex flex-col items-center justify-center min-h-[500px] p-4">
                    <button onclick="renderHomeScreen()" class="absolute top-2 right-2 pixel-btn pixel-btn-danger text-xs px-3 py-1 font-bold z-50">
                        ⏩ スキップ
                    </button>
                    <div id="opening-stage" class="w-full flex flex-col items-center justify-center">
                    </div>
                </div>
            `;

            renderScene(1);
        }

        async function addDopa(amount) {
            playerState.dopa += amount;
            const el = document.getElementById('dopa-count');
            if (el) el.innerText = playerState.dopa;
            await savePlayerState();
        }

        function updateHeaderProfile() {
            const nameEl = document.getElementById('header-profile-name');
            const iconCvs = document.getElementById('header-profile-icon');
            if (nameEl) nameEl.innerText = playerState.playerName || '名無しファイター';
            if (iconCvs) {
                CharacterRenderer.drawCharacter(iconCvs, playerState.selectedIcon || 'courtney');
            }
        }

        async function savePlayerState() {
            if (window.fbUser && window.fbDb) {
                try {
                    const userDocRef = window.fbDoc(window.fbDb, 'users', window.fbUser.uid);
                    await window.fbSetDoc(userDocRef, {
                        dopa: playerState.dopa,
                        unlockedChars: playerState.unlockedChars,
                        playerName: playerState.playerName,
                        selectedIcon: playerState.selectedIcon,
                        totalBattles: playerState.totalBattles,
                        wins: playerState.wins,
                        losses: playerState.losses,
                        charUsage: playerState.charUsage,
                        battleHistory: playerState.battleHistory,
                        updatedAt: Date.now()
                    }, { merge: true });
                } catch(e){
                    console.error("Firestore Save Player State Error:", e);
                }
            }
            try {
                localStorage.setItem('dopa_player_state', JSON.stringify(playerState));
            } catch(e){}
        }

        async function loadPlayerState() {
            try {
                const local = localStorage.getItem('dopa_player_state');
                if (local) {
                    const parsed = JSON.parse(local);
                    Object.assign(playerState, parsed);
                }
            } catch(e){}

            if (window.fbUser && window.fbDb) {
                try {
                    const userDocRef = window.fbDoc(window.fbDb, 'users', window.fbUser.uid);
                    const docSnap = await window.fbGetDoc(userDocRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.dopa !== undefined) playerState.dopa = data.dopa;
                        if (data.unlockedChars && Array.isArray(data.unlockedChars)) {
                            playerState.unlockedChars = data.unlockedChars;
                        }
                        if (data.playerName) playerState.playerName = data.playerName;
                        if (data.selectedIcon) playerState.selectedIcon = data.selectedIcon;
                        if (data.totalBattles !== undefined) playerState.totalBattles = data.totalBattles;
                        if (data.wins !== undefined) playerState.wins = data.wins;
                        if (data.losses !== undefined) playerState.losses = data.losses;
                        if (data.charUsage) playerState.charUsage = data.charUsage;
                        if (data.battleHistory) playerState.battleHistory = data.battleHistory;
                    } else {
                        await savePlayerState();
                    }
                } catch(e){
                    console.error("Firestore Load Player State Error:", e);
                }
            }
            if (!playerState.unlockedChars.includes('courtney')) {
                playerState.unlockedChars.push('courtney');
            }
            const el = document.getElementById('dopa-count');
            if (el) el.innerText = playerState.dopa;
            updateHeaderProfile();
        }

        function getMyProfileSnapshot() {
            const winRate = playerState.totalBattles > 0 ? ((playerState.wins / playerState.totalBattles) * 100).toFixed(1) : 0;
            return {
                playerName: playerState.playerName || '名無しファイター',
                selectedIcon: playerState.selectedIcon || 'courtney',
                totalBattles: playerState.totalBattles || 0,
                wins: playerState.wins || 0,
                losses: playerState.losses || 0,
                winRate: winRate,
                charUsage: playerState.charUsage || {}
            };
        }

        async function recordBattleResult(result, myCharId, opponentName, opponentIcon, isBot, opponentId = null, opponentProfile = null) {
            playerState.totalBattles++;
            if (result === 'win') playerState.wins++;
            else if (result === 'lose') playerState.losses++;

            playerState.charUsage[myCharId] = (playerState.charUsage[myCharId] || 0) + 1;

            const historyItem = {
                date: new Date().toLocaleString(),
                result: result,
                myChar: myCharId,
                opponentName: opponentName,
                opponentIcon: opponentIcon || 'pasha',
                isBot: isBot,
                opponentId: opponentId || (isBot ? 'bot_cpu' : 'online_player'),
                opponentProfile: opponentProfile
            };
            playerState.battleHistory.unshift(historyItem);
            if (playerState.battleHistory.length > 50) {
                playerState.battleHistory.pop();
            }

            await savePlayerState();
            updateHeaderProfile();
        }

        function showModal(title, body) {
            const titleEl = document.getElementById('modal-title');
            const bodyEl = document.getElementById('modal-body');
            const overlay = document.getElementById('modal-overlay');
            const actionsEl = document.getElementById('modal-actions');
            if (titleEl) titleEl.innerText = title;
            if (bodyEl) bodyEl.innerHTML = body;
            if (actionsEl) {
                actionsEl.innerHTML = `<button onclick="closeModal()" class="pixel-btn pixel-btn-primary px-6 py-2 font-bold text-sm">閉じる</button>`;
            }
            if (overlay) overlay.classList.remove('hidden');
        }

        function showConfirmModal(title, body, onConfirm) {
            const titleEl = document.getElementById('modal-title');
            const bodyEl = document.getElementById('modal-body');
            const overlay = document.getElementById('modal-overlay');
            const actionsEl = document.getElementById('modal-actions');
            if (titleEl) titleEl.innerText = title;
            if (bodyEl) bodyEl.innerHTML = body;
            if (actionsEl) {
                actionsEl.innerHTML = `
                    <button onclick="closeModal()" class="pixel-btn px-4 py-2 font-bold text-sm">キャンセル</button>
                    <button id="modal-confirm-btn" class="pixel-btn pixel-btn-danger px-4 py-2 font-bold text-sm">降参する</button>
                `;
                document.getElementById('modal-confirm-btn').onclick = () => {
                    closeModal();
                    onConfirm();
                };
            }
            if (overlay) overlay.classList.remove('hidden');
        }

        function closeModal() {
            const overlay = document.getElementById('modal-overlay');
            if (overlay) overlay.classList.add('hidden');
        }

        function confirmRetireBattle() {
            audioSystem.playSelect();
            showConfirmModal("バトル中断", "本当にバトルを中断して降参しますか？\n（ホーム画面に戻ります）", () => {
                if (activeBattle) {
                    activeBattle.destroy();
                    activeBattle = null;
                }
                renderHomeScreen();
            });
        }

        const GACHA_ITEMS = [
            { name: "N高クリケット部の特製木製バット", rarity: "SR", dopa: 150, charId: "ndaihyo" },
            { name: "ASAIOMIZUのサイン入りスパイク", rarity: "SR", dopa: 120, charId: "asaiomizu" },
            { name: "パシャ僧のカメラレンズクロス", rarity: "R", dopa: 80, charId: "pasha" },
            { name: "もえなん愛用の練習用ハンドボール", rarity: "R", dopa: 50, charId: "moenan" },
            { name: "コートニーのメロメロ海外ガールステッカー", rarity: "SR", dopa: 100, charId: "courtney" },
            { name: "桃ピンのナス盛り合わせ", rarity: "R", dopa: 30, charId: "momo" },
            { name: "岩盤星人の穴の空いたスニーカー", rarity: "R", dopa: 30, charId: "iwaba" },
            { name: "ドパガキングの黄金の王冠レプリカ", rarity: "SR", dopa: 150, charId: "dopagaking" },
            { name: "パシャ憎の闇のスマートフォンケース", rarity: "SR", dopa: 130, charId: "pasha_dark" }
        ];

        function openGachaModal() {
            audioSystem.playSelect();
            const allCharIds = Object.keys(CHARACTER_DATA);
            const lockedChars = allCharIds.filter(id => !playerState.unlockedChars.includes(id));

            const titleEl = document.getElementById('modal-title');
            const bodyEl = document.getElementById('modal-body');
            const overlay = document.getElementById('modal-overlay');
            const actionsEl = document.getElementById('modal-actions');

            if (titleEl) titleEl.innerText = "🎰 DOPAガチャ";
            if (bodyEl) {
                bodyEl.innerHTML = `
                    <div class="text-center space-y-3 py-1">
                        <div class="flex flex-col gap-2.5 w-full">
                            <button onclick="executeGacha(10)" class="pixel-btn pixel-btn-warning w-full py-3.5 font-bold text-sm sm:text-base shadow-lg animate-pulse">
                                🌟 10連ガチャ (1000 DOPA)
                            </button>
                            <button onclick="executeGacha(1)" class="pixel-btn pixel-btn-primary w-full py-2.5 font-bold text-xs sm:text-sm">
                                1回ガチャ (100 DOPA)
                            </button>
                        </div>
                        <div class="text-[11px] text-slate-300 flex justify-between items-center bg-slate-950 px-3 py-2 rounded border border-slate-800">
                            <span>所持: <b class="text-amber-400">${playerState.dopa}</b> DOPA</span>
                            <span>未獲得: <b class="text-amber-300">${lockedChars.length}</b>/${allCharIds.length}体</span>
                        </div>
                    </div>
                `;
            }
            if (actionsEl) {
                actionsEl.innerHTML = `<button onclick="closeModal()" class="pixel-btn px-6 py-1.5 font-bold text-xs">もどる</button>`;
            }
            if (overlay) overlay.classList.remove('hidden');
        }

        async function executeGacha(count) {
            audioSystem.playSelect();
            const cost = count * 100;
            if (playerState.dopa < cost) {
                showModal("DOPA不足", `ガチャを ${count}回 引くには ${cost} DOPA が必要です！（現在: ${playerState.dopa} DOPA）`);
                return;
            }

            await addDopa(-cost);

            const allCharIds = Object.keys(CHARACTER_DATA);
            let currentLocked = allCharIds.filter(id => !playerState.unlockedChars.includes(id));
            
            let results = [];
            let totalBonusDopa = 0;
            let newlyUnlocked = [];

            for (let i = 0; i < count; i++) {
                let hitChar = false;
                if (currentLocked.length > 0 && Math.random() < 0.40) {
                    hitChar = true;
                }

                if (hitChar && currentLocked.length > 0) {
                    const randomIndex = Math.floor(Math.random() * currentLocked.length);
                    const charId = currentLocked[randomIndex];
                    
                    currentLocked.splice(randomIndex, 1);
                    
                    if (!playerState.unlockedChars.includes(charId)) {
                        playerState.unlockedChars.push(charId);
                        newlyUnlocked.push(charId);
                    }

                    results.push({
                        type: 'character',
                        id: charId,
                        name: CHARACTER_DATA[charId].name,
                        title: CHARACTER_DATA[charId].title
                    });
                } else {
                    const item = GACHA_ITEMS[Math.floor(Math.random() * GACHA_ITEMS.length)];
                    totalBonusDopa += item.dopa;
                    results.push({
                        type: 'item',
                        name: item.name,
                        rarity: item.rarity,
                        dopa: item.dopa
                    });
                }
            }

            if (totalBonusDopa > 0) {
                await addDopa(totalBonusDopa);
            }

            await savePlayerState();

            if (newlyUnlocked.length > 0) {
                audioSystem.playVictory();
            } else {
                audioSystem.playSpecial();
            }

            let resultHtml = `<div class="text-center p-2 space-y-3 max-h-72 overflow-y-auto">`;
            if (newlyUnlocked.length > 0) {
                resultHtml += `<p class="text-amber-300 font-bold text-base mb-1">🎉 新キャラクター解放！ 🎉</p>`;
            } else {
                resultHtml += `<p class="text-amber-300 font-bold text-base mb-1">🎁 ガチャ結果 (${count}回) 🎁</p>`;
            }

            if (totalBonusDopa > 0) {
                resultHtml += `<p class="text-emerald-400 font-bold text-sm bg-slate-950 p-2 rounded border border-emerald-800">💰 アイテム報酬 合計 +${totalBonusDopa} DOPA 獲得！</p>`;
            }

            resultHtml += `<div class="grid grid-cols-1 gap-2 text-left mt-2">`;
            results.forEach((res) => {
                if (res.type === 'character') {
                    resultHtml += `
                        <div class="pixel-box p-2 bg-amber-950/60 border-amber-400 flex items-center justify-between text-xs">
                            <div>
                                <span class="bg-amber-500 text-black px-1.5 py-0.5 rounded font-bold text-[10px] mr-1">キャラ</span>
                                <b class="text-amber-300 text-sm">【 ${res.name} 】</b>
                                <span class="text-slate-300 ml-1">(${res.title})</span>
                            </div>
                            <span class="text-emerald-400 font-bold">✨NEW!</span>
                        </div>
                    `;
                } else {
                    let rarityColor = res.rarity === 'SR' ? 'text-purple-400 border-purple-500 bg-purple-950/40' : 'text-blue-400 border-blue-500 bg-blue-950/40';
                    resultHtml += `
                        <div class="pixel-box p-2 bg-slate-900 ${rarityColor} flex items-center justify-between text-xs">
                            <div>
                                <span class="px-1.5 py-0.5 rounded font-bold text-[10px] mr-1 border ${res.rarity === 'SR' ? 'bg-purple-900 text-purple-200 border-purple-400' : 'bg-blue-900 text-blue-200 border-blue-400'}">${res.rarity}</span>
                                <span class="text-slate-100">${res.name}</span>
                            </div>
                            <span class="text-amber-400 font-mono font-bold">+${res.dopa} DOPA</span>
                        </div>
                    `;
                }
            });
            resultHtml += `</div></div>`;

            showModal(`🎰 ガチャ結果 (${count}連)`, resultHtml);
        }

        function openCharacterListModal() {
            audioSystem.playSelect();
            let text = "";
            Object.values(CHARACTER_DATA).forEach(c => {
                const isUnlocked = playerState.unlockedChars.includes(c.id);
                const statusStr = isUnlocked ? '<span class="text-emerald-400">[解放済み]</span>' : '<span class="text-slate-500">[🔒 未解放 - ガチャで獲得]</span>';
                text += `👤 <b class="text-amber-300">${c.name}</b> (${c.title}) ${statusStr}\n`;
                text += `タイプ: ${c.type}\n`;
                text += `HP:${c.hp} / 攻:${c.atk} / 防:${c.def} / 速:${c.spd} / 避:${c.eva}%\n${c.desc}\n\n`;
            });
            showModal("キャラクター図鑑", text);
        }

        function openCharDetail(id) {
            audioSystem.playSelect();
            const c = CHARACTER_DATA[id];
            if (!c) return;
            const isUnlocked = playerState.unlockedChars.includes(id);

            let text = `👤 <b class="text-amber-300">${c.name}</b> (${c.title}) ${isUnlocked ? '✨解放済み' : '🔒未解放'}\n\n`;
            text += `タイプ: ${c.type}\n`;
            text += `ステータス: HP ${c.hp} / 攻撃 ${c.atk} / 防御 ${c.def} / 素早さ ${c.spd} / 回避 ${c.eva}%\n\n`;
            text += `【所持スキル】\n`;
            c.skills.forEach(s => {
                const cdStr = s.cooldown > 0 ? ` [CT: ${s.cooldown}T]` : ' [CT: 0]';
                text += `・${s.name}${cdStr}: ${s.desc}\n`;
            });
            text += `\n${c.desc}`;
            showModal(c.name, text);
        }

        const CHARACTER_DATA = {


dopagaking: {
    id: 'dopagaking',
    name: 'ドパガキング',
    title: 'ドパガキングダムの国王',
    type: '運命属性 / 完全ランダム型',
    hp: 150, // ※バトル開始時にランダム上書きされます
    atk: 18, def: 12, spd: 25, eva: 15,
    dopaChargeCount: 0,
    selectedInheritChar: null,
    maxHpRandom: 150,
    desc: 'すべてを運に任せる完全ランダム型の国王。アイコンタップで「王位継承」をチャージし、他キャラの力の4倍ダメージを叩き込む！',
    skills: [
        { id: 'dopa_juggler', name: 'ジャグラー', type: 'dopa_juggler_skill', power: 1.0, isNormalAttack: false, cooldown: 0, desc: '0～50の完全ランダムダメージを与える通常攻撃！' },
        { id: 'dopa_majesty', name: '王の威厳', type: 'dopa_majesty_skill', cooldown: 2, desc: '70%で次の攻撃を完全に回避、30%でHPを60回復する！' },
        { id: 'dopa_godluck', name: '神頼み', type: 'dopa_godluck_skill', cooldown: 10, desc: '95%で自分が10ダメージ、5%で相手に1000ダメージを与える極限のギャンブル！' },
        { id: 'dopa_inheritance', name: '王位継承', type: 'dopa_inheritance_skill', cooldown: 0, desc: 'アイコンを5回タップしてチャージ！選ばれた他キャラの通常攻撃×4のダメージを次ターン自動発動！' }
    ]
},




            courtney: {
                id: 'courtney',
                name: 'コートニー',
                title: 'メロメロ海外ガール',
                type: '恋属性 / 溜め・爆発型',
                hp: 140, atk: 18, def: 15, spd: 17, eva: 18,
                courtneyChargeCount: 0,
                desc: '相手をメロメロにして戦う海外ガール。王国初となる「溜め技」を駆使し、最大8回までチャージして一撃の爆発力を高める！',
                skills: [
                    { id: 'courtney_attack', name: 'ミツメル', type: 'attack', power: 1.0, isNormalAttack: true, cooldown: 0, desc: '相手をじっと見つめて攻撃する通常攻撃。' },
                    { id: 'courtney_yoseru', name: 'ヨセル', type: 'courtney_yoseru_skill', power: 1.1, isNormalAttack: false, cooldown: 2, desc: '少量のダメージを与えつつ、1ターンの間相手の防御力を0にするデバフスキル！' },
                    { id: 'courtney_aegu', name: 'アエグ', type: 'courtney_aegu_skill', healRate: 0.45, cooldown: 3, desc: '次の相手の攻撃を必ず回避し、自身のライフを45パーセント回復する！' },
                    { id: 'courtney_feel', name: 'FEEL SO HOT ///', type: 'courtney_charge_release', cooldown: 0, desc: '（アイコンタップで溜め）最大8回まで溜められる特殊技。0回だと弱い攻撃、7回溜めると最大110ダメージ！' }
                ]
            },
            ndaihyo: {
                id: 'ndaihyo',
                name: 'N高代表',
                title: 'クリケット部の天才',
                type: '頭脳・デバフ型',
                hp: 129, atk: 23, def: 15, spd: 25, eva: 16,
                desc: 'N高クリケット部代表。高い知性と緻密な戦術で相手の能力を下げつつ優位に立つ。相手が「パシャ僧」の場合は専用パッシブ【パシャ僧キラー】が1試合に1回だけ発動し、現在HPの50%を一気に削る！',
                skills: [
                    { id: 'ndaihyo_attack', name: '通常攻撃', type: 'attack', power: 1.05, isNormalAttack: true, cooldown: 0, desc: '正確なバッティング攻撃。「パシャ僧」相手には1試合1回【パシャ僧キラー】発動！' },
                    { id: 'ndaihyo_analysis', name: '弱点分析ショット', type: 'debuff_attack', power: 1.30, isNormalAttack: false, cooldown: 3, desc: '弱点を突き攻撃すると同時に、相手の攻撃力と防御力を低下させる！' },
                    { id: 'ndaihyo_tactics', name: 'パシャ憎にムカつく', type: 'debuff', cooldown: 6, desc: '相手の隙を突いた頭脳戦術で、攻撃力と防御力を大きく低下させる。' },
                    { id: 'ndaihyo_mind', name: '消しゴムを食う', type: 'heal_cleanse', healRate: 0.20, cooldown: 2, desc: '心を整えHPを回復し、自身のステータス低下をリセットする。' }
                ]
            },
            pasha: {
                id: 'pasha',
                name: 'パシャ僧',
                title: '暗黒スマホ僧侶',
                type: '闇属性 / バランス',
                hp: 128, atk: 24, def: 19, spd: 29, eva: 21,
                image: 'images/pasha.webp',
                desc: 'スマホを手に右手を封印している暗黒僧侶。回避率が高く、HP減半で「ダークモード」が自動発動して攻撃力アップ！',
                skills: [
                    { id: 'pasha_attack', name: '通常攻撃', type: 'attack', power: 1.0, isNormalAttack: true, cooldown: 0, desc: '標準的な闇の物理攻撃。' },
                    { id: 'pasha_flash', name: 'カメラフラッシュ', type: 'attack', power: 1.35, isNormalAttack: false, cooldown: 2, desc: '強烈なフラッシュでダメージを与える。' },
                    { id: 'pasha_roll', name: 'カメラロール参照', type: 'heal', healRate: 0.35, cooldown: 3, desc: '思い出の写真を見てHPを大きく回復。' },
                    { id: 'pasha_darkness', name: '暗黒封印解除', type: 'special', power: 1.85, isNormalAttack: false, cooldown: 4, desc: '封印された右手の暗黒パワーを撃ち出す！' }
                ]
            },

pasha_dark: {
                id: 'pasha_dark',
                name: 'パシャ憎・半浸闇化状態',
                title: '闇に染まりかけし黒き僧侶',
                type: '闇属性 / 超火力・回避特化',
                hp: 113, atk: 25, def: 17, spd: 13, eva: 25,
                image: 'images/pasha-dark.webp',
                hasEvasionBuff: true,
                evasionMultiplier: 1.1,
                currentAtkBuff: 1.0,
                desc: '圧倒的な攻撃力と高回避を誇る超攻撃型。回避するたびに攻撃力が跳ね上がるアビリティを持ち、ハマれば一撃で全てを破壊するロマンと脅威を兼ね備えています。',
                skills: [
                    { id: 'pasha_dark_attack', name: '通常攻撃', type: 'attack', power: 1.0, isNormalAttack: true, cooldown: 0, desc: '暗黒のフラッシュを浴びせる基本の通常攻撃。' },
                    { id: 'pasha_dark_stealth', name: 'ステルスオブダーク', type: 'attack', power: 1.25, isNormalAttack: false, cooldown: 2, desc: '敵の回避率を完全に無視してダメージを与え、さらに自身の回避率を2%アップする。' },
                    { id: 'pasha_dark_crime', name: 'パーフェクトクライム', type: 'heal', healRate: 0.95, cooldown: 3, desc: '自らの罪を深く自覚することで闇のエネルギーを変換し、HPを回復する。' },
                    { id: 'pasha_dark_nightmare', name: 'アブソリュートナイトメア', type: 'special', power: 1.85, isNormalAttack: false, cooldown: 4, desc: '攻撃力がアップし、敵に超大ダメージを与える！' }
                ]
            },

            
            iwaba: {
                id: 'iwaba',
                name: '岩盤星人',
                title: '不屈のラップラッパー',
                type: '岩属性 / 耐久強化',
                hp: 145, atk: 22, def: 18, spd: 22, eva: 8,
                desc: 'ダンスとラップと岩盤浴を愛する星人。防御が高く「岩盤浴」や「ラップ」でステータスを底上げする粘り強さ。',
                skills: [
                    { id: 'iwaba_dance', name: 'ブレイクダンス', type: 'attack', power: 1.15, isNormalAttack: true, cooldown: 0, desc: 'リズムに乗った連続アタック。' },
                    { id: 'iwaba_rap', name: 'フリースタイル', type: 'buff', buffType: 'atk', amount: 1.40, cooldown: 2, desc: '韻を踏みまくって攻撃力を大幅強化！' },
                    { id: 'iwaba_song', name: 'ソウルソング', type: 'heal', healRate: 0.25, cooldown: 3, desc: '魂の歌声で傷を癒やす。' },
                    { id: 'iwaba_bath', name: '岩盤浴ブースト', type: 'heal_buff', healRate: 0.20, cooldown: 5, desc: '温まりHP回復＋防御力を強化！' }
                ]
            },
            momo: {
                id: 'momo',
                name: '桃ピン',
                title: 'ナスを統べる守護要塞',
                type: '土属性 / 超耐久一発型',
                hp: 160, atk: 18, def: 25, spd: 14, eva: 9,
                desc: '圧倒的タフさを誇る要塞。「ナス準備中」でミニぞうさんに変身し、次のターン手動で大威力の“超ナス乱舞”を繰り出す！',
                skills: [
                    { id: 'momo_attack', name: 'ポカポカ叩く', type: 'attack', power: 1.0, isNormalAttack: true, cooldown: 0, desc: '通常攻撃。' },
                    { id: 'momo_prep', name: 'ナス準備中', type: 'charge', cooldown: 3, desc: 'ゾウに変身し相手のターンへ！次ターンにコマンド「超ナスちん乱舞」が解禁！' },
                    { id: 'momo_chie', name: 'チエを呼び出す', type: 'sacrifice_buff', hpCostRate: 0.20, cooldown: 4, desc: 'HPを削って攻撃力を2.3倍に跳ね上げる！' },
                    { id: 'momo_gk', name: 'ゴールキーパー', type: 'defend_buff', cooldown: 3, desc: '2ターンの間、被ダメージを70%カットする鉄壁。' }
                ]
            },
            moenan: {
                id: 'moenan',
                name: 'もえなん',
                title: 'トゲ髪のアタッカー',
                type: '火属性 / 超超攻撃特化',
                hp: 105, atk: 28, def: 14, spd: 31, eva: 12,
                desc: 'トゲ髪が目印の超攻撃的ハンター。素早さと威力が圧倒的で「筋トレ」後のハンドボールシュートは一撃必殺。',
                skills: [
                    { id: 'moenan_cat', name: '高速猫パンチ', type: 'attack', power: 1.10, isNormalAttack: true, cooldown: 0, desc: '鋭い爪の通常攻撃。' },
                    { id: 'moenan_play', name: 'こももと遊ぶ', type: 'heal', healRate: 0.62, cooldown: 2, desc: '愛猫に癒やされてHPを回復。' },
                    { id: 'moenan_handball', name: '全力投球', type: 'attack', power: 1.60, isNormalAttack: false, cooldown: 3, desc: '唸りをあげるシュートを叩き込む！' },
                    { id: 'moenan_workout', name: '筋トレ追い込み', type: 'buff', buffType: 'atk', amount: 1.40, cooldown: 3, desc: '筋肉を追い込み攻撃力を激増させる。' }
                ]
            },
            asaiomizu: {
                id: 'asaiomizu',
                name: 'ASAIOMIZU',
                title: 'パーマなナルシスト',
                type: '水属性 / カウンター',
                hp: 132, atk: 28, def: 20, spd: 26, eva: 17,
                desc: '特徴的なパーマヘアを持つナルシスト。通常攻撃を受けると自動で反撃！「ディグ」で相手の攻撃技をコピーし「サッカーシュート」で大ダメージを狙う。',
                skills: [
                    { id: 'asaiomizu_attack', name: '通常攻撃', type: 'attack', power: 1.15, isNormalAttack: true, cooldown: 0, desc: 'スタイリッシュな通常の攻撃。' },
                    { id: 'asaiomizu_shoot', name: 'サッカーシュート', type: 'attack', power: 1.80, isNormalAttack: false, cooldown: 3, desc: 'サッカーボールを強烈に蹴り出す特大パワーシュート！' },
                    { id: 'asaiomizu_dig', name: 'ディグ', type: 'dig', cooldown: 3, desc: '身を潜めて相手の攻撃を待ち構え、受けた攻撃技をコピーする！' },
                    { id: 'asaiomizu_club', name: 'クラブに行く', type: 'heal_club', healRate: 0.35, cooldown: 3, desc: 'クラブでアゲアゲに踊り狂ってHPを回復！' }
                ]
            }
        };

        class BotInputAdapter {
            getDecision(botChar, opponentChar) {
                if (botChar.isResting) return 'rest';
                if (botChar.eggplantReady) return 'momo_eggplant_burst';
                if (botChar.recordedSkill) return 'asaiomizu_copied';

                if (botChar.id === 'courtney') {
                    const charges = botChar.courtneyChargeCount || 0;
                    if (charges < 7 && Math.random() < 0.6) {
                        botChar.courtneyChargeCount = charges + 1;
                        return 'courtney_charge_only';
                    }
                }

                const availableSkills = botChar.skills.filter(s => (botChar.cooldowns?.[s.id] || 0) === 0);
                const skills = availableSkills.length > 0 ? availableSkills : botChar.skills;
                const hpRatio = botChar.hp / botChar.maxHp;

                if (botChar.id === 'ndaihyo') {
                    if (opponentChar.buffAtk >= 1.0) {
                        const tactics = skills.find(s => s.id === 'ndaihyo_tactics');
                        if (tactics) return tactics.id;
                    }
                    if (hpRatio < 0.4) {
                        const mind = skills.find(s => s.id === 'ndaihyo_mind');
                        if (mind) return mind.id;
                    }
                    const analysis = skills.find(s => s.id === 'ndaihyo_analysis');
                    if (analysis) return analysis.id;
                }

                const chosen = skills[Math.floor(Math.random() * skills.length)];
                return chosen ? chosen.id : botChar.skills[0].id;
            }
        }

        class BattleEngine {
            constructor(p1CharId, p2CharId, isOnline = false, myPlayerNum = 1, roomId = null) {
                this.isOnline = isOnline;
                this.myPlayerNum = myPlayerNum;
                this.roomId = roomId;
                this.turn = 1;
                this.turnTimer = 15;
                this.timerId = null;
                this.battleEnded = false;
                this.isSuddenDeath = false;
                this.waitingForOpponent = false;

                this.p1 = this.createBattlePlayer(p1CharId, isOnline ? 'Player 1' : 'Player 1');
                this.p2 = this.createBattlePlayer(p2CharId, isOnline ? 'Player 2' : 'BOT (CPU)');

                this.p1Action = null;
                this.p2Action = null;

                this.botAdapter = isOnline ? null : new BotInputAdapter();

                this.onLogUpdate = null;
                this.onTimerUpdate = null;
                this.onStateChange = null;
                this.onVisualEffect = null;
                this.onBattleEnd = null;
                this.onCutin = null;

                this.firestoreUnsub = null;
                this.lastProcessedTurn = 0;
                this.heartbeatTimer = null;
                this.currentTurnLogs = [];
                this.onlineSyncStarted = false;
                this.latestRoomData = null;
            }

            log(msg, colorClass = 'text-slate-200') {
                if (this.currentTurnLogs) {
                    this.currentTurnLogs.push({ msg, colorClass });
                }
                if (this.onLogUpdate) {
                    this.onLogUpdate(msg, colorClass);
                }
            }















            createBattlePlayer(charId, displayName) {
                const master = CHARACTER_DATA[charId] || CHARACTER_DATA.pasha;

                let hp = master.hp;
                let atk = master.atk;
                let def = master.def;
                let spd = master.spd;
                let eva = master.eva;

                if (charId === 'dopagaking') {
                    hp = Math.floor(Math.random() * (200 - 80 + 1)) + 80;
                    atk = Math.floor(Math.random() * (28 - 7 + 1)) + 7;
                    def = Math.floor(Math.random() * (17 - 7 + 1)) + 7;
                    eva = Math.floor(Math.random() * (22 - 8 + 1)) + 8;
                    spd = Math.floor(Math.random() * (40 - 14 + 1)) + 14;
                }

                return {
                    id: master.id,
                    name: displayName,
                    charName: master.name,
                    title: master.title,
                    type: master.type,
                    hp: hp,
                    maxHp: hp,
                    atk: atk,
                    def: def,
                    spd: spd,
                    eva: eva,
                    skills: master.skills.map(s => ({ ...s })),
                    cooldowns: {},
                    buffAtk: 1.0,
                    buffDef: 1.0,
                   dopaChargeCount: charId === 'dopagaking' ? 0 : 0,
                    selectedInheritChar: null,
                    maxHpRandom: hp,
                    courtneyChargeCount: master.id === 'courtney' ? 0 : 0,
                    tempEvadeNext: false,
                    pashaKillerUsed: false,
                    isResting: false,
                    digActive: false,
                    digUsedTurn: 0,
                    recordedSkill: null,
                    eggplantReady: false,
                    isMiniZou: false,
                    momoRevived: false,
                    isDarkMode: false,
                    defendBuffTurns: 0
                };
            }



            startBattle() {
                this.log(`⚔️ バトル開始！ 【${this.p1.charName}】 VS 【${this.p2.charName}】`, 'text-amber-300 font-bold');
                
                const myChar = (this.isOnline && this.myPlayerNum === 2) ? this.p2 : this.p1;
                if (myChar.id === 'dopagaking') {
                    const statusBody = `【ドパガキングのステータス決定！】\n` +
                        `HP：${myChar.hp}\n` +
                        `攻撃力：${myChar.atk}\n` +
                        `防御力：${myChar.def}\n` +
                        `回避率：${myChar.eva}%\n` +
                        `素早さ：${myChar.spd}`;
                    
                    showModal("👑 ドパガキング参戦", statusBody);
                }

                if (this.isOnline && this.roomId) {
                    this.initOnlineSync();
                } else {
                    this.startTimer();
                }
                
                if (this.onStateChange) this.onStateChange(this);
            }

            async initOnlineSync() {

                     if (this.onlineSyncStarted) return;
                     this.onlineSyncStarted = true;
                const roomRef = window.fbDoc(window.fbDb, 'artifacts', window.fbAppId, 'public', 'data', 'rooms', this.roomId);
                
                if (this.myPlayerNum === 1) {
                    try {
                        await window.fbUpdateDoc(roomRef, {
                            currentTurn: 1,
                            p1Action: null,
                            p2Action: null,
                            p1ActionTurn: 0,
                            p2ActionTurn: 0,
                            lastProcessedTurn: 0,
                            p1State: this.serializePlayer(this.p1),
                            p2State: this.serializePlayer(this.p2),
                            isSuddenDeath: false,
                            battleEnded: false,
                            p1LastSeen: Date.now()
                        });
                    } catch(e) {
                        console.error("Init online doc error", e);
                    }
                }

                this.heartbeatTimer = setInterval(async () => {
                    if (this.battleEnded || !this.isOnline) return;
                    try {
                        const field = this.myPlayerNum === 1 ? 'p1LastSeen' : 'p2LastSeen';
                        await window.fbUpdateDoc(roomRef, { [field]: Date.now() });
                    } catch(e){}
                }, 4000);

                this.firestoreUnsub = window.fbOnSnapshot(roomRef, (snapshot) => {
                    const data = snapshot.data();
                    if (!data) return;
                    this.latestRoomData = data;

                    const oppLastSeen = this.myPlayerNum === 1 ? data.p2LastSeen : data.p1LastSeen;
                    if (oppLastSeen && (Date.now() - oppLastSeen > 20000) && !this.battleEnded && this.isOnline) {
                        this.log('⚠️ 相手との接続が切断されたため、BOT戦へ切り替えます。', 'text-amber-400 font-bold');
                        this.fallbackToBotMode();
                        return;
                    }

                    if (this.myPlayerNum === 1) {
                        if (data.p1ActionTurn === this.turn && data.p2ActionTurn === this.turn && this.lastProcessedTurn < this.turn) {
                            this.p1Action = data.p1Action;
                            this.p2Action = data.p2Action;
                            this.lastProcessedTurn = this.turn;
                            this.stopTimer();
                            this.processTurn();
                        }
                    } else {
                        if (data.lastProcessedTurn >= this.turn) {
                            this.deserializePlayer(this.p1, data.p1State);
                            this.deserializePlayer(this.p2, data.p2State);
                            this.isSuddenDeath = data.isSuddenDeath;
                            this.turn = data.currentTurn;
                            this.p1Action = null;
                            this.p2Action = null;
                            this.waitingForOpponent = false;

                            if (data.logs && data.logs.length > 0) {
                                data.logs.forEach(l => {
                                    if (this.onLogUpdate) this.onLogUpdate(l.msg, l.colorClass);
                                    if (l.effect && this.onVisualEffect) this.onVisualEffect(l.effect.side, l.effect.type, l.effect.text);
                                    if (l.cutin && this.onCutin) this.onCutin(l.cutin.title, l.cutin.subtitle);
                                });
                            }

                            if (data.battleEnded) {
                                if (!this.statsRecorded) {
                                    this.statsRecorded = true;
                                    let result = 'draw';
                                    if (this.p2.hp > 0 && this.p1.hp <= 0) result = 'win';
                                    else if (this.p2.hp <= 0 && this.p1.hp > 0) result = 'lose';
                                    else result = 'draw';

                                    const myCharId = this.p2.id;
                                    const oppChar = this.p1;
                                    const oppName = data.p1Profile?.playerName || oppChar.charName || '対戦相手';
                                    const oppIcon = data.p1Profile?.selectedIcon || oppChar.id;
                                    const oppProfile = data.p1Profile || null;

                                    if (typeof recordBattleResult === 'function') {
                                        recordBattleResult(result, myCharId, oppName, oppIcon, false, 'online_p1', oppProfile);
                                    }
                                }

                                this.battleEnded = true;
                                this.stopTimer();
                                if (this.onBattleEnd) this.onBattleEnd(data.winnerText);
                            } else {
                                this.startTimer();
                            }

                            if (this.onStateChange) this.onStateChange(this);
                        }
                    }
                }, (err) => {
                    console.error("Firestore listener error:", err);
                    this.fallbackToBotMode();
                });

                this.startTimer();
            }

            fallbackToBotMode() {
                this.isOnline = false;
                this.botAdapter = new BotInputAdapter();
                if (this.firestoreUnsub) {
                    this.firestoreUnsub();
                    this.firestoreUnsub = null;
                }
                if (this.heartbeatTimer) {
                    clearInterval(this.heartbeatTimer);
                    this.heartbeatTimer = null;
                }
                this.waitingForOpponent = false;
                this.startTimer();
                if (this.onStateChange) this.onStateChange(this);
            }

           serializePlayer(p) {
    return {
        hp: p.hp,
        maxHp: p.maxHp,
        buffAtk: p.buffAtk,
        buffDef: p.buffDef,
        cooldowns: { ...p.cooldowns },
        // undefinedにならないよう、値がない場合は 0 または null にフォールバックする
        courtneyChargeCount: p.courtneyChargeCount !== undefined ? p.courtneyChargeCount : 0,
        dopaChargeCount: p.dopaChargeCount !== undefined ? p.dopaChargeCount : 0,
        selectedInheritChar: p.selectedInheritChar || null,
        tempEvadeNext: p.tempEvadeNext,
        pashaKillerUsed: p.pashaKillerUsed,
        isResting: p.isResting,
        digActive: p.digActive,
        digUsedTurn: p.digUsedTurn,
        recordedSkill: p.recordedSkill ? { ...p.recordedSkill } : null,
        eggplantReady: p.eggplantReady,
        isMiniZou: p.isMiniZou,
        momoRevived: p.momoRevived,
        isDarkMode: p.isDarkMode,
        defendBuffTurns: p.defendBuffTurns
    };
}

            deserializePlayer(p, state) {
                if (!state) return;
                p.hp = state.hp;
                p.maxHp = state.maxHp;
                p.buffAtk = state.buffAtk;
                p.buffDef = state.buffDef;
                p.cooldowns = { ...state.cooldowns };
                p.courtneyChargeCount = state.courtneyChargeCount;
                p.dopaChargeCount = state.dopaChargeCount !== undefined ? state.dopaChargeCount : 0;
                p.selectedInheritChar = state.selectedInheritChar || null;
                p.tempEvadeNext = state.tempEvadeNext;
                p.pashaKillerUsed = state.pashaKillerUsed;
                p.isResting = state.isResting;
                p.digActive = state.digActive;
                p.digUsedTurn = state.digUsedTurn;
                p.recordedSkill = state.recordedSkill ? { ...state.recordedSkill } : null;
                p.eggplantReady = state.eggplantReady;
                p.isMiniZou = state.isMiniZou;
                p.momoRevived = state.momoRevived;
                p.isDarkMode = state.isDarkMode;
                p.defendBuffTurns = state.defendBuffTurns;
            }

            startTimer() {
                this.stopTimer();
                this.turnTimer = 15;
                if (this.onTimerUpdate) this.onTimerUpdate(this.turnTimer);

                this.timerId = setInterval(() => {
                    this.turnTimer--;
                    if (this.onTimerUpdate) this.onTimerUpdate(this.turnTimer);

                    if (this.turnTimer <= 0) {
                        this.stopTimer();
                        this.handleTimeOut();
                    }
                }, 1000);
            }

            stopTimer() {
                if (this.timerId) {
                    clearInterval(this.timerId);
                    this.timerId = null;
                }
            }

            handleTimeOut() {
                if (this.battleEnded) return;
                this.log('⏰ 制限時間切れ！自動選択します。', 'text-amber-400 font-bold');

                const p1Default = this.p1.isResting ? 'rest' : (this.p1.eggplantReady ? 'momo_eggplant_burst' : this.p1.skills[0].id);
                const p2Default = this.p2.isResting ? 'rest' : (this.p2.eggplantReady ? 'momo_eggplant_burst' : this.p2.skills[0].id);

                if (this.isOnline) {
                    if (this.myPlayerNum === 1 && !this.p1Action) this.submitAction(1, p1Default);
                    if (this.myPlayerNum === 2 && !this.p2Action) this.submitAction(2, p2Default);
                } else {
                    if (!this.p1Action) this.p1Action = p1Default;
                    if (!this.p2Action) this.p2Action = p2Default;
                    this.processTurn();
                }
            }

            async submitAction(pNum, skillId) {
                if (this.battleEnded) return;







                if (this.isOnline) {
    if (pNum !== this.myPlayerNum) return;
    this.waitingForOpponent = true;
    if (this.onStateChange) this.onStateChange(this);

    const roomRef = window.fbDoc(window.fbDb, 'artifacts', window.fbAppId, 'public', 'data', 'rooms', this.roomId);
    const updateObj = pNum === 1 
        ? { p1Action: skillId, p1ActionTurn: this.turn }
        : { p2Action: skillId, p2ActionTurn: this.turn };

                    try {
                        await window.fbUpdateDoc(roomRef, updateObj);
                    } catch (e) {
                        console.error("Action submit error", e);
                        this.fallbackToBotMode();
                    }
                } else {
                    if (pNum === 1) this.p1Action = skillId;
                    if (pNum === 2) this.p2Action = skillId;

                    if (this.p1Action && !this.p2Action) {
                        this.p2Action = this.botAdapter.getDecision(this.p2, this.p1);
                    }

                    if (this.p1Action && this.p2Action) {
                        this.stopTimer();
                        this.processTurn();
                    } else {
                        if (this.onStateChange) this.onStateChange(this);
                    }
                }
            }

            async processTurn() {
                this.currentTurnLogs = [];

                if (this.isSuddenDeath) {
                    this.log(`--- [ ターン ${this.turn} (🔥サドンデス) ] ---`, 'text-red-400 font-bold text-center');
                } else {
                    this.log(`--- [ ターン ${this.turn} ] ---`, 'text-slate-400 font-bold text-center');
                }

                const p1Speed = this.p1.spd + Math.random() * 2;
                const p2Speed = this.p2.spd + Math.random() * 2;

                let first, second, firstAction, secondAction;
                if (p1Speed >= p2Speed) {
                    first = this.p1; firstAction = this.p1Action;
                    second = this.p2; secondAction = this.p2Action;
                } else {
                    first = this.p2; firstAction = this.p2Action;
                    second = this.p1; secondAction = this.p1Action;
                }

                this.executePlayerAction(first, second, firstAction);
                if (!await this.checkWinner()) {
                    this.executePlayerAction(second, first, secondAction);
                    if (!await this.checkWinner()) {
                        this.endTurnPhase();
                    }
                }

                if (this.isOnline && this.myPlayerNum === 1) {
                    const roomRef = window.fbDoc(window.fbDb, 'artifacts', window.fbAppId, 'public', 'data', 'rooms', this.roomId);
                    try {
                        await window.fbUpdateDoc(roomRef, {
                            currentTurn: this.turn,
                            lastProcessedTurn: this.lastProcessedTurn,
                            p1State: this.serializePlayer(this.p1),
                            p2State: this.serializePlayer(this.p2),
                            isSuddenDeath: this.isSuddenDeath,
                            battleEnded: this.battleEnded,
                            winnerText: this.winnerText || '',
                            logs: this.currentTurnLogs,
                            p1Action: null,
                            p2Action: null,
                            p1ActionTurn: 0,
                            p2ActionTurn: 0
                        });
                    } catch(e) {
                        console.error("Sync host state error", e);
                    }
                }

                this.p1Action = null;
                this.p2Action = null;
                this.waitingForOpponent = false;

                if (this.onStateChange) this.onStateChange(this);
                if (!this.battleEnded) this.startTimer();
            }

          executePlayerAction(attacker, defender, skillId) {
                if (attacker.hp <= 0) return;

                if (skillId === 'courtney_charge_only') {
                    // オンライン/オフライン共通で「溜め進行」は必ず同じ状態更新ルートで行う（1ターン最大8回まで1加算）
                    if ((attacker.courtneyChargeCount || 0) < 8) {
                        attacker.courtneyChargeCount = (attacker.courtneyChargeCount || 0) + 1;
                    }

                    this.log(`⚡ ${attacker.charName} は 「FEEL SO HOT ///」 のチャージを進めた！（現在溜め: ${attacker.courtneyChargeCount}回）`, 'text-pink-400 font-bold');
                    audioSystem.playBuff();
                    this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', `溜め+1 (${attacker.courtneyChargeCount})`);
                    return;
                }

                if (skillId === 'dopa_charge_step') {
                    if ((attacker.dopaChargeCount || 0) < 5) {
                        attacker.dopaChargeCount = (attacker.dopaChargeCount || 0) + 1;
                        audioSystem.playBuff();
                        if (attacker.dopaChargeCount === 5) {
                            const healAmt = Math.floor(attacker.maxHpRandom * 0.30);
                            attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);

                            const otherCharIds = Object.keys(CHARACTER_DATA).filter(id => id !== 'dopagaking');
                            attacker.selectedInheritChar = otherCharIds[Math.floor(Math.random() * otherCharIds.length)];

                            this.log(`👑 ドパガキングは5回目のチャージを完了！最大HPの30%（${healAmt}）回復し、【${CHARACTER_DATA[attacker.selectedInheritChar].name}】の力を宿した！`, 'text-amber-300 font-bold');
                            this.triggerCutin('👑 王位継承準備完了！', `選ばれた力: ${CHARACTER_DATA[attacker.selectedInheritChar].name}`);
                            this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'heal', `+${healAmt}`);
                        } else {
                            this.log(`👑 ドパガキングは王位継承のチャージを行った！（現在チャージ: ${attacker.dopaChargeCount}/5）`, 'text-amber-300 font-bold');
                            this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', `チャージ+1 (${attacker.dopaChargeCount}/5)`);
                        }
                    }
                    return;
                }

                if (skillId === 'dopa_inheritance') {
                    if ((attacker.dopaChargeCount || 0) < 5 || !attacker.selectedInheritChar) {
                        this.log(`👑 チャージが完了していないため、王位継承を発動できません！（現在 ${attacker.dopaChargeCount || 0}/5回）`, 'text-amber-400 font-bold');
                        return;
                    }
                }

                let skill = null;


                if (skillId === 'momo_eggplant_burst') {
                    skill = {
                        id: 'momo_eggplant_burst',
                        name: '🍆 超ナスちん乱舞',
                        type: 'eggplant_burst',
                        power: 1.5,
                        isNormalAttack: false,
                        cooldown: 0
                    };
                } else if (skillId === 'asaiomizu_copied' && attacker.recordedSkill) {
                    skill = {
                        id: 'asaiomizu_copied',
                        name: `📋【コピー】${attacker.recordedSkill.name}`,
                        type: attacker.recordedSkill.type || 'attack',
                        power: attacker.recordedSkill.power || 1.0,
                        isNormalAttack: false,
                        cooldown: 0
                    };
                } else {
                    skill = attacker.skills.find(s => s.id === skillId);
                }

                if (!skill) skill = attacker.skills[0];

                if (skill.cooldown > 0 && skill.id !== 'asaiomizu_copied' && skill.id !== 'momo_eggplant_burst') {
                    attacker.cooldowns[skill.id] = skill.cooldown + 1;
                }

                this.applySkill(attacker, defender, skill);

                if (skillId === 'asaiomizu_copied') {
                    attacker.recordedSkill = null;
                }
            }

           applySkill(attacker, defender, skill) {
                this.log(`💥 ${attacker.charName} の 「${skill.name}」！`, 'text-emerald-300 font-bold');
                audioSystem.playCharacterSound(attacker.id);

               if (attacker.id === 'dopagaking' && skill.id === 'dopa_inheritance') {
                    if ((attacker.dopaChargeCount || 0) < 5 || !attacker.selectedInheritChar) {
                        this.log(`👑 チャージが完了していないか、キャラクターが選択されていません！`, 'text-amber-300 font-bold');
                        return;
                    }

                    const chosenMaster = CHARACTER_DATA[attacker.selectedInheritChar];
                    const baseNormalDmg = Math.floor(chosenMaster.atk * 1.0);
                    const inheritDmg = baseNormalDmg * 4;

                    audioSystem.playSpecial();
                    this.triggerCutin(`👑 王位継承発動！！`, `${chosenMaster.name}の力 × 4 ＝ ${inheritDmg} ダメージ！`);
                    
                    defender.hp = Math.max(0, defender.hp - inheritDmg);
                    this.log(`👑🔥 ドパガキングの「王位継承」発動！！ ${chosenMaster.name}の力を借りて ${defender.charName} に ${inheritDmg} の大ダメージを与えた！！`, 'text-amber-400 font-black text-base');
                    this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'damage', `-${inheritDmg}`);

                    // 攻撃後の状態リセット
                    attacker.dopaChargeCount = 0;
                    attacker.selectedInheritChar = null;
                    return;
                }



                if (defender.id === 'asaiomizu' && defender.digActive) {
                    if (skill.type === 'attack' || skill.type === 'special' || skill.type === 'debuff_attack' || skill.type === 'eggplant_burst' || (skill.power && skill.power > 0)) {
                        defender.recordedSkill = { ...skill };
                        defender.digActive = false;
                        this.log(`💡 ${defender.charName} は ${attacker.charName} の「${skill.name}」を記憶（コピー）した！`, 'text-cyan-300 font-bold');
                    }
                }

                if (attacker.id === 'pasha' && !attacker.isDarkMode && attacker.hp <= attacker.maxHp * 0.5) {
                    attacker.isDarkMode = true;
                    attacker.buffAtk *= 1.4;
                    this.log(`✖ パシャ僧のHPが半減！「ダークモード」発動！（攻撃力大幅UP）`, 'text-purple-400 font-bold');
                    this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', 'DARK MODE');
                }

                switch (skill.type) {
                    case 'attack':
                    case 'special':
                        this.applyDamageSkill(attacker, defender, skill);
                        break;


case 'dopa_juggler_skill':
            // 0～50の完全ランダムダメージ
            const jugglerDmg = Math.floor(Math.random() * 51);
            defender.hp = Math.max(0, defender.hp - jugglerDmg);
            this.log(`🃏 ドパガキングの「ジャグラー」！ 完全ランダムダメージ ⇒ ${defender.charName} に ${jugglerDmg} のダメージ！`, 'text-purple-300 font-bold');
            this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'damage', `-${jugglerDmg}`);
            audioSystem.playHit();
            break;

        case 'dopa_majesty_skill':
            // 70%で次の攻撃を完全に回避、30%でHP60回復
            if (Math.random() < 0.7) {
                attacker.tempEvadeNext = true;
                this.log(`👑 ${attacker.charName} の「王の威厳」！ 次の攻撃を完全に回避する構えをとった！`, 'text-amber-300 font-bold');
                this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', '完全回避構え');
                audioSystem.playBuff();
            } else {
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + 60);
                this.log(`👑 ${attacker.charName} の「王の威厳」！ ライフが 60 回復した！`, 'text-emerald-400 font-bold');
                this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'heal', '+60');
                audioSystem.playHeal();
            }
            break;

        case 'dopa_godluck_skill':
            // 95%で自分に10ダメージ、5%で相手に1000ダメージ
            if (Math.random() < 0.05) {
                defender.hp = Math.max(0, defender.hp - 1000);
                this.log(`✨⚡【神頼み 5%的中！！】 ${defender.charName} に 1000 の超絶ダメージ！！`, 'text-yellow-300 font-black font-pixel text-base');
                this.triggerCutin('⚡ 神頼み 5%的中！！', '奇跡の1000ダメージ炸裂！');
                this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'damage', '-1000');
                audioSystem.playSpecial();
            } else {
                attacker.hp = Math.max(1, attacker.hp - 10);
                this.log(`🎲 ${attacker.charName} のキャラクター「神頼み」… 運が悪く、自分に 10 のダメージを受けた！`, 'text-red-400 font-bold');
                this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'damage', '-10');
                audioSystem.playHit();
            }
            break;


                    case 'courtney_charge_release':
                        const charges = attacker.courtneyChargeCount || 0;
                        let releaseDmg = 12; // 一度もためずに解放すると弱い攻撃
                        if (charges >= 7) {
                            releaseDmg = 110; // 7回溜めると最大110ダメージ
                        } else if (charges > 0) {
                            releaseDmg = 15 + (charges * 13);
                        }

                        audioSystem.playSpecial();
                        this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'damage', `🔥 ${releaseDmg} DMG!`);
                        defender.hp = Math.max(0, defender.hp - releaseDmg);
                        this.log(`💖🔥 コートニーの 「FEEL SO HOT ///」解放！！ (溜め ${charges}回) ⇒ ${defender.charName} に ${releaseDmg} の爆発ダメージ！！`, 'text-pink-400 font-black text-base');
                        attacker.courtneyChargeCount = 0;
                        break;
                    case 'courtney_yoseru_skill':
                        let yoseruDmg = Math.max(8, Math.floor(attacker.atk * 0.9 - defender.def * 0.3));
                        defender.hp = Math.max(0, defender.hp - yoseruDmg);
                        defender.buffDef = 0.0;
                        this.log(`💋 ${attacker.charName} の「ヨセル」！ ${yoseruDmg} ダメージを与え、1ターンの間 ${defender.charName} の防御力を 0 にした！`, 'text-pink-300 font-bold');
                        this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'damage', `-${yoseruDmg}`);
                        audioSystem.playHit();
                        break;
                    case 'courtney_aegu_skill':
                        attacker.tempEvadeNext = true; // 次の相手の攻撃を必ず回避
                        const healAmtAegu = Math.floor(attacker.maxHp * 0.45); // 自身のライフを45%回復
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmtAegu);
                        this.log(`✨ ${attacker.charName} の「アエグ」！ ライフを ${healAmtAegu} (45%) 回復し、次の相手の攻撃を必ず回避する構えをとった！`, 'text-pink-300 font-bold');
                        this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'heal', `+${healAmtAegu}`);
                        audioSystem.playHeal();
                        break;
                    case 'eggplant_burst':
                        this.log(`🐘 ${attacker.charName} は全パワーを開放してナスを乱射した！！`, 'text-purple-300 font-bold');
                        this.applyDamageSkill(attacker, defender, skill);
                        attacker.isMiniZou = false;
                        attacker.eggplantReady = false;
                        this.log(`✨ ${attacker.charName} は元の姿に戻った。`, 'text-slate-400');
                        break;
                    case 'debuff_attack':
                        this.applyDamageSkill(attacker, defender, skill);
                        if (attacker.id === 'ndaihyo') {
                            defender.buffAtk *= 0.86;
                            defender.buffDef *= 0.86;
                        } else {
                            defender.buffAtk *= 0.82;
                            defender.buffDef *= 0.82;
                        }
                        this.log(`📉 ${defender.charName} の弱点を突いて攻撃力・防御力を低下させた！`, 'text-cyan-300 font-bold');
                        this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'miss', '能力DOWN');
                        audioSystem.playHit();
                        break;
                    case 'debuff':
                        if (attacker.id === 'ndaihyo') {
                            defender.buffAtk *= 0.80;
                            defender.buffDef *= 0.80;
                        } else {
                            defender.buffAtk *= 0.72;
                            defender.buffDef *= 0.72;
                        }
                        this.log(`🎯 ${attacker.charName} の頭脳戦術が炸裂！ ${defender.charName} の攻撃力と防御力をカット！`, 'text-cyan-300 font-bold');
                        this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'miss', '大幅DOWN');
                        audioSystem.playBuff();
                        break;
                    case 'heal_cleanse':
                        const hCleanseAmt = Math.floor(attacker.maxHp * (skill.healRate || 0.35));
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + hCleanseAmt);
                        attacker.buffAtk = Math.max(1.0, attacker.buffAtk);
                        attacker.buffDef = Math.max(1.0, attacker.buffDef);
                        this.log(`💚 ${attacker.charName} は集中力を高めて HP${hCleanseAmt} 回復！デバフをリセット！`, 'text-emerald-400 font-bold');
                        this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'heal', `+${hCleanseAmt}`);
                        audioSystem.playHeal();
                        break;
                    case 'dig':
                        attacker.digActive = true;
                        attacker.digUsedTurn = this.turn;
                        this.log(`🕳️ ${attacker.charName} はディグを発動！身を潜めて相手の攻撃を待ち構える！`, 'text-cyan-300 font-bold');
                        this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', 'ディグ準備');
                        break;
                    case 'heal':
                    case 'heal_club':
                        const healAmt = Math.floor(attacker.maxHp * (skill.healRate || 0.3));
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);
                        this.log(`💚 ${attacker.charName} は HPを ${healAmt} 回復！`, 'text-emerald-400');
                        this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'heal', `+${healAmt}`);
                        audioSystem.playHeal();
                        break;
                    case 'buff':
                        if (skill.buffType === 'atk') attacker.buffAtk *= skill.amount || 1.4;
                        this.log(`⚡ ${attacker.charName} の攻撃力がアップ！`, 'text-amber-300');
                        this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', '攻撃UP!');
                        audioSystem.playBuff();
                        break;
                    case 'charge':
                        attacker.isMiniZou = true;
                        attacker.eggplantReady = true;
                        this.log(`🐘 ${attacker.charName} は「ミニぞうさん」に変身し、大量のナスを蓄積した！`, 'text-purple-300 font-bold');
                        this.log(`✨ 次ターン、コマンドから「超ナスちん乱舞」が手動で発動可能！`, 'text-amber-300 font-bold');
                        this.triggerCutin('🐘 ゾウ変身＆ナス溜め完了！', '次ターン「超ナスちん乱舞」が選択可能！');
                        this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', 'ゾウ変身！');
                        audioSystem.playBuff();
                        break;
                    case 'sacrifice_buff':
                        const cost = Math.floor(attacker.hp * (skill.hpCostRate || 0.2));
                        attacker.hp = Math.max(1, attacker.hp - cost);
                        attacker.buffAtk *= 2.3;
                        this.log(`🔥 ${attacker.charName} は HPを${cost}消費し、攻撃力を2.3倍に跳ね上げた！`, 'text-red-400 font-bold');
                        this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', '攻撃2.3倍!');
                        audioSystem.playBuff();
                        break;
                    case 'defend_buff':
                        attacker.defendBuffTurns = 2;
                        this.log(`🛡️ ${attacker.charName} はゴールキーパー姿勢をとった！(2ターンの間ダメージ70%カット)`, 'text-blue-300 font-bold');
                        this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', '鉄壁ガード!');
                        audioSystem.playBuff();
                        break;
                    case 'heal_buff':
                        const hAmt = Math.floor(attacker.maxHp * (skill.healRate || 0.32));
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + hAmt);
                        attacker.buffDef *= 1.35;
                        this.log(`♨️ ${attacker.charName} は HPを${hAmt}回復し、防御力も高めた！`, 'text-emerald-300');
                        this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'heal', `+${hAmt}`);
                        audioSystem.playHeal();
                        break;
                }
            }

            applyDamageSkill(attacker, defender, skill, isCounter = false) {
                if (defender.tempEvadeNext) {
                    defender.tempEvadeNext = false;
                    this.log(`✨ ${defender.charName} は「アエグ」の効果により次の攻撃を完全に回避した！`, 'text-pink-300 font-bold');
                    this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'miss', '絶対回避!');
                    return;
                }

                if (attacker.id === 'ndaihyo' && skill.isNormalAttack && defender.id === 'pasha' && !attacker.pashaKillerUsed) {
                    attacker.pashaKillerUsed = true;
                    const killerDamage = Math.max(1, Math.floor(defender.hp * 0.5));
                    defender.hp = Math.max(0, defender.hp - killerDamage);
                    const targetSide = defender === this.p1 ? 'Player' : 'Enemy';

                    this.log(`🎯💥【パシャ僧キラー発動！！】`, 'text-yellow-300 font-black font-pixel text-sm text-center');
                    this.log(`N高代表の頭脳分析がパシャ僧の弱点を完全に見破った！ 現在HPの50% (${killerDamage} DMG) を粉砕！！`, 'text-red-400 font-bold');
                    this.triggerCutin('🎯 パシャ僧キラー発動！！', '弱点分析完了！ 現在HP 50% を粉砕！');
                    this.triggerEffect(targetSide, 'damage', `-${killerDamage} (50%)`);
                    audioSystem.playSpecial();
                    return;
                }

                const hitRate = 100 - (defender.eva || 10);
                if (Math.random() * 100 > hitRate) {
                    this.log(`🌀 ${defender.charName} は攻撃を回避した！`, 'text-sky-300');
                    this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'miss', 'MISS');
                    return;
                }

                let baseDmg = (attacker.atk * (skill.power || 1.0) * attacker.buffAtk) - (defender.def * 0.4 * defender.buffDef);
                let damage = Math.max(8, Math.floor(baseDmg + (Math.random() * 4 - 2)));

                if (defender.defendBuffTurns > 0) {
                    damage = Math.max(3, Math.floor(damage * 0.3));
                    this.log(`🛡 ${defender.charName} の鉄壁ガード！ 被ダメージ激減！`, 'text-blue-300');
                }

                if (this.isSuddenDeath) {
                    damage = Math.floor(damage * 1.35);
                }

                defender.hp = Math.max(0, defender.hp - damage);
                const side = defender === this.p1 ? 'Player' : 'Enemy';
                this.log(`⚔ ${defender.charName} に ${damage} のダメージ！${this.isSuddenDeath ? ' (🔥サドンデスUP)' : ''}`, 'text-red-400 font-bold');
                this.triggerEffect(side, 'damage', `-${damage}`);
                audioSystem.playHit();

                if (defender.hp <= 0 && defender.id === 'momo' && !defender.momoRevived) {
                    defender.momoRevived = true;
                    defender.hp = Math.floor(defender.maxHp * 0.35);
                    this.log(`✨ 桃ピンは諦めない！要塞の底力でHP ${defender.hp} で復活！！`, 'text-amber-300 font-bold');
                    this.triggerCutin('✨ ナス要塞不屈の復活！', '桃ピンは倒れない！ HP35%で復活！');
                    this.triggerEffect(side, 'heal', '不屈復活!!');
                    audioSystem.playSpecial();
                    return;
                }

                if (!isCounter && defender.id === 'asaiomizu' && skill.isNormalAttack && defender.hp > 0) {
                    this.executeCounter(defender, attacker);
                }
            }

            executeCounter(defender, attacker) {
                if (defender.hp <= 0) return;
                this.log(`⚡ ${defender.charName} のナルシストカウンター発動！`, 'text-cyan-300 font-bold');
                this.triggerCutin(`⚡ ${defender.charName} のカウンター！`, '攻撃を見切り、華麗に差し返す！');
                const counterSkill = defender.skills.find(s => s.isNormalAttack) || defender.skills[0];
                this.applyDamageSkill(defender, attacker, counterSkill, true);
            }

            async checkWinner() {
                if (this.battleEnded) return true;

                let winnerText = '';
                let isEnded = false;

                if (this.p1.hp <= 0 && this.p2.hp <= 0) {
                    winnerText = '⚔️ 引き分け！相討ちとなりました！';
                    isEnded = true;
                    this.log(winnerText, 'text-yellow-400 font-bold text-center text-sm');
                } else if (this.p2.hp <= 0) {
                    winnerText = `🎉 【${this.p1.charName}】の勝利！`;
                    isEnded = true;
                    this.log(winnerText, 'text-emerald-400 font-bold text-center text-sm');
                    audioSystem.playVictory();
                    if (!this.isOnline || this.myPlayerNum === 1) {
                        await addDopa(100);
                        this.log('🎁 勝利報酬: 100 DOPA 獲得！', 'text-amber-300 font-bold text-center');
                    }
                } else if (this.p1.hp <= 0) {
                    winnerText = `💀 【${this.p2.charName}】の勝利！`;
                    isEnded = true;
                    this.log(winnerText, 'text-red-400 font-bold text-center text-sm');
                    audioSystem.playDefeat();
                    if (this.isOnline && this.myPlayerNum === 2) {
                        await addDopa(100);
                        this.log('🎁 勝利報酬: 100 DOPA 獲得！', 'text-amber-300 font-bold text-center');
                    }
                }

                if (isEnded && !this.statsRecorded) {
                    this.statsRecorded = true;
                    this.battleEnded = true;
                    this.winnerText = winnerText;
                    this.stopTimer();

                    let result = 'draw';
                    if (this.p1.hp > 0 && this.p2.hp <= 0) {
                        result = (this.isOnline && this.myPlayerNum === 2) ? 'lose' : 'win';
                    } else if (this.p1.hp <= 0 && this.p2.hp > 0) {
                        result = (this.isOnline && this.myPlayerNum === 2) ? 'win' : 'lose';
                    } else if (this.p1.hp <= 0 && this.p2.hp <= 0) {
                        result = 'draw';
                    }

                    const oppProfile = this.latestRoomData ? (this.myPlayerNum === 1 ? this.latestRoomData.p2Profile : this.latestRoomData.p1Profile) : null;
                    const oppName = oppProfile?.playerName || oppChar.charName || '対戦相手';
                    const oppIcon = oppProfile?.selectedIcon || oppChar.id;
                    const isBot = !this.isOnline;

                    if (typeof recordBattleResult === 'function') {
                        recordBattleResult(result, myCharId, oppName, oppIcon, isBot, isBot ? null : 'online_opp', oppProfile);
                    }

                    if (this.onBattleEnd) this.onBattleEnd(winnerText);
                    return true;
                }

                return false;
            }

            endTurnPhase() {
                this.turn++;

                Object.keys(this.p1.cooldowns).forEach(key => {
                    if (this.p1.cooldowns[key] > 0) this.p1.cooldowns[key]--;
                });
                if (this.p1.defendBuffTurns > 0) this.p1.defendBuffTurns--;
                if (this.p1.buffDef < 1.0) this.p1.buffDef = 1.0;

                Object.keys(this.p2.cooldowns).forEach(key => {
                    if (this.p2.cooldowns[key] > 0) this.p2.cooldowns[key]--;
                });
                if (this.p2.defendBuffTurns > 0) this.p2.defendBuffTurns--;
                if (this.p2.buffDef < 1.0) this.p2.buffDef = 1.0;

                if (this.turn >= 30 && !this.isSuddenDeath) {
                    this.isSuddenDeath = true;
                    this.log('🔥 30ターン経過！サドンデスモード突入！（与ダメージ1.35倍）', 'text-red-500 font-black text-center');
                    this.triggerCutin('🔥 サドンデス突入！', '30ターン突破！ 全攻撃のダメージ上昇！');
                }
            }

            triggerEffect(side, type, text) {
                if (this.currentTurnLogs && this.currentTurnLogs.length > 0) {
                    this.currentTurnLogs[this.currentTurnLogs.length - 1].effect = { side, type, text };
                }
                if (this.onVisualEffect) this.onVisualEffect(side, type, text);
            }

            triggerCutin(title, subtitle) {
                if (this.currentTurnLogs && this.currentTurnLogs.length > 0) {
                    this.currentTurnLogs[this.currentTurnLogs.length - 1].cutin = { title, subtitle };
                }
                if (this.onCutin) this.onCutin(title, subtitle);
            }

            destroy() {
                this.stopTimer();
                if (this.firestoreUnsub) {
                    this.firestoreUnsub();
                    this.firestoreUnsub = null;
                    this.onlineSyncStarted = false;
                }
                if (this.heartbeatTimer) {
                    clearInterval(this.heartbeatTimer);
                    this.heartbeatTimer = null;
                }
            }
        }

        function triggerVisualEffect(side, type, text) {
            const canvasId = side === 'Player' ? 'p1-canvas' : 'p2-canvas';
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;

            const pop = document.createElement('div');
            pop.className = 'absolute font-pixel font-bold text-base sm:text-lg z-30 floating-text pointer-events-none';
            
            let color = 'text-white';
            if (type === 'damage') color = 'text-red-400 drop-shadow-[0_2px_0_rgba(0,0,0,1)]';
            else if (type === 'heal') color = 'text-emerald-400 drop-shadow-[0_2px_0_rgba(0,0,0,1)]';
            else if (type === 'buff') color = 'text-amber-300 drop-shadow-[0_2px_0_rgba(0,0,0,1)]';
            else if (type === 'miss') color = 'text-sky-300 drop-shadow-[0_2px_0_rgba(0,0,0,1)]';

            pop.classList.add(...color.split(' '));
            pop.innerText = text;
            pop.style.left = `${canvas.offsetLeft + canvas.offsetWidth / 2 - 20}px`;
            pop.style.top = `${canvas.offsetTop + 10}px`;

            canvas.parentElement.appendChild(pop);
            setTimeout(() => pop.remove(), 1100);
        }

        function triggerCutinBanner(title, subtitle) {
            const stage = document.getElementById('battle-stage');
            if (!stage) return;

            const banner = document.createElement('div');
            banner.className = 'absolute inset-x-0 top-1/3 bg-gradient-to-r from-red-950 via-amber-600 to-red-950 text-white p-3 text-center z-50 shadow-2xl border-y-4 border-amber-300 animate-cutin pointer-events-none';
            banner.innerHTML = `
                <div class="font-pixel text-yellow-300 text-lg sm:text-2xl font-black drop-shadow-[0_3px_0_rgba(0,0,0,1)] tracking-widest">${title}</div>
                <div class="text-xs sm:text-sm font-bold text-white mt-1">${subtitle}</div>
            `;
            stage.appendChild(banner);
            setTimeout(() => banner.remove(), 1700);
        }

        function renderHomeScreen() {
            if (activeBattle) {
                activeBattle.destroy();
                activeBattle = null;
            }

            const container = document.getElementById('screen-container');
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center w-full max-w-lg space-y-4 py-4 text-center">
                    <div class="pixel-box-gold p-4 bg-amber-950/80 w-full mb-2">
                        <h2 class="text-2xl sm:text-3xl font-bold text-amber-300 font-pixel mb-1">ドパガキングダム RPG</h2>
                        <p class="text-xs text-amber-200">全キャラ勝利可能な神バランス調整版 EX！</p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        <button onclick="renderCharacterSelectScreen(false)" class="pixel-btn pixel-btn-primary p-4 text-base font-bold flex flex-col items-center justify-center gap-1">
                            <span class="text-2xl">🤖</span>
                            <span>BOT対戦 (ソロ)</span>
                        </button>
                        <button onclick="renderCharacterSelectScreen(true)" class="pixel-btn pixel-btn-warning p-4 text-base font-bold flex flex-col items-center justify-center gap-1">
                            <span class="text-2xl">🌐</span>
                            <span>オンライン対戦</span>
                        </button>
                    </div>

                    <div class="grid grid-cols-3 gap-2 w-full">
                        <button onclick="openGachaModal()" class="pixel-btn pixel-btn-success p-3 text-xs font-bold flex items-center justify-center gap-1">
                            <span>🎰 ガチャ</span>
                        </button>
                        <button onclick="openCharacterListModal()" class="pixel-btn p-3 text-xs font-bold flex items-center justify-center gap-1">
                            <span>📖 図鑑</span>
                        </button>
                        <button onclick="renderOpeningScreen()" class="pixel-btn pixel-btn-purple p-3 text-xs font-bold flex items-center justify-center gap-1">
                            <span>🎬 オープニング</span>
                        </button>
                    </div>

                    <div class="pixel-box p-3 bg-slate-900 text-left w-full text-xs text-slate-300 space-y-1">
                        <p class="text-pink-400 font-bold">💖 新キャラ「コートニー」特徴:</p>
                        <p>・恋属性 / 溜め・爆発型海外ガール！バトル中の本人アイコンタップで最大8回までチャージ可能！</p>
                        <p>・「FEEL SO HOT ///」を解放して最大110ダメージの大爆発を叩き込め！</p>
                    </div>
                </div>
            `;
        }

        function renderCharacterSelectScreen(isOnline = false) {
            audioSystem.playSelect();
            const container = document.getElementById('screen-container');

            let html = `
                <div class="w-full flex flex-col items-center">
                    <h2 class="text-lg font-bold text-amber-300 font-pixel mb-3">
                        ${isOnline ? '🌐 オンライン対戦 - 自キャラ選択' : '🤖 BOT対戦 - キャラ選択'}
                    </h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full mb-4">
            `;

            Object.values(CHARACTER_DATA).forEach(c => {
                const isUnlocked = playerState.unlockedChars.includes(c.id);
                const isSelected = playerState.selectedPlayerChar === c.id;

                html += `
                    <div onclick="${isUnlocked ? `selectChar('${c.id}',${isOnline})` : `openCharDetail('${c.id}')`}" 
                         class="pixel-box p-2 bg-slate-900 cursor-pointer flex flex-col items-center justify-between border-2 transition-all ${isSelected ? 'border-amber-400 bg-amber-950/40 scale-105' : 'border-slate-700 hover:border-slate-400'} ${!isUnlocked ? 'opacity-60' : ''}">
                        <canvas id="select-cvs-${c.id}" width="70" height="70" class="pixel-box bg-slate-950 mb-1"></canvas>
                        <span class="text-xs font-bold ${isSelected ? 'text-amber-300 font-pixel' : 'text-slate-200'}">${c.name}</span>
                        <span class="text-[10px] text-slate-400">${c.title}</span>
                        ${!isUnlocked ? '<span class="text-[10px] text-red-400 font-bold mt-1">🔒 未解放</span>' : ''}
                    </div>
                `;
            });

            html += `
                    </div>
                    <div id="char-detail-box" class="pixel-box p-3 bg-slate-900 w-full mb-4 text-xs text-slate-300"></div>
                    <div class="flex gap-3">
                        <button onclick="renderHomeScreen()" class="pixel-btn px-4 py-2 text-xs">戻る</button>
                        <button onclick="${isOnline ? 'openOnlineLobby()' : 'startBotBattle()'}" class="pixel-btn pixel-btn-primary px-6 py-2 text-sm font-bold">
                            ${isOnline ? 'ロビーへ進む 🚀' : '対戦開始！ ⚔'}
                        </button>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            setTimeout(() => {
                Object.keys(CHARACTER_DATA).forEach(id => {
                    const cvs = document.getElementById(`select-cvs-${id}`);
                    if (cvs) CharacterRenderer.drawCharacter(cvs, id);
                });
                updateCharDetailBox();
            }, 50);
        }

        function selectChar(id, isOnline) {
            audioSystem.playSelect();
            playerState.selectedPlayerChar = id;
            renderCharacterSelectScreen(isOnline);
        }

        function updateCharDetailBox() {
            const id = playerState.selectedPlayerChar;
            const c = CHARACTER_DATA[id];
            const box = document.getElementById('char-detail-box');
            if (box && c) {
                box.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-amber-300 text-sm">${c.name} (${c.title})</span>
                        <span class="text-emerald-400 font-mono">HP:${c.hp} / 攻:${c.atk} / 防:${c.def} / 速:${c.spd} / 避:${c.eva}%</span>
                    </div>
                    <p class="text-slate-300 mb-1">${c.desc}</p>
                    <div class="text-[11px] text-amber-200 font-mono">
                        技: ${c.skills.map(s => s.name).join(' / ')}
                    </div>
                `;
            }
        }

        function startBotBattle() {
            audioSystem.playSelect();
            const ids = Object.keys(CHARACTER_DATA);
            const enemyId = ids[Math.floor(Math.random() * ids.length)];
            playerState.selectedEnemyChar = enemyId;
            launchBattle(playerState.selectedPlayerChar, enemyId, false);
        }

        function openOnlineLobby() {
            audioSystem.playSelect();
            renderOnlineLobbyScreen();
        }

        function renderOnlineLobbyScreen() {
            const container = document.getElementById('screen-container');
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center w-full max-w-md space-y-4 py-4">
                    <h2 class="text-lg font-bold text-amber-300 font-pixel">🌐 オンラインロビー</h2>
                    <div class="pixel-box p-4 bg-slate-900 w-full space-y-3">
                        <p class="text-xs text-slate-300">部屋を作成するか、ルームIDを入力して参加してください。</p>
                        <div class="flex gap-2">
                            <input id="room-id-input" type="text" placeholder="ルームID (例: 1234)" class="pixel-box bg-slate-950 px-3 py-2 text-sm font-mono w-full text-white border-slate-700 focus:border-amber-400 outline-none">
                            <button onclick="joinOnlineRoom()" class="pixel-btn pixel-btn-success text-xs px-4 py-2 font-bold whitespace-nowrap">参加</button>
                        </div>
                        <div class="relative flex py-1 items-center">
                            <div class="flex-grow border-t border-slate-700"></div>
                            <span class="flex-shrink mx-2 text-slate-500 text-xs">または</span>
                            <div class="flex-grow border-t border-slate-700"></div>
                        </div>
                        <button onclick="createOnlineRoom()" class="pixel-btn pixel-btn-primary w-full py-2 text-sm font-bold">新規ルーム作成 🎲</button>
                    </div>
                    <div id="lobby-status" class="text-xs text-amber-300 font-mono min-h-[20px] text-center"></div>
                    <button onclick="renderCharacterSelectScreen(true)" class="pixel-btn text-xs px-4 py-2">戻る</button>
                </div>
            `;
        }

        async function createOnlineRoom() {
            audioSystem.playSelect();
            const status = document.getElementById('lobby-status');
            if (status) status.innerText = '接続中...';

            const ready = await window.initFirebaseOnline();
            if (!ready) {
                if (status) status.innerText = '通信エラー: オフラインモードに切り替えます。';
                setTimeout(() => startBotBattle(), 1000);
                return;
            }

            const roomId = Math.floor(1000 + Math.random() * 9000).toString();
            const roomRef = window.fbDoc(window.fbDb, 'artifacts', window.fbAppId, 'public', 'data', 'rooms', roomId);

            try {
                await window.fbSetDoc(roomRef, {
                    roomId: roomId,
                    p1Char: playerState.selectedPlayerChar,
                    p1Profile: getMyProfileSnapshot(),
                    p2Char: null,
                    p2Profile: null,
                    p1Action: null,
                    p2Action: null,
                    status: 'waiting',
                    createdAt: Date.now(),
                    p1LastSeen: Date.now()
                });

                if (status) status.innerText = `ルーム作成成功！ ID: [ ${roomId} ] 相手の参加を待っています...`;

                const unsub = window.fbOnSnapshot(roomRef, (snapshot) => {
                    const data = snapshot.data();
                    if (data && data.status === 'playing' && data.p2Char) {
                        unsub();
                        launchBattle(data.p1Char, data.p2Char, true, 1, roomId);
                    }
                }, (err) => console.error(err));

            } catch (e) {
                console.error(e);
                if (status) status.innerText = 'ルーム作成エラー';
            }
        }

        async function joinOnlineRoom() {
            audioSystem.playSelect();
            const input = document.getElementById('room-id-input');
            const status = document.getElementById('lobby-status');
            const roomId = input ? input.value.trim() : '';

            if (!roomId) {
                if (status) status.innerText = 'ルームIDを入力してください。';
                return;
            }

            if (status) status.innerText = '接続中...';

            const ready = await window.initFirebaseOnline();
            if (!ready) {
                if (status) status.innerText = '通信エラー';
                return;
            }

            const roomRef = window.fbDoc(window.fbDb, 'artifacts', window.fbAppId, 'public', 'data', 'rooms', roomId);
            try {
                const snap = await window.fbGetDoc(roomRef);
                if (!snap.exists()) {
                    if (status) status.innerText = '指定されたルームが存在しません。';
                    return;
                }

                await window.fbUpdateDoc(roomRef, {
                    p2Char: playerState.selectedPlayerChar,
                    p2Profile: getMyProfileSnapshot(),
                    status: 'playing',
                    p2LastSeen: Date.now()
                });

                if (status) status.innerText = '対戦を開始します！';
                const data = snap.data();
                launchBattle(data.p1Char, playerState.selectedPlayerChar, true, 2, roomId);

            } catch (e) {
                console.error(e);
                if (status) status.innerText = '参加エラー';
            }
        }

        function launchBattle(p1Id, p2Id, isOnline = false, myPlayerNum = 1, roomId = null) {
            if (activeBattle) {
                activeBattle.destroy();
                activeBattle = null;
            }

            const container = document.getElementById('screen-container');
            container.innerHTML = `
                <div id="battle-stage" class="w-full flex flex-col items-center relative transition-colors duration-200">
                    <div class="w-full grid grid-cols-2 gap-3 mb-2">
                        <div id="p1-box-container" class="pixel-box p-2 bg-slate-900/90 relative border-blue-500 ring-2 ring-blue-500/50">
                            <div class="flex justify-between items-center mb-1">
                                <span id="p1-name-label" class="font-bold text-xs sm:text-sm text-blue-300 font-pixel">自分</span>
                                <span id="p1-hp-text" class="text-xs font-mono font-bold text-slate-200">100/100</span>
                            </div>
                            <div class="w-full bg-slate-950 h-3 rounded-sm border border-slate-700 overflow-hidden p-0.5">
                                <div id="p1-hp-bar" class="hp-bar-fill h-full bg-emerald-500 rounded-sm" style="width: 100%;"></div>
                            </div>
                        </div>
                        <div id="p2-box-container" class="pixel-box p-2 bg-slate-900/90 relative border-red-500 ring-2 ring-red-500/50">
                            <div class="flex justify-between items-center mb-1">
                                <span id="p2-name-label" class="font-bold text-xs sm:text-sm text-red-300 font-pixel">相手</span>
                                <span id="p2-hp-text" class="text-xs font-mono font-bold text-slate-200">100/100</span>
                            </div>
                            <div class="w-full bg-slate-950 h-3 rounded-sm border border-slate-700 overflow-hidden p-0.5">
                                <div id="p2-hp-bar" class="hp-bar-fill h-full bg-emerald-500 rounded-sm" style="width: 100%;"></div>
                            </div>
                        </div>
                    </div>


                    <div class="w-full grid grid-cols-2 gap-4 my-1 relative items-center justify-items-center">
                        <div class="relative flex flex-col items-center w-full">
                            <div class="absolute -top-3 z-10 bg-blue-600 text-white font-pixel text-[10px] px-2 py-0.5 rounded border border-blue-300 shadow">YOU (自分)</div>
                            <canvas id="p1-canvas" width="110" height="110" class="pixel-box bg-slate-950 shadow-lg cursor-pointer border-2 border-blue-500 mt-2" title="自分のキャラクター"></canvas>
                        </div>
                        <div class="relative flex flex-col items-center w-full">
                            <div class="absolute -top-3 z-10 bg-red-600 text-white font-pixel text-[10px] px-2 py-0.5 rounded border border-red-300 shadow">OPPONENT (相手)</div>
                            <canvas id="p2-canvas" width="110" height="110" class="pixel-box bg-slate-950 shadow-lg border-2 border-red-500 mt-2" title="対戦相手のキャラクター"></canvas>
                        </div>
                    </div>

                    <div class="my-1 flex items-center justify-between w-full px-2">
                        <button onclick="confirmRetireBattle()" class="pixel-btn pixel-btn-danger text-xs px-2 py-1 flex items-center gap-1 font-bold">
                            <span>🏳️ 降参する</span>
                        </button>
                        <div class="flex items-center justify-center gap-1">
                            <span class="text-xs font-bold text-slate-400">制限時間:</span>
                            <span id="turn-timer-display" class="font-pixel text-lg font-bold text-amber-400">15</span>
                            <span class="text-xs text-slate-400">秒</span>
                        </div>
                        <div class="w-16"></div>
                    </div>

                    <div id="battle-log-box" class="pixel-box p-2 bg-slate-950 w-full h-20 overflow-y-auto my-1 text-xs font-mono space-y-1 border-slate-700">
                    </div>

                    <div id="command-panel" class="w-full mt-1">
                        <div id="skill-buttons-grid" class="grid grid-cols-2 gap-2">
                        </div>
                    </div>

                    <div id="battle-footer-actions" class="mt-3 flex justify-center hidden">
                        <button onclick="renderHomeScreen()" class="pixel-btn pixel-btn-primary px-8 py-2 font-pixel text-sm">ホームに戻る</button>
                    </div>
                </div>
            `;

            activeBattle = new BattleEngine(p1Id, p2Id, isOnline, myPlayerNum, roomId);

            activeBattle.onLogUpdate = (msg, colorClass) => {
                const logBox = document.getElementById('battle-log-box');
                if (logBox) {
                    const line = document.createElement('div');
                    line.className = colorClass || 'text-slate-200';
                    line.innerHTML = msg;
                    logBox.appendChild(line);
                    logBox.scrollTop = logBox.scrollHeight;
                }
            };

            activeBattle.onTimerUpdate = (sec) => {
                const timerEl = document.getElementById('turn-timer-display');
                if (timerEl) {
                    timerEl.innerText = sec;
                    if (sec <= 5) timerEl.className = 'font-pixel text-lg font-bold text-red-500 animate-ping';
                    else timerEl.className = 'font-pixel text-lg font-bold text-amber-400';
                }
            };

            activeBattle.onStateChange = (engine) => {
                updateBattleUI();
            };

            activeBattle.onVisualEffect = (side, type, text) => {
                triggerVisualEffect(side, type, text);
            };

            activeBattle.onCutin = (title, subtitle) => {
                triggerCutinBanner(title, subtitle);
            };

            activeBattle.onBattleEnd = (winner) => {
                const footer = document.getElementById('battle-footer-actions');
                if (footer) footer.classList.remove('hidden');
                updateBattleUI();
            };

            activeBattle.startBattle();
            updateBattleUI();
        }

        function updateBattleUI() {
            if (!activeBattle) return;

            const p1 = activeBattle.p1;
            const p2 = activeBattle.p2;

            const p1Label = document.getElementById('p1-name-label');
            const p2Label = document.getElementById('p2-name-label');
            const p1HpText = document.getElementById('p1-hp-text');
            const p2HpText = document.getElementById('p2-hp-text');
            const p1HpBar = document.getElementById('p1-hp-bar');
            const p2HpBar = document.getElementById('p2-hp-bar');

            let p1StatusExtra = p1.digActive ? ' (ディグ中)' : (p1.isResting ? ' (休み)' : (p1.eggplantReady ? ' (ゾウ変身中)' : (p1.id === 'courtney' && p1.courtneyChargeCount > 0 ? ` (溜め:${p1.courtneyChargeCount}回)` : (p1.defendBuffTurns > 0 ? ' (鉄壁)' : ''))));
            let p2StatusExtra = p2.digActive ? ' (ディグ中)' : (p2.isResting ? ' (休み)' : (p2.eggplantReady ? ' (ゾウ変身中)' : (p2.id === 'courtney' && p2.courtneyChargeCount > 0 ? ` (溜め:${p2.courtneyChargeCount}回)` : (p2.defendBuffTurns > 0 ? ' (鉄壁)' : ''))));

            if (p1Label) p1Label.innerText = `${p1.charName}${p1StatusExtra}`;
            if (p2Label) p2Label.innerText = `${p2.charName}${p2StatusExtra}`;

            if (p1HpText) p1HpText.innerText = `${p1.hp}/${p1.maxHp}`;
            if (p2HpText) p2HpText.innerText = `${p2.hp}/${p2.maxHp}`;

            if (p1HpBar) {
                const pct1 = Math.max(0, Math.min(100, (p1.hp / p1.maxHp) * 100));
                p1HpBar.style.width = `${pct1}%`;
                p1HpBar.className = `hp-bar-fill h-full rounded-sm ${pct1 > 50 ? 'bg-emerald-500' : pct1 > 20 ? 'bg-amber-500' : 'bg-red-500'}`;
            }

            if (p2HpBar) {
                const pct2 = Math.max(0, Math.min(100, (p2.hp / p2.maxHp) * 100));
                p2HpBar.style.width = `${pct2}%`;
                p2HpBar.className = `hp-bar-fill h-full rounded-sm ${pct2 > 50 ? 'bg-emerald-500' : pct2 > 20 ? 'bg-amber-500' : 'bg-red-500'}`;
            }

            const p1Cvs = document.getElementById('p1-canvas');
            const p2Cvs = document.getElementById('p2-canvas');

            if (p1Cvs) {
                if (p1.id === 'dopagaking' && (p1.dopaChargeCount || 0) > 0 && (p1.dopaChargeCount || 0) < 5) {
                    const ctx = p1Cvs.getContext('2d');
                    ctx.clearRect(0, 0, p1Cvs.width, p1Cvs.height);
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(0, 0, p1Cvs.width, p1Cvs.height);
                    const pixelSize = Math.max(2, Math.floor(p1Cvs.width / 32));
                    const offsetX = Math.floor((p1Cvs.width - 32 * pixelSize) / 2);
                    const offsetY = Math.floor((p1Cvs.height - 32 * pixelSize) / 2);
                    const drawPx = (x, y, color, sizeX = 1, sizeY = 1) => {
                        ctx.fillStyle = color;
                        ctx.fillRect(offsetX + x * pixelSize, offsetY + y * pixelSize, sizeX * pixelSize, sizeY * pixelSize);
                    };
                    CharacterRenderer.drawCrown(drawPx);
                } else if (p1.id === 'dopagaking' && (p1.dopaChargeCount || 0) >= 5 && p1.selectedInheritChar) {
                    CharacterRenderer.drawCharacter(p1Cvs, p1.selectedInheritChar, false);
                } else if (p1.id === 'courtney' && (p1.courtneyChargeCount || 0) > 0) {
                    p1Cvs.classList.add('animate-courtney-shake');
                    const ctx = p1Cvs.getContext('2d');
                    ctx.clearRect(0, 0, p1Cvs.width, p1Cvs.height);
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(0, 0, p1Cvs.width, p1Cvs.height);
                    const pixelSize = Math.max(2, Math.floor(p1Cvs.width / 32));
                    const offsetX = Math.floor((p1Cvs.width - 32 * pixelSize) / 2);
                    const offsetY = Math.floor((p1Cvs.height - 32 * pixelSize) / 2);
                    const drawPx = (x, y, color, sizeX = 1, sizeY = 1) => {
                        ctx.fillStyle = color;
                        ctx.fillRect(offsetX + x * pixelSize, offsetY + y * pixelSize, sizeX * pixelSize, sizeY * pixelSize);
                    };
                    CharacterRenderer.drawCourtneyCharged(drawPx);
                } else if (p1.id === 'pasha' && p1.isDarkMode) {
                    p1Cvs.classList.remove('animate-courtney-shake');
                    CharacterRenderer.drawCharacter(p1Cvs, 'pasha_dark', p1.isMiniZou);
                } else {
                    p1Cvs.classList.remove('animate-courtney-shake');
                    CharacterRenderer.drawCharacter(p1Cvs, p1.id, p1.isMiniZou);
                }
            }

            if (p2Cvs) {
                if (p2.id === 'dopagaking' && (p2.dopaChargeCount || 0) > 0 && (p2.dopaChargeCount || 0) < 5) {
                    const ctx = p2Cvs.getContext('2d');
                    ctx.clearRect(0, 0, p2Cvs.width, p2Cvs.height);
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(0, 0, p2Cvs.width, p2Cvs.height);
                    const pixelSize = Math.max(2, Math.floor(p2Cvs.width / 32));
                    const offsetX = Math.floor((p2Cvs.width - 32 * pixelSize) / 2);
                    const offsetY = Math.floor((p2Cvs.height - 32 * pixelSize) / 2);
                    const drawPx = (x, y, color, sizeX = 1, sizeY = 1) => {
                        ctx.fillStyle = color;
                        ctx.fillRect(offsetX + x * pixelSize, offsetY + y * pixelSize, sizeX * pixelSize, sizeY * pixelSize);
                    };
                    CharacterRenderer.drawCrown(drawPx);
                } else if (p2.id === 'dopagaking' && (p2.dopaChargeCount || 0) >= 5 && p2.selectedInheritChar) {
                    CharacterRenderer.drawCharacter(p2Cvs, p2.selectedInheritChar, false);
                } else if (p2.id === 'courtney' && (p2.courtneyChargeCount || 0) > 0) {
                    p2Cvs.classList.add('animate-courtney-shake');
                    const ctx = p2Cvs.getContext('2d');
                    ctx.clearRect(0, 0, p2Cvs.width, p2Cvs.height);
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(0, 0, p2Cvs.width, p2Cvs.height);
                    const pixelSize = Math.max(2, Math.floor(p2Cvs.width / 32));
                    const offsetX = Math.floor((p2Cvs.width - 32 * pixelSize) / 2);
                    const offsetY = Math.floor((p2Cvs.height - 32 * pixelSize) / 2);
                    const drawPx = (x, y, color, sizeX = 1, sizeY = 1) => {
                        ctx.fillStyle = color;
                        ctx.fillRect(offsetX + x * pixelSize, offsetY + y * pixelSize, sizeX * pixelSize, sizeY * pixelSize);
                    };
                    CharacterRenderer.drawCourtneyCharged(drawPx);
                } else if (p2.id === 'pasha' && p2.isDarkMode) {
                    p2Cvs.classList.remove('animate-courtney-shake');
                    CharacterRenderer.drawCharacter(p2Cvs, 'pasha_dark', p2.isMiniZou);
                } else {
                    p2Cvs.classList.remove('animate-courtney-shake');
                    CharacterRenderer.drawCharacter(p2Cvs, p2.id, p2.isMiniZou);
                }
            }

         const myActiveChar = activeBattle.myPlayerNum === 1 ? p1 : p2;
         const myCvs = activeBattle.myPlayerNum === 1 ? p1Cvs : p2Cvs;

         if (myCvs && myActiveChar.id === 'courtney') {
             myCvs.onclick = () => {
                 if (activeBattle.battleEnded || activeBattle.waitingForOpponent || myActiveChar.isResting) return;
                 if (activeBattle.isOnline && activeBattle.myPlayerNum !== 1 && activeBattle.isOnline && activeBattle.myPlayerNum !== 2) return;

                 if ((myActiveChar.courtneyChargeCount || 0) < 8) {
                     myActiveChar.courtneyChargeCount++;
                     audioSystem.playBuff();
                     activeBattle.submitAction(activeBattle.myPlayerNum, 'courtney_charge_only');
                 } else {
                     showModal("MAXチャージ", "これ以上溜められません！スキルから「FEEL SO HOT ///」を選択して解放してください！");
                 }
             };
         } else if (myCvs && myActiveChar.id === 'dopagaking') {
             myCvs.onclick = () => {
                 if (activeBattle.battleEnded || activeBattle.waitingForOpponent || myActiveChar.isResting) return;
                 if (activeBattle.isOnline && activeBattle.myPlayerNum !== 1 && activeBattle.myPlayerNum !== 2) return;
                 if ((myActiveChar.dopaChargeCount || 0) >= 5) return;

                 activeBattle.submitAction(activeBattle.myPlayerNum, 'dopa_charge_step');
             };
         }


            const grid = document.getElementById('skill-buttons-grid');
            if (!grid) return;

            grid.innerHTML = '';

            const activePlayer = activeBattle.myPlayerNum === 1 ? p1 : p2;
            const isMyTurnBlocked = activeBattle.battleEnded || activeBattle.waitingForOpponent || activePlayer.isResting;

            if (activePlayer.eggplantReady) {
                const btn = document.createElement('button');
                btn.className = `pixel-btn pixel-btn-purple p-3 font-bold text-xs flex flex-col items-center col-span-2 ${isMyTurnBlocked ? 'pixel-btn-disabled' : ''}`;
                btn.innerHTML = `<span class="text-sm font-pixel">🍆 超ナスちん乱舞</span><span class="text-[10px] text-amber-200">蓄積したナスを一気に全弾乱射！</span>`;
                btn.disabled = isMyTurnBlocked;
                btn.onclick = () => activeBattle.submitAction(activeBattle.myPlayerNum, 'momo_eggplant_burst');
                grid.appendChild(btn);
                return;
            }

            if (activePlayer.recordedSkill) {
                const btn = document.createElement('button');
                btn.className = `pixel-btn pixel-btn-success p-3 font-bold text-xs flex flex-col items-center col-span-2 ${isMyTurnBlocked ? 'pixel-btn-disabled' : ''}`;
                btn.innerHTML = `<span class="text-sm font-pixel">📋【コピー発動】${activePlayer.recordedSkill.name}</span><span class="text-[10px] text-amber-200">記憶した技をそのまま相手に撃ち返す！</span>`;
                btn.disabled = isMyTurnBlocked;
                btn.onclick = () => activeBattle.submitAction(activeBattle.myPlayerNum, 'asaiomizu_copied');
                grid.appendChild(btn);
                return;
            }

           activePlayer.skills.forEach(s => {
                const cd = activePlayer.cooldowns[s.id] || 0;
                const isCd = cd > 0;
                let isSkillLocked = isCd;

                // ドパガキングの「王位継承」はチャージが5回に達するまで強制的に無効化する
                if (activePlayer.id === 'dopagaking' && s.id === 'dopa_inheritance') {
                    if ((activePlayer.dopaChargeCount || 0) < 5) {
                        isSkillLocked = true;
                    }
                }

                const disabled = isMyTurnBlocked || isSkillLocked;

                const btn = document.createElement('button');
                btn.className = `pixel-btn p-2 text-xs font-bold flex flex-col items-center justify-center ${disabled ? 'pixel-btn-disabled' : 'pixel-btn-primary'}`;
                btn.disabled = disabled;

                let extraBadge = '';
                if (s.id === 'courtney_feel') {
                    extraBadge = ` (溜め: ${activePlayer.courtneyChargeCount || 0}/8)`;
                }

                btn.innerHTML = `
                    <span class="font-pixel text-xs mb-0.5">${s.name}${extraBadge} ${isCd ? `(CT:${cd})` : ''}</span>
                    <span class="text-[10px] text-slate-300 font-mono truncate max-w-full">${s.desc}</span>
                `;
                btn.onclick = () => activeBattle.submitAction(activeBattle.myPlayerNum, s.id);
                grid.appendChild(btn);
            });

            if (activeBattle.waitingForOpponent) {
                const logBox = document.getElementById('battle-log-box');
                if (logBox && !document.getElementById('waiting-msg')) {
                    const waitLine = document.createElement('div');
                    waitLine.id = 'waiting-msg';
                    waitLine.className = 'text-amber-300 font-bold animate-pulse';
                    waitLine.innerText = '⏳ 相手の行動を待っています...';
                    logBox.appendChild(waitLine);
                    logBox.scrollTop = logBox.scrollHeight;
                }
            }
        }

        window.addEventListener('DOMContentLoaded', async () => {
            await loadPlayerState();
            renderOpeningScreen();
        });

        function openProfileScreen() {
            audioSystem.playSelect();
            const container = document.getElementById('screen-container');
            
            const winRate = playerState.totalBattles > 0 ? ((playerState.wins / playerState.totalBattles) * 100).toFixed(1) : 0;
            
            let usageHtml = '';
            const totalChoices = Object.values(playerState.charUsage).reduce((a, b) => a + b, 0);
            if (totalChoices === 0) {
                usageHtml = `<p class="text-slate-400 text-xs">使用記録なし</p>`;
            } else {
                usageHtml = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">`;
                Object.entries(playerState.charUsage).forEach(([cId, count]) => {
                    const cData = CHARACTER_DATA[cId] || { name: cId };
                    const rate = ((count / totalChoices) * 100).toFixed(1);
                    usageHtml += `
                        <div class="pixel-box p-2 bg-slate-900 flex items-center justify-between text-xs">
                            <div class="flex items-center gap-2">
                                <canvas id="usage-cvs-${cId}" width="36" height="36" class="pixel-box bg-slate-950 rounded"></canvas>
                                <div>
                                    <b class="text-amber-300">${cData.name}</b>
                                    <div class="text-[10px] text-slate-400">使用回数: ${count}回</div>
                                </div>
                            </div>
                            <span class="text-emerald-400 font-bold font-mono">${rate}%</span>
                        </div>
                    `;
                });
                usageHtml += `</div>`;
            }

            let historyHtml = '';
            if (playerState.battleHistory.length === 0) {
                historyHtml = `<p class="text-slate-400 text-xs text-center py-4">対戦記録はありません</p>`;
            } else {
                historyHtml = `<div class="space-y-2 max-h-60 overflow-y-auto pr-1">`;
                playerState.battleHistory.forEach((h, idx) => {
                    let resultBadge = h.result === 'win' ? '<span class="text-emerald-400 font-bold">勝利</span>' : (h.result === 'lose' ? '<span class="text-red-400 font-bold">敗北</span>' : '<span class="text-yellow-400 font-bold">引き分け</span>');
                    let opponentDisplay = h.isBot ? `<span class="text-purple-300">[BOT] ${h.opponentName}</span>` : `<button onclick="openOpponentProfileModal(${idx})" class="text-cyan-300 underline font-bold hover:text-cyan-200">[対戦相手] ${h.opponentName}</button>`;
                    
                    historyHtml += `
                        <div class="pixel-box p-2.5 bg-slate-950 flex items-center justify-between text-xs">
                            <div class="space-y-0.5">
                                <div class="flex items-center gap-2">
                                    ${resultBadge}
                                    <span class="text-slate-400 text-[10px]">${h.date}</span>
                                </div>
                                <div class="text-slate-200">
                                    使用: <b class="text-amber-300">${(CHARACTER_DATA[h.myChar] || {}).name || h.myChar}</b> VS ${opponentDisplay}
                                </div>
                            </div>
                        </div>
                    `;
                });
                historyHtml += `</div>`;
            }

            container.innerHTML = `
                <div class="flex flex-col items-center justify-center w-full max-w-xl space-y-4 py-4 px-2">
                    <h2 class="text-xl font-bold text-amber-300 font-pixel">👑 プレイヤープロフィール</h2>
                    
                    <div class="pixel-box-gold p-4 bg-amber-950/80 w-full space-y-3">
                        <div class="flex items-center justify-between flex-wrap gap-3">
                            <div class="flex items-center gap-3">
                                <canvas id="profile-main-icon" width="60" height="60" class="pixel-box bg-slate-950 rounded cursor-pointer border-amber-400" onclick="openIconSelectModal()" title="クリックしてアイコン変更"></canvas>
                                <div>
                                    <div class="flex items-center gap-2 mb-1">
                                        <input id="profile-name-input" type="text" value="${playerState.playerName || ''}" maxlength="12" class="pixel-box bg-slate-950 px-2 py-1 text-sm font-bold text-amber-300 w-36 outline-none border-amber-600">
                                        <button onclick="savePlayerName()" class="pixel-btn pixel-btn-primary px-3 py-1 text-xs font-bold">変更</button>
                                    </div>
                                    <span class="text-[10px] text-slate-300">アイコンクリックで変更可能</span>
                                </div>
                            </div>
                            <div class="text-right font-mono">
                                <div class="text-xs text-amber-200">所持 DOPA</div>
                                <div class="text-lg font-bold text-amber-400 font-pixel">${playerState.dopa}</div>
                            </div>
                        </div>

                        <div class="grid grid-cols-4 gap-2 pt-2 border-t border-amber-800 text-center font-mono text-xs">
                            <div class="bg-slate-950 p-2 rounded">
                                <div class="text-slate-400 text-[10px]">総対戦</div>
                                <div class="text-amber-300 font-bold">${playerState.totalBattles}</div>
                            </div>
                            <div class="bg-slate-950 p-2 rounded">
                                <div class="text-slate-400 text-[10px]">勝利</div>
                                <div class="text-emerald-400 font-bold">${playerState.wins}</div>
                            </div>
                            <div class="bg-slate-950 p-2 rounded">
                                <div class="text-slate-400 text-[10px]">敗北</div>
                                <div class="text-red-400 font-bold">${playerState.losses}</div>
                            </div>
                            <div class="bg-slate-950 p-2 rounded">
                                <div class="text-slate-400 text-[10px]">勝率</div>
                                <div class="text-cyan-400 font-bold">${winRate}%</div>
                            </div>
                        </div>
                    </div>

                    <div class="pixel-box p-3 bg-slate-900 w-full space-y-2">
                        <h3 class="text-xs font-bold text-amber-300 font-pixel">📊 キャラクター使用率</h3>
                        ${usageHtml}
                    </div>

                    <div class="pixel-box p-3 bg-slate-900 w-full space-y-2">
                        <h3 class="text-xs font-bold text-amber-300 font-pixel">📜 過去の戦歴 (最大50件)</h3>
                        ${historyHtml}
                    </div>

                    <button onclick="renderHomeScreen()" class="pixel-btn px-6 py-2 text-xs font-bold">ホームに戻る</button>
                </div>
            `;

            setTimeout(() => {
                const mainIconCvs = document.getElementById('profile-main-icon');
                if (mainIconCvs) CharacterRenderer.drawCharacter(mainIconCvs, playerState.selectedIcon || 'courtney');

                Object.keys(playerState.charUsage).forEach(cId => {
                    const uCvs = document.getElementById(`usage-cvs-${cId}`);
                    if (uCvs) CharacterRenderer.drawCharacter(uCvs, cId);
                });
            }, 50);
        }

        function savePlayerName() {
            audioSystem.playSelect();
            const input = document.getElementById('profile-name-input');
            if (!input) return;
            const newName = input.value.trim();
            if (!newName) {
                showModal("エラー", "ファイター名を入力してください！");
                return;
            }
            if (newName.length > 12) {
                showModal("エラー", "ファイター名は12文字以内で入力してください！");
                return;
            }
            playerState.playerName = newName;
            savePlayerState();
            updateHeaderProfile();
            showModal("保存完了", `ファイター名を「${newName}」に更新しました！`);
        }

        function openIconSelectModal() {
            audioSystem.playSelect();
            let html = `
                <div class="text-center space-y-3">
                    <p class="text-xs text-slate-300">アイコンに設定するキャラクターを選んでください。</p>
                    <div class="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
            `;

            Object.values(CHARACTER_DATA).forEach(c => {
                const isUnlocked = playerState.unlockedChars.includes(c.id);
                const isSelected = playerState.selectedIcon === c.id;
                if (!isUnlocked) return;

                html += `
                    <div onclick="setProfileIcon('${c.id}')" class="pixel-box p-2 bg-slate-950 cursor-pointer flex flex-col items-center justify-center border-2 ${isSelected ? 'border-amber-400 bg-amber-950/40' : 'border-slate-700 hover:border-slate-400'}">
                        <canvas id="icon-sel-cvs-${c.id}" width="50" height="50" class="pixel-box bg-slate-900 mb-1"></canvas>
                        <span class="text-[11px] font-bold text-slate-200 truncate max-w-full">${c.name}</span>
                    </div>
                `;
            });

            html += `</div></div>`;
            showModal("アイコン選択", html);

            setTimeout(() => {
                Object.values(CHARACTER_DATA).forEach(c => {
                    if (playerState.unlockedChars.includes(c.id)) {
                        const cvs = document.getElementById(`icon-sel-cvs-${c.id}`);
                        if (cvs) CharacterRenderer.drawCharacter(cvs, c.id);
                    }
                });
            }, 50);
        }

        function setProfileIcon(charId) {
            audioSystem.playSelect();
            playerState.selectedIcon = charId;
            savePlayerState();
            updateHeaderProfile();
            closeModal();
            openProfileScreen();
        }

        function openOpponentProfileModal(historyIndex) {
            audioSystem.playSelect();
            const h = playerState.battleHistory[historyIndex];
            if (!h || h.isBot) return;

            const p = h.opponentProfile;
            let usageHtml = '';
            if (p && p.charUsage && Object.keys(p.charUsage).length > 0) {
                const totalC = Object.values(p.charUsage).reduce((a, b) => a + b, 0);
                usageHtml = `<div class="pixel-box p-3 bg-slate-900 w-full space-y-1 text-left"><h4 class="text-xs font-bold text-amber-300 font-pixel mb-1">📊 相手の使用キャラ傾向</h4><div class="space-y-1 max-h-36 overflow-y-auto pr-1">`;
                Object.entries(p.charUsage).forEach(([cId, cnt]) => {
                    const cData = CHARACTER_DATA[cId] || { name: cId };
                    const pct = totalC > 0 ? ((cnt / totalC) * 100).toFixed(1) : 0;
                    usageHtml += `
                        <div class="bg-slate-950 p-1.5 rounded flex items-center justify-between text-xs font-mono">
                            <span class="text-slate-200">${cData.name} (${cnt}回)</span>
                            <span class="text-emerald-400 font-bold">${pct}%</span>
                        </div>
                    `;
                });
                usageHtml += `</div></div>`;
            } else {
                usageHtml = `<div class="pixel-box p-3 bg-slate-900 w-full text-xs text-slate-400 font-mono">使用キャラクター記録なし</div>`;
            }

            let oppWinRate = p && p.totalBattles > 0 ? ((p.wins / p.totalBattles) * 100).toFixed(1) : (p?.winRate || 0);
            let oppBattles = p ? p.totalBattles : '非公開';
            let oppWins = p ? p.wins : '非公開';
            let oppLosses = p ? p.losses : '非公開';

            let html = `
                <div class="flex flex-col items-center justify-center space-y-3 p-1 w-full max-w-sm mx-auto">
                    <div class="flex items-center gap-3 bg-slate-950 p-3 rounded border border-cyan-500/50 w-full">
                        <canvas id="opp-profile-cvs" width="55" height="55" class="pixel-box bg-slate-900 rounded"></canvas>
                        <div class="text-left">
                            <h3 class="text-sm font-bold text-cyan-300 font-pixel">${h.opponentName}</h3>
                            <span class="text-[10px] text-slate-400 font-mono">オンライン対戦プレイヤー</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-4 gap-1.5 w-full text-center font-mono text-xs">
                        <div class="bg-slate-950 p-2 rounded border border-slate-800">
                            <div class="text-slate-400 text-[10px]">総対戦</div>
                            <div class="text-amber-300 font-bold">${oppBattles}</div>
                        </div>
                        <div class="bg-slate-950 p-2 rounded border border-slate-800">
                            <div class="text-slate-400 text-[10px]">勝利</div>
                            <div class="text-emerald-400 font-bold">${oppWins}</div>
                        </div>
                        <div class="bg-slate-950 p-2 rounded border border-slate-800">
                            <div class="text-slate-400 text-[10px]">敗北</div>
                            <div class="text-red-400 font-bold">${oppLosses}</div>
                        </div>
                        <div class="bg-slate-950 p-2 rounded border border-slate-800">
                            <div class="text-slate-400 text-[10px]">勝率</div>
                            <div class="text-cyan-400 font-bold">${oppWinRate}%</div>
                        </div>
                    </div>

                    ${usageHtml}
                </div>
            `;
            showModal("対戦相手プロフィール", html);

            setTimeout(() => {
                const cvs = document.getElementById('opp-profile-cvs');
                if (cvs) CharacterRenderer.drawCharacter(cvs, h.opponentIcon || 'pasha');
            }, 50);
        }

        // HTML の onclick 属性から参照される関数をグローバル公開
        window.audioSystem = audioSystem;
        window.renderOpeningScreen = renderOpeningScreen;
        window.renderHomeScreen = renderHomeScreen;
        window.renderCharacterSelectScreen = renderCharacterSelectScreen;
        window.selectChar = selectChar;
        window.openCharDetail = openCharDetail;
        window.openGachaModal = openGachaModal;
        window.executeGacha = executeGacha;
        window.openCharacterListModal = openCharacterListModal;
        window.openOnlineLobby = openOnlineLobby;
        window.createOnlineRoom = createOnlineRoom;
        window.joinOnlineRoom = joinOnlineRoom;
        window.startBotBattle = startBotBattle;
        window.confirmRetireBattle = confirmRetireBattle;
        window.closeModal = closeModal;
        window.showModal = showModal;
        window.showConfirmModal = showConfirmModal;
        window.openProfileScreen = openProfileScreen;
        window.savePlayerName = savePlayerName;
        window.openIconSelectModal = openIconSelectModal;
        window.setProfileIcon = setProfileIcon;
        window.openOpponentProfileModal = openOpponentProfileModal;
