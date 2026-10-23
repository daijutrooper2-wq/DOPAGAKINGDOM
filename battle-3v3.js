// ==========================================
// 3v3バトルモード (3v3 Battle Mode) 専用コード
// 仕様・挙動・デザイン・UI・ロジック完全維持（独立モジュール）
// ==========================================

let activeNewBattle = null;
let isNewBattleSkillModalOpen = false;
let newBattleViewMode = 'main'; // 'main', 'attack_select', 'target_select'
let newBattleTargetSelectSkillId = null;
let newBattleTargetSelectType = null;

class Battle3v3Engine {
    constructor(p1CharId, p2CharId, isOnline = false, myPlayerNum = 1, roomId = null) {
        this.isOnline = isOnline;
        this.myPlayerNum = myPlayerNum;
        this.roomId = roomId;
        this.isNewBattle = true;
        this.turn = 1;
        this.turnTimer = 15;
        this.timerId = null;
        this.battleEnded = false;
        this.isSuddenDeath = false;
        this.waitingForOpponent = false;
        this.isProcessing = false;
        this.currentAttacker = null;
        this.turnJustStarted = true;

        this.p1 = this.createBattlePlayer(p1CharId, 'Player 1', 1);
        this.p2 = this.createBattlePlayer(p2CharId, 'BOT (CPU)', 2);
        this.activeAllyIndex = 0;
        this.waitingForChoice = false;

        const allIds = Object.keys(CHARACTER_DATA);
        const otherAllyIds = allIds.filter(id => id !== p1CharId);
        const ally2Id = otherAllyIds[Math.floor(Math.random() * otherAllyIds.length)] || 'courtney';
        const ally3Id = otherAllyIds.filter(id => id !== ally2Id)[Math.floor(Math.random() * (otherAllyIds.length - 1))] || 'ndaihyo';

        const enemy2Id = allIds[Math.floor(Math.random() * allIds.length)];
        const enemy3Id = allIds[Math.floor(Math.random() * allIds.length)];

        this.allies = [
            this.p1,
            this.createBattlePlayer(ally2Id, '味方2', 1),
            this.createBattlePlayer(ally3Id, '味方3', 1)
        ];
        this.enemies = [
            this.p2,
            this.createBattlePlayer(enemy2Id, '敵2', 2),
            this.createBattlePlayer(enemy3Id, '敵3', 2)
        ];

        this.p1Action = null;
        this.p2Action = null;
        this.p1TargetIndex = null;

        this.botAdapter = new BotInputAdapter();

        this.onLogUpdate = null;
        this.onTimerUpdate = null;
        this.onStateChange = null;
        this.onVisualEffect = null;
        this.onBattleEnd = null;
        this.onCutin = null;

        this.currentTurnLogs = [];
        this.battleLogs = [];
    }

    checkActiveAllyStatus() {
        if (this.battleEnded || this.waitingForChoice) return false;
        const currentActiveAlly = this.allies[this.activeAllyIndex || 0];
        if (currentActiveAlly && currentActiveAlly.hp <= 0) {
            if (this.allies.every(a => a.hp <= 0)) {
                this.battleEnded = true;
                this.stopTimer();
                if (this.onBattleEnd) this.onBattleEnd('💀 敵チームの勝利！');
                return true;
            } else {
                this.stopTimer();
                this.waitingForChoice = true;
                if (this.onStateChange) this.onStateChange(this);
                return true;
            }
        }
        return false;
    }

    getCharacterTeam(char) {
        if (!char) return 'system';
        if (this.allies && this.allies.includes(char)) return 'ally';
        if (this.enemies && this.enemies.includes(char)) return 'enemy';
        return 'system';
    }

    triggerHitShake(target) {
        if (!target) return;
        target.isShaking = true;
        setTimeout(() => {
            target.isShaking = false;
            if (this.onStateChange) this.onStateChange(this);
        }, 300);
    }

    logTeam(actor, msg, colorClass = 'text-slate-200') {
        const teamType = this.getCharacterTeam(actor);
        const prefix = teamType === 'ally' ? '【味方】' : (teamType === 'enemy' ? '【敵】' : '');
        this.log(`${prefix}${actor ? actor.charName : ''} ${msg}`, colorClass, teamType);
    }

    log(msg, colorClass = 'text-slate-200', teamType = 'system') {
        if (this.currentTurnLogs) {
            this.currentTurnLogs.push({ msg, colorClass, teamType });
        }
        if (this.battleLogs) {
            this.battleLogs.push({ msg, colorClass, teamType });
        }
        if (this.onLogUpdate) {
            this.onLogUpdate(msg, colorClass, teamType);
        }
    }

    createBattlePlayer(charId, displayName, playerNum = 1) {
        const master = CHARACTER_DATA[charId] || CHARACTER_DATA.pasha;

        let hp = master.hp;
        let atk = master.atk;
        let def = master.def;
        let critRate = master.critRate || 0.05;
        let eva = master.eva;

        if (playerNum === 1 && !['dopagaking', 'courtney', 'pasha_dark'].includes(charId)) {
            const custom = playerState.newBattleCustomStats && playerState.newBattleCustomStats[charId];
            if (custom) {
                hp = custom.hp;
                atk = custom.atk;
                def = custom.def;
                critRate = custom.critRate / 100;
                eva = custom.eva;
            }
        } else if (charId === 'dopagaking') {
            hp = Math.floor(Math.random() * (250 - 130 + 1)) + 130;
            atk = Math.floor(Math.random() * (28 - 7 + 1)) + 7;
            def = Math.floor(Math.random() * (17 - 7 + 1)) + 7;
            eva = Math.floor(Math.random() * (22 - 8 + 1)) + 8;
            critRate = 0.05;
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
            critRate: critRate,
            eva: eva,
            skills: master.skills.map(s => ({ ...s })),
            cooldowns: (() => {
                const cds = {};
                master.skills.forEach(s => {
                    if (s.initialCooldown) cds[s.id] = s.initialCooldown;
                });
                return cds;
            })(),
            buffAtk: 1.0,
            buffDef: 1.0,
            buffAtkTurns: 0,
            dopaChargeCount: 0,
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
            defendBuffTurns: 0,
            crimeDefDownTurns: 0,
            nightmareDefTurns: 0,
            nightmareAtkActive: false,
            critRateBonus: 0,
            critBuffTurns: 0,
            evaDebuff: 0,
            enemyEvaTurns: 0,
            momoEvaTurns: 0,
            asaiomizuCritTurns: 0
        };
    }

    startBattle() {
        this.log(`⚔️ 3v3バトル開始！ 味方チーム VS 敵チーム`, 'text-amber-300 font-bold');
        this.firstStrikerPlayerNum = 1;
        this.startTimer();
        if (this.onStateChange) this.onStateChange(this);
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
        if (!this.p1Action) {
            this.submitAction(1, p1Default);
        }
    }

    submitAction(pNum, skillId) {
        if (this.battleEnded) return;
        if (pNum === 1 && this.p1Action) return;

        if (pNum === 1) {
            this.p1Action = skillId;
            this.stopTimer();
            this.isProcessing = true;
            this.turnJustStarted = false;
            if (this.onStateChange) this.onStateChange(this);
            this.processTurn();
        }
    }

    async processTurn() {
        this.isProcessing = true;
        this.turnJustStarted = false;
        this.currentTurnLogs = [];

        if (this.isSuddenDeath) {
            this.log(`--- [ ターン ${this.turn} (🔥サドンデス) ] ---`, 'text-red-400 font-bold text-center');
        } else {
            this.log(`--- [ ターン ${this.turn} ] ---`, 'text-slate-400 font-bold text-center');
        }

        const ally1Action = this.p1Action || (this.p1.isResting ? 'rest' : this.p1.skills[0].id);

        if (this.p1.hp > 0) {
            this.currentAttacker = this.p1;
            if (this.onStateChange) this.onStateChange(this);

            const opponents = this.enemies.filter(e => e.hp > 0);
            if (opponents.length > 0) {
                let defender = opponents[0];
                const skill = this.p1.skills.find(s => s.id === ally1Action) || this.p1.skills[0];
                const targetList = (skill.targetType === 'single_ally') ? this.allies.filter(a => a.hp > 0) : opponents;
                if (this.p1TargetIndex !== null && targetList[this.p1TargetIndex]) {
                    defender = targetList[this.p1TargetIndex];
                } else if (targetList.length > 0) {
                    defender = targetList[Math.floor(Math.random() * targetList.length)];
                }

                this.executePlayerAction(this.p1, defender, ally1Action);
                if (this.onStateChange) this.onStateChange(this);

                if (await this.checkWinner()) return;
            }
        }

        const executeTeamRest = async (teamList, isAllyTeam) => {
            for (let i = 0; i < teamList.length; i++) {
                const attacker = teamList[i];
                if (isAllyTeam && attacker === this.p1) continue;
                if (attacker.hp <= 0) continue;

                this.currentAttacker = attacker;
                if (this.onStateChange) this.onStateChange(this);

                await new Promise(resolve => setTimeout(resolve, BOT_ACTION_DELAY));

                const targetPool = isAllyTeam ? this.enemies.filter(e => e.hp > 0) : this.allies.filter(a => a.hp > 0);
                const defaultOpponent = targetPool[0] || (isAllyTeam ? this.enemies[0] : this.allies[0]);
                const skillId = this.botAdapter.getDecision(attacker, defaultOpponent);

                const opponents = isAllyTeam ? this.enemies.filter(e => e.hp > 0) : this.allies.filter(a => a.hp > 0);
                if (opponents.length === 0) break;
                let defender = opponents[Math.floor(Math.random() * opponents.length)];

                this.executePlayerAction(attacker, defender, skillId);
                if (this.onStateChange) this.onStateChange(this);

                if (await this.checkWinner()) return true;
            }
            return false;
        };

        const isAlliesFirst = (this.turn % 2 === 1);

        if (isAlliesFirst) {
            if (await executeTeamRest(this.allies, true)) return;
            if (await executeTeamRest(this.enemies, false)) return;
        } else {
            if (await executeTeamRest(this.enemies, false)) return;
            if (await executeTeamRest(this.allies, true)) return;
        }

        this.p1TargetIndex = null;
        this.endTurnPhase();

        this.currentAttacker = null;
        this.isProcessing = false;
        this.turnJustStarted = true;
        this.p1Action = null;
        this.p1TargetIndex = null;

        if (this.onStateChange) this.onStateChange(this);
        if (!this.battleEnded) {
            this.startTimer();
            if (this.onCutin) {
                this.onCutin("🟢 自分のターンです！", `ターン ${this.turn} - 味方チームの行動を選択してください`);
            }
        }
    }

    executePlayerAction(attacker, defender, skillId) {
        if (attacker.hp <= 0) return;

        if (attacker.isResting) {
            attacker.isResting = false;
            this.log(`💤 ${attacker.charName} は前ターンの反動で動けない！`, 'text-slate-400 font-bold');
            this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'miss', '行動不能');
            return;
        }

        if (skillId === 'courtney_charge_only') {
            if ((attacker.courtneyChargeCount || 0) < 8) {
                attacker.courtneyChargeCount = (attacker.courtneyChargeCount || 0) + 1;
            }
            this.log(`⚡ ${attacker.charName} は 「FEEL SO HOT ///」 のチャージを進めた！（現在溜め: ${attacker.courtneyChargeCount}回）`, 'text-pink-400 font-bold');
            audioSystem.playBuff();
            this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', `溜め+1 (${attacker.courtneyChargeCount})`);
            return;
        }

        let skill = null;
        if (skillId === 'momo_eggplant_burst') {
            skill = { id: 'momo_eggplant_burst', name: '🍆 超ナスちん乱舞', type: 'eggplant_burst', power: 1.5, isNormalAttack: false, cooldown: 0 };
        } else if (skillId === 'asaiomizu_copied' && attacker.recordedSkill) {
            skill = { id: 'asaiomizu_copied', name: `📋【コピー】${attacker.recordedSkill.name}`, type: attacker.recordedSkill.type || 'attack', power: attacker.recordedSkill.power || 1.0, isNormalAttack: false, cooldown: 0 };
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

        if (skill.type === 'attack' || skill.type === 'special') {
            this.applyDamageSkill(attacker, defender, skill);
        } else if (skill.id === 'eggplant_burst') {
            this.log(`🐘 「超ナスちん乱舞」発動！！`, 'text-purple-300 font-bold');
            const targetTeamEgg = (this.getCharacterTeam(attacker) === 'ally') ? this.enemies : this.allies;
            targetTeamEgg.forEach(e => {
                if (e.hp > 0) this.applyDamageSkill(attacker, e, skill);
            });
            attacker.isMiniZou = false;
            attacker.eggplantReady = false;
        } else {
            // Other skill types
            this.applyDamageSkill(attacker, defender, skill);
        }
    }

    applyDamageSkill(attacker, defender, skill, isCounter = false) {
        let baseDmg = (attacker.atk * (skill.power || 1.0) * attacker.buffAtk) - (defender.def * 0.4 * defender.buffDef);
        let damage = Math.max(8, Math.floor(baseDmg + (Math.random() * 4 - 2)));

        if (Math.random() < (attacker.critRate || 0.05)) {
            damage = Math.floor(damage * 1.5);
            audioSystem.playCrit();
            this.log(`🔥✨ クリティカルヒット (${damage})！！`, 'text-yellow-300 font-bold');
        }

        defender.hp = Math.max(0, defender.hp - damage);
        this.triggerHitShake(defender);
        const side = this.getCharacterTeam(defender) === 'ally' ? 'Player' : 'Enemy';
        this.log(`⚔ ${defender.charName} に ${damage} のダメージ！`, 'text-red-400 font-bold');
        this.triggerEffect(side, 'damage', `-${damage}`);
        audioSystem.playHit();

        this.checkActiveAllyStatus();
    }

    async checkWinner() {
        if (this.battleEnded) return true;

        const livingAllies = this.allies.filter(a => a.hp > 0);
        const livingEnemies = this.enemies.filter(e => e.hp > 0);

        let winnerText = '';
        let isEnded = false;

        if (livingAllies.length === 0 && livingEnemies.length === 0) {
            winnerText = '⚔️ 引き分け！';
            isEnded = true;
        } else if (livingEnemies.length === 0) {
            winnerText = `🎉 味方チームの勝利！`;
            isEnded = true;
            audioSystem.playVictory();
            await addDopa(150);
        } else if (livingAllies.length === 0) {
            winnerText = `💀 敵チームの勝利！`;
            isEnded = true;
            audioSystem.playDefeat();
        }

        if (isEnded) {
            this.battleEnded = true;
            this.stopTimer();
            if (this.onBattleEnd) this.onBattleEnd(winnerText);
            return true;
        }

        return false;
    }

    endTurnPhase() {
        this.turn++;
        const allFighters = [...this.allies, ...this.enemies];
        allFighters.forEach(p => {
            if (p.tempEvadeNext) p.tempEvadeNext = false;
            Object.keys(p.cooldowns).forEach(key => {
                if (p.cooldowns[key] > 0) p.cooldowns[key]--;
            });
            if (p.defendBuffTurns > 0) p.defendBuffTurns--;
            if (p.buffAtkTurns > 0) {
                p.buffAtkTurns--;
                if (p.buffAtkTurns === 0) p.buffAtk = 1.0;
            }
        });

        if (this.turn >= 30 && !this.isSuddenDeath) {
            this.isSuddenDeath = true;
            this.log('🔥 30ターン経過！サドンデスモード突入！', 'text-red-500 font-black text-center');
        }
    }

    triggerEffect(side, type, text) {
        if (this.onVisualEffect) this.onVisualEffect(side, type, text);
    }
}

function selectNewBattleTarget(targetIdx, isAllySide) {
    if (!activeNewBattle) return;
    const skill = activeNewBattle.p1.skills.find(s => s.id === newBattleTargetSelectSkillId) || activeNewBattle.p1.skills.find(s => s.isNormalAttack);
    if (skill && skill.targetType === 'single_ally' && !isAllySide) return;
    if (skill && skill.targetType === 'single_enemy' && isAllySide) return;

    activeNewBattle.p1TargetIndex = targetIdx;
    newBattleViewMode = 'main';
    activeNewBattle.submitAction(1, newBattleTargetSelectSkillId);
    renderNewBattleScreen();
}

function renderNewBattleCharSelectScreen(sortOrder = 'default', sortDir = 'desc', onlyOwned = false) {
    audioSystem.playSelect();
    const container = document.getElementById('screen-container');
    if (container) container.scrollTop = 0;

    const selected = window.selectedNewBattleChar || 'asaiomizu';
    let chars = Object.values(CHARACTER_DATA);

    if (onlyOwned) {
        chars = chars.filter(c => playerState.unlockedChars.includes(c.id));
    }

    chars.sort((a, b) => {
        let valA = 0;
        let valB = 0;
        if (sortOrder === 'hp') { valA = a.hp; valB = b.hp; }
        else if (sortOrder === 'atk') { valA = a.atk; valB = b.atk; }
        else if (sortOrder === 'def') { valA = a.def; valB = b.def; }
        else if (sortOrder === 'critRate') { valA = a.critRate; valB = b.critRate; }
        else if (sortOrder === 'eva') { valA = a.eva; valB = b.eva; }
        else {
            const keys = Object.keys(CHARACTER_DATA);
            return keys.indexOf(a.id) - keys.indexOf(b.id);
        }
        return sortDir === 'desc' ? valB - valA : valA - valB;
    });

    const unlockedCount = playerState.unlockedChars.length;
    const totalCount = Object.keys(CHARACTER_DATA).length;

    let html = `
        <div class="w-full h-full flex flex-col items-center justify-between p-2 overflow-hidden select-none bg-slate-950 text-white">
            <div class="pixel-box-gold p-1.5 sm:p-2 bg-amber-950/90 w-full text-center space-y-0.5 border-amber-400 mb-1.5 flex-shrink-0">
                <div class="flex items-center justify-between">
                    <button onclick="renderBotModesScreen()" class="pixel-btn pixel-btn-danger px-2.5 py-0.5 text-xs font-bold">
                        ◀ モード選択
                    </button>
                    <h2 class="text-xs sm:text-base font-bold text-amber-300 font-pixel">
                         ✨ 3v3バトルモード - キャラ選択
                    </h2>
                    <div class="w-16"></div>
                </div>
                <p class="text-[9px] sm:text-[11px] text-amber-200 font-mono">アイコンをタップして詳細確認・出陣ファイターを選択せよ！</p>
            </div>

            <div class="flex items-center justify-between w-full mb-1.5 px-1 gap-2 flex-wrap flex-shrink-0">
                <div class="flex items-center gap-1.5 text-xs">
                    <span class="text-slate-400 font-bold">並び替え:</span>
                    <select id="new-char-select-sort-order" onchange="onNewCharSelectSortChange('${sortDir}', ${onlyOwned})" class="pixel-box bg-slate-900 text-amber-300 px-2 py-1 text-xs outline-none border-amber-600">
                        <option value="default" ${sortOrder === 'default' ? 'selected' : ''}>登録順</option>
                        <option value="hp" ${sortOrder === 'hp' ? 'selected' : ''}>HPが高い順</option>
                        <option value="atk" ${sortOrder === 'atk' ? 'selected' : ''}>攻撃力が高い順</option>
                        <option value="def" ${sortOrder === 'def' ? 'selected' : ''}>防御力が高い順</option>
                        <option value="critRate" ${sortOrder === 'critRate' ? 'selected' : ''}>クリティカル率が高い順</option>
                        <option value="eva" ${sortOrder === 'eva' ? 'selected' : ''}>回避率が高い順</option>
                    </select>
                    <button onclick="toggleNewCharSelectSortDir('${sortOrder}', '${sortDir}', ${onlyOwned})" class="pixel-btn px-2 py-1 text-xs font-bold bg-slate-800 border-slate-600">
                        ${sortDir === 'desc' ? '🔽 降順(高)' : '🔼 昇順(低)'}
                    </button>
                    <button onclick="toggleNewCharSelectOwnedFilter('${sortOrder}', '${sortDir}', ${onlyOwned})" class="pixel-btn px-2 py-1 text-xs font-bold ${onlyOwned ? 'pixel-btn-success border-emerald-400 text-emerald-200' : 'bg-slate-800 border-slate-600 text-slate-300'}">
                        ${onlyOwned ? '✨ 入手済みのみ: ON' : '📦 入手済みのみ: OFF'}
                    </button>
                </div>
                <div class="text-[10px] sm:text-xs font-mono text-amber-200 bg-slate-900 px-2.5 py-1 rounded border border-amber-600/50">
                    所持: <b class="text-emerald-400">${unlockedCount}</b> / ${totalCount} 体
                </div>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3 w-full mb-1.5 px-1 overflow-y-auto flex-1 min-h-0">
    `;

    chars.forEach(c => {
        const isUnlocked = playerState.unlockedChars.includes(c.id);
        const isSelected = selected === c.id;

        html += `
            <div onclick="openCharDetail('${c.id}', 'new_select', '${sortOrder}', '${sortDir}', ${onlyOwned})" 
                 class="pixel-box p-2 sm:p-3 bg-slate-900 cursor-pointer flex flex-col items-center justify-between border-2 transition-all ${isSelected ? 'border-amber-400 bg-amber-950/40 scale-105 shadow-lg' : 'border-slate-700 hover:border-slate-400'} ${!isUnlocked ? 'opacity-60 grayscale' : ''}">
                <canvas id="new-select-cvs-${c.id}" width="95" height="95" class="pixel-box bg-slate-950 mb-1 w-16 h-16 sm:w-24 sm:h-24"></canvas>
                <span class="text-[11px] sm:text-xs font-bold ${isSelected ? 'text-amber-300 font-pixel' : 'text-slate-200'} truncate max-w-full">${c.name}</span>
                <span class="text-[9px] text-slate-400 truncate max-w-full">${c.title}</span>
                ${!isUnlocked ? '<span class="text-[9px] text-red-400 font-bold mt-0.5">🔒 未解放</span>' : (isSelected ? '<span class="text-[9px] text-amber-400 font-pixel font-bold mt-0.5">✨ 選択中</span>' : '<span class="text-[9px] text-slate-400 font-bold mt-0.5">タップで詳細</span>')}
            </div>
        `;
    });

    html += `
            </div>
            <div class="flex gap-3 w-full justify-center pb-1 flex-shrink-0">
                <button onclick="
                    const pChar = window.selectedNewBattleChar || 'asaiomizu';
                    const otherIds = Object.keys(CHARACTER_DATA).filter(id => id !== pChar);
                    const eChar = otherIds[Math.floor(Math.random() * otherIds.length)] || 'pasha';
                    startNewBattleMode(pChar, eChar);
                " class="pixel-btn pixel-btn-primary px-8 py-2.5 sm:py-3 text-xs sm:text-sm font-bold font-pixel shadow-lg">
                    このキャラクターで出陣！ ▶
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    setTimeout(() => {
        chars.forEach(c => {
            const cvs = document.getElementById(`new-select-cvs-${c.id}`);
            if (cvs) CharacterRenderer.drawCharacter(cvs, c.id);
        });
    }, 50);
}

function onNewCharSelectSortChange(currentDir, onlyOwned) {
    const select = document.getElementById('new-char-select-sort-order');
    if (select) {
        renderNewBattleCharSelectScreen(select.value, currentDir, onlyOwned);
    }
}

function toggleNewCharSelectSortDir(currentOrder, currentDir, onlyOwned) {
    const newDir = currentDir === 'desc' ? 'asc' : 'desc';
    renderNewBattleCharSelectScreen(currentOrder, newDir, onlyOwned);
}

function toggleNewCharSelectOwnedFilter(currentOrder, currentDir, onlyOwned) {
    renderNewBattleCharSelectScreen(currentOrder, currentDir, !onlyOwned);
}

function executeNewBattleCourtneyCharge() {
    if (!activeNewBattle || activeNewBattle.battleEnded || activeNewBattle.isProcessing || activeNewBattle.p1Action !== null || activeNewBattle.waitingForOpponent || activeNewBattle.p1.isResting) return;
    if (activeNewBattle.p1.id !== 'courtney') return;
    if ((activeNewBattle.p1.courtneyChargeCount || 0) < 8) {
        activeNewBattle.submitAction(1, 'courtney_charge_only');
    } else {
        showModal("MAXチャージ", "これ以上溜められません！");
    }
}

function startNewBattleMode(playerCharId = 'asaiomizu', enemyCharId = 'asaiomizu') {
    audioSystem.playSelect();
    newBattleViewMode = 'main';
    isNewBattleSkillModalOpen = false;

    if (activeNewBattle) {
        activeNewBattle.stopTimer();
        activeNewBattle = null;
    }

    activeNewBattle = new Battle3v3Engine(playerCharId, enemyCharId, false, 1, null);

    activeNewBattle.onLogUpdate = (msg, colorClass) => {
        appendNewBattleLog(msg, colorClass);
    };

    activeNewBattle.onTimerUpdate = (sec) => {
        const timerEl = document.getElementById('new-battle-timer');
        if (timerEl) {
            timerEl.innerText = sec;
            if (sec <= 5) timerEl.className = 'font-pixel text-xs sm:text-sm font-bold text-red-500 animate-ping';
            else timerEl.className = 'font-pixel text-xs sm:text-sm font-bold text-emerald-400';
        }
    };

    activeNewBattle.onStateChange = (engine) => {
        renderNewBattleScreen();
    };

    activeNewBattle.onCutin = (title, subtitle) => {
        if (typeof triggerCutinBanner === 'function') triggerCutinBanner(title, subtitle);
    };

    activeNewBattle.onBattleEnd = (winner) => {
        handleNewBattleEnd();
    };

    activeNewBattle.startBattle();
    renderNewBattleScreen();
}

function handleNewBattleEnd() {
    if (!activeNewBattle) return;
    const p1 = activeNewBattle.p1;
    const p2 = activeNewBattle.p2;

    setTimeout(() => {
        const stage = document.getElementById('screen-container');
        if (!stage) return;

        const livingAllies = activeNewBattle.allies.filter(a => a.hp > 0);
        if (livingAllies.length === 0) {
            audioSystem.playDefeat();
            stage.innerHTML += `
                <div id="battle-result-overlay" class="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center p-6 text-center opacity-0 transition-opacity duration-1000">
                    <div class="text-4xl sm:text-6xl font-pixel font-black text-red-500 mb-3 animate-pulse">LOSE</div>
                    <p class="text-xs sm:text-sm text-slate-300 font-mono mb-6">力尽きてしまいました……</p>
                    <button onclick="renderNewBattleCharSelectScreen()" class="pixel-btn pixel-btn-primary px-8 py-3 text-sm font-bold font-pixel shadow-xl">
                        バトル選択画面へ戻る ▶
                    </button>
                </div>
            `;
            setTimeout(() => {
                const overlay = document.getElementById('battle-result-overlay');
                if (overlay) overlay.classList.remove('opacity-0');
            }, 50);
        } else {
            audioSystem.playVictory();
            stage.innerHTML += `
                <div id="battle-result-overlay" class="fixed inset-0 bg-black/90 z-[9999] flex flex-col items-center justify-center p-6 text-center animate-cutin">
                    <div class="pixel-box-gold p-8 bg-amber-950/95 border-amber-400 shadow-2xl max-w-md w-full flex flex-col items-center">
                        <div class="text-4xl sm:text-6xl font-pixel font-black text-amber-300 mb-2 animate-bounce">WIN</div>
                        <p class="text-xs sm:text-sm text-amber-200 font-mono mb-4">お見事！見事に勝利を収めました！<br><b class="text-amber-400">+150 DOPA</b> を獲得！</p>
                        <button onclick="renderNewBattleCharSelectScreen()" class="pixel-btn pixel-btn-primary px-8 py-3 text-sm font-bold font-pixel shadow-xl">
                            バトル選択画面へ戻る ▶
                        </button>
                    </div>
                </div>
            `;
        }
    }, 1000);
}

function handleNewBattleContinueChoice(action) {
    audioSystem.playSelect();
    if (!activeNewBattle) return;

    if (action === 'skip') {
        activeNewBattle.waitingForChoice = false;
        activeNewBattle.battleEnded = true;
        activeNewBattle.stopTimer();
        if (activeNewBattle.onBattleEnd) activeNewBattle.onBattleEnd('💀 敵チームの勝利！');
        renderNewBattleScreen();
    } else if (action === 'switch') {
        let nextIdx = -1;
        for (let i = 0; i < activeNewBattle.allies.length; i++) {
            if (activeNewBattle.allies[i].hp > 0) {
                nextIdx = i;
                break;
            }
        }
        if (nextIdx === -1) {
            handleNewBattleContinueChoice('skip');
            return;
        }

        activeNewBattle.activeAllyIndex = nextIdx;
        activeNewBattle.p1 = activeNewBattle.allies[nextIdx];
        activeNewBattle.waitingForChoice = false;
        activeNewBattle.p1Action = null;
        activeNewBattle.p1TargetIndex = null;

        activeNewBattle.log(`🔄 ${activeNewBattle.p1.charName} に操作権が引き継がれた！`, 'text-amber-300 font-bold');
        audioSystem.playBuff();
        activeNewBattle.startTimer();
        renderNewBattleScreen();
    }
}

function renderNewBattleScreen() {
    const container = document.getElementById('screen-container');
    if (!container || !activeNewBattle) return;

    const p1 = activeNewBattle.p1;
    const p2 = activeNewBattle.p2;
    const allies = activeNewBattle.allies || [p1];
    const enemies = activeNewBattle.enemies || [p2];

    const getCharImg = (player, isPlayerSide) => {
        const isC = player.id === 'courtney';
        const isA = player.id === 'asaiomizu';
        const charData = CHARACTER_DATA[player.id] || {};
        if (player.hp <= 0) {
            if (charData.dieImage) return charData.dieImage;
            if (isA) return 'asaiomizu/asaiomizu3.webp';
            return charData.image || player.image;
        }
        if (isA) return isPlayerSide ? 'asaiomizu/asaiomizu2.webp' : 'asaiomizu/asaiomizu1.webp';
        return charData.allImage || charData.image || player.image;
    };

    const isMyTurn = !activeNewBattle.battleEnded && !activeNewBattle.isProcessing && activeNewBattle.p1Action === null && !activeNewBattle.waitingForOpponent && !p1.isResting;

    let actorIndicator = '';
    if (activeNewBattle.isProcessing && activeNewBattle.currentAttacker) {
        const actor = activeNewBattle.currentAttacker;
        const isAlly = activeNewBattle.getCharacterTeam(actor) === 'ally';
        actorIndicator = `<div class="px-2 py-0.5 rounded border text-[10px] sm:text-xs font-bold font-pixel animate-pulse shadow ${isAlly ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300' : 'bg-red-950/90 border-red-500 text-red-300'}">⚡ 現在行動中：${isAlly ? '【味方】' : '【敵】'} ${actor.charName}</div>`;
    } else if (isMyTurn) {
        actorIndicator = `<div class="px-2 py-0.5 rounded border border-emerald-400 bg-emerald-950/90 text-emerald-300 text-[10px] sm:text-xs font-bold font-pixel animate-pulse shadow">🟢 自分のターン (${p1.charName})</div>`;
    } else {
        actorIndicator = `<div class="px-2 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-400 text-[10px] sm:text-xs font-bold font-pixel">⏳ 相手のターン</div>`;
    }

    let commandAreaContent = '';
    if (newBattleViewMode === 'target_select') {
        commandAreaContent = `
            <div class="flex flex-col gap-1 w-full h-full justify-center text-center">
                <div class="font-pixel text-[11px] text-amber-300 font-bold animate-bounce">🎯 対象を選択してください</div>
                <button onclick="newBattleViewMode='main'; renderNewBattleScreen();" class="pixel-btn pixel-btn-danger py-1 px-2 text-[10px] font-bold font-pixel">✕ キャンセル</button>
            </div>
        `;
    } else if (newBattleViewMode === 'attack_select') {
        const normalSkill = p1.skills.find(s => s.isNormalAttack) || p1.skills[0];
        commandAreaContent = `
            <div class="flex flex-col gap-1 w-full h-full justify-center">
                <button onclick="executeNewBattleAction('${normalSkill.id}')" class="pixel-box bg-slate-900 border border-amber-400 p-1.5 text-left cursor-pointer shadow">
                    <div class="font-pixel text-[11px] text-amber-300 font-bold">${normalSkill.name}</div>
                    <div class="text-[9px] text-slate-300 font-mono truncate">${normalSkill.desc}</div>
                </button>
                <button onclick="executeNewBattleAction('back_to_main')" class="pixel-btn pixel-btn-warning py-1 px-2 text-[10px] font-bold font-pixel">◀ 戻る</button>
            </div>
        `;
    } else {
        const actionDisabledClass = !isMyTurn ? 'opacity-50 pointer-events-none filter grayscale' : '';
        commandAreaContent = `
            <div class="grid grid-cols-2 gap-1 w-full h-full relative z-20">
                <button onclick="executeNewBattleAction('normal_attack_click')" class="pixel-btn pixel-btn-primary py-1 px-1 text-[11px] font-bold flex flex-col items-center justify-center text-center shadow cursor-pointer ${actionDisabledClass}"><span>⚔️ 通常攻撃</span></button>
                <button onclick="executeNewBattleAction('run')" class="pixel-btn pixel-btn-danger py-1 px-1 text-[11px] font-bold flex flex-col items-center justify-center text-center shadow cursor-pointer ${actionDisabledClass}"><span>🏃 逃げる</span></button>
                <button onclick="executeNewBattleAction('skill_click')" class="pixel-btn pixel-btn-success py-1 px-1 text-[11px] font-bold flex flex-col items-center justify-center text-center shadow cursor-pointer ${actionDisabledClass}"><span>✨ スキル</span></button>
                <button onclick="executeNewBattleAction('setting')" class="pixel-btn pixel-btn-warning py-1 px-1 text-[11px] font-bold flex flex-col items-center justify-center text-center shadow cursor-pointer relative z-30 pointer-events-auto"><span>⚙️ 設定</span></button>
            </div>
        `;
    }

    let skillModalHtml = '';
    if (isNewBattleSkillModalOpen) {
        const skills = p1.skills.filter(s => !s.isNormalAttack);
        let skillsHtml = skills.map(s => {
            const cd = p1.cooldowns[s.id] || 0;
            const disabled = cd > 0;
            return `
                <button onclick="${disabled ? '' : `executeNewBattleAction('${s.id}')`}" class="pixel-box bg-slate-900 border ${disabled ? 'border-slate-700 opacity-60 cursor-not-allowed' : 'border-emerald-400 hover:border-emerald-300 cursor-pointer'} p-3 text-left shadow flex flex-col justify-between w-full">
                    <div class="flex justify-between items-center w-full mb-1">
                        <span class="font-pixel text-xs text-emerald-300 font-bold">${s.name} ${cd > 0 ? `(CT:${cd})` : ''}</span>
                    </div>
                    <div class="text-[11px] text-slate-200 font-mono">${s.desc}</div>
                </button>
            `;
        }).join('');

        skillModalHtml = `
            <div class="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onclick="if(event.target === this) { isNewBattleSkillModalOpen = false; renderNewBattleScreen(); }">
                <div class="pixel-box bg-slate-900 border-emerald-400 max-w-lg w-full p-4 text-center relative shadow-2xl flex flex-col max-h-[85vh]">
                    <div class="flex justify-between items-center border-b border-emerald-600/50 pb-3 mb-4">
                        <h3 class="text-base font-bold text-emerald-300 font-pixel">✨ スキル一覧</h3>
                        <button onclick="isNewBattleSkillModalOpen = false; renderNewBattleScreen();" class="pixel-btn pixel-btn-danger px-3 py-1 text-xs font-bold">✕ 閉じる</button>
                    </div>
                    <div class="space-y-2.5 flex-1 overflow-y-auto pr-1 text-left">${skillsHtml}</div>
                </div>
            </div>
        `;
    }

    let choicePopupHtml = '';
    if (activeNewBattle && activeNewBattle.waitingForChoice) {
        choicePopupHtml = `
            <div class="fixed inset-0 bg-black/85 z-[999] flex items-center justify-center p-4">
                <div class="pixel-box-gold bg-slate-900 border-amber-400 max-w-md w-full p-6 text-center relative shadow-2xl flex flex-col items-center space-y-4">
                    <div class="text-xl font-pixel font-black text-red-500 animate-bounce">⚠️ 操作キャラクター戦闘不能！</div>
                    <div class="flex flex-col gap-3 w-full mt-2">
                        <button onclick="handleNewBattleContinueChoice('skip')" class="pixel-btn pixel-btn-danger py-3 px-4 text-xs font-bold font-pixel">🏁 結果を見る</button>
                        <button onclick="handleNewBattleContinueChoice('switch')" class="pixel-btn pixel-btn-primary py-3 px-4 text-xs font-bold font-pixel">🔄 次のキャラへ交代</button>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="w-full h-full flex flex-col justify-between bg-slate-950 text-white relative select-none p-1 sm:p-2 overflow-hidden">
            ${skillModalHtml}
            ${choicePopupHtml}
            <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <img src="images/backnormal.webp" alt="backnormal" class="w-full h-full object-cover opacity-80">
            </div>
            <div class="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/95 rounded-lg border border-slate-700 shadow-md z-20 shrink-0">
                <div class="flex items-center gap-1.5 text-xs font-pixel text-amber-300"><span>⚔️ 3v3バトルモード</span></div>
                <div class="flex items-center justify-center flex-1">${actorIndicator}</div>
                <div class="flex items-center gap-2 text-xs font-mono">
                    <span>T:<strong id="new-battle-turn" class="text-amber-400 font-pixel">${activeNewBattle.turn}</strong></span>
                    <span>制限:<strong id="new-battle-timer" class="text-emerald-400 font-pixel">${activeNewBattle.turnTimer}</strong>s</span>
                </div>
            </div>

            <div class="flex-1 flex items-center justify-between px-2 py-2 relative z-10 overflow-hidden w-full">
                <!-- 味方チーム -->
                <div class="relative w-[47%] h-full flex items-center justify-center">
                    <div class="absolute left-1 top-1 text-[9px] text-emerald-400 font-pixel font-bold z-30">🛡️ 味方</div>
                    ${allies.map((c, posIdx) => {
                        const pct = Math.max(0, Math.min(100, Math.round((c.hp / c.maxHp) * 100)));
                        const img = getCharImg(c, true);
                        const isSelectable = newBattleViewMode === 'target_select' && newBattleTargetSelectType === 'single_ally' && c.hp > 0;
                        const clickableAttr = isSelectable ? `onclick="selectNewBattleTarget(${posIdx}, true)"` : '';
                        return `
                            <div ${clickableAttr} class="absolute top-1/2 -translate-y-1/2 flex flex-col items-center w-24 h-32 ${c.hp <= 0 ? 'opacity-40 grayscale' : ''}">
                                <div class="w-full bg-black/85 px-1 py-0.5 rounded border border-white/20 text-[8px] text-emerald-300">
                                    <span>${c.charName}</span>: <span class="font-mono">${c.hp}/${c.maxHp}</span>
                                    <div class="w-full bg-slate-900 h-1 rounded overflow-hidden"><div class="bg-emerald-400 h-full" style="width: ${pct}%;"></div></div>
                                </div>
                                <div class="w-full flex-1 flex items-center justify-center">
                                    <img src="${img}" alt="${c.charName}" class="w-full h-full object-contain">
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="text-amber-400 font-pixel font-black text-lg">VS</div>

                <!-- 敵チーム -->
                <div class="relative w-[47%] h-full flex items-center justify-center">
                    <div class="absolute right-1 top-1 text-[9px] text-red-400 font-pixel font-bold z-30">⚔️ 敵</div>
                    ${enemies.map((c, posIdx) => {
                        const pct = Math.max(0, Math.min(100, Math.round((c.hp / c.maxHp) * 100)));
                        const img = getCharImg(c, false);
                        const isSelectable = newBattleViewMode === 'target_select' && newBattleTargetSelectType === 'single_enemy' && c.hp > 0;
                        const clickableAttr = isSelectable ? `onclick="selectNewBattleTarget(${posIdx}, false)"` : '';
                        return `
                            <div ${clickableAttr} class="absolute top-1/2 -translate-y-1/2 flex flex-col items-center w-24 h-32 ${c.hp <= 0 ? 'opacity-40 grayscale' : ''}">
                                <div class="w-full bg-black/85 px-1 py-0.5 rounded border border-white/20 text-[8px] text-red-300">
                                    <span>${c.charName}</span>: <span class="font-mono">${c.hp}/${c.maxHp}</span>
                                    <div class="w-full bg-slate-900 h-1 rounded overflow-hidden"><div class="bg-red-500 h-full" style="width: ${pct}%;"></div></div>
                                </div>
                                <div class="w-full flex-1 flex items-center justify-center">
                                    <img src="${img}" alt="${c.charName}" class="w-full h-full object-contain" style="transform: scaleX(-1);">
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="w-full grid grid-cols-1 sm:grid-cols-12 gap-1.5 h-20 shrink-0 z-10">
                <div class="sm:col-span-3 bg-slate-950 border border-slate-700 rounded p-1.5 flex items-center gap-2">
                    <div class="text-[11px] font-bold text-amber-300 font-pixel">${playerState.playerName || 'ファイター'}</div>
                </div>
                <div class="sm:col-span-5 bg-slate-950 border border-slate-700 rounded p-1 flex flex-col h-full overflow-hidden">
                    <div class="w-full flex-1 overflow-y-auto text-[9px] font-mono text-slate-200" id="new-battle-log">
                        ${(activeNewBattle.battleLogs && activeNewBattle.battleLogs.length > 0) ? activeNewBattle.battleLogs.map(l => `<div class="p-0.5">${l.msg}</div>`).join('') : "3v3バトル開始！"}
                    </div>
                </div>
                <div class="sm:col-span-4 bg-slate-900 border border-slate-700 rounded p-1 flex flex-col justify-center h-full">
                    ${commandAreaContent}
                </div>
            </div>
        </div>
    `;

    const logEl = document.getElementById('new-battle-log');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
}

function appendNewBattleLog(text, colorClass = 'text-slate-200') {
    const logEl = document.getElementById('new-battle-log');
    if (logEl) {
        const line = document.createElement('div');
        line.className = `p-0.5 text-[9px] font-mono ${colorClass}`;
        line.innerHTML = text;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    }
}

function executeNewBattleAction(actionType) {
    if (actionType === 'setting') {
        openNewBattleSettingsPanel();
        return;
    }
    if (!activeNewBattle || activeNewBattle.battleEnded || activeNewBattle.isProcessing || activeNewBattle.p1Action !== null) return;
    audioSystem.playSelect();

    if (actionType === 'normal_attack_click') {
        newBattleViewMode = 'attack_select';
        isNewBattleSkillModalOpen = false;
        renderNewBattleScreen();
        return;
    }
    if (actionType === 'skill_click') {
        isNewBattleSkillModalOpen = true;
        renderNewBattleScreen();
        return;
    }
    if (actionType === 'back_to_main') {
        newBattleViewMode = 'main';
        isNewBattleSkillModalOpen = false;
        renderNewBattleScreen();
        return;
    }
    if (actionType === 'run') {
        showConfirmModal("バトル終了", "本当に終了しますか？", () => {
            if (activeNewBattle) {
                activeNewBattle.stopTimer();
                activeNewBattle = null;
            }
            renderBotModesScreen();
        }, "はい");
        return;
    }
    if (actionType === 'setting') {
        openNewBattleSettingsPanel();
        return;
    }

    isNewBattleSkillModalOpen = false;
    const skill = activeNewBattle.p1.skills.find(s => s.id === actionType);
    if (skill && (skill.targetType === 'single_enemy' || skill.targetType === 'single_align')) {
        newBattleTargetSelectSkillId = actionType;
        newBattleTargetSelectType = skill.targetType;
        newBattleViewMode = 'target_select';
        renderNewBattleScreen();
        return;
    }

    newBattleViewMode = 'main';
    activeNewBattle.submitAction(1, actionType);
    renderNewBattleScreen();
}

function openNewBattleSettingsPanel() {
    audioSystem.playSelect();
    openSettingsPanel();
}

// Window bindings
window.renderNewCharSelectScreen = renderNewBattleCharSelectScreen;
window.onNewCharSelectSortChange = onNewCharSelectSortChange;
window.toggleNewCharSelectSortDir = toggleNewCharSelectSortDir;
window.toggleNewCharSelectOwnedFilter = toggleNewCharSelectOwnedFilter;
window.executeNewBattleCourtneyCharge = executeNewBattleCourtneyCharge;
window.handleNewBattleContinueChoice = handleNewBattleContinueChoice;
window.selectNewBattleTarget = selectNewBattleTarget;
