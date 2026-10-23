// ==========================================
// 元祖対人バトルモード (Original Battle Mode) 専用コード
// 仕様・挙動・デザイン・UI・ロジック完全維持（独立モジュール）
// ==========================================

class BotInputAdapter {
    getDecision(botChar, opponentChar) {
        if (botChar.isResting) return 'rest';
        if (botChar.eggplantReady) return 'momo_eggplant_burst';
        if (botChar.recordedSkill) return 'asaiomizu_copied';

        if (botChar.id === 'courtney') {
            const charges = botChar.courtneyChargeCount || 0;
            if (charges < 8 && Math.random() < 0.6) {
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

class OriginalBattleEngine {
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
        this.isProcessing = false;
        this.currentAttacker = null;

        this.p1 = this.createBattlePlayer(p1CharId, isOnline ? 'Player 1' : 'Player 1', 1);
        this.p2 = this.createBattlePlayer(p2CharId, isOnline ? 'Player 2' : 'BOT (CPU)', 2);

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
        this.battleLogs = [];
        this.onlineSyncStarted = false;
        this.latestRoomData = null;
    }

    getCharacterTeam(char) {
        if (!char) return 'system';
        if (char === this.p1) return 'ally';
        if (char === this.p2) return 'enemy';
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

        if (charId === 'dopagaking') {
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
        this.log(`⚔️ バトル開始！ 【${this.p1.charName}】 VS 【${this.p2.charName}】`, 'text-amber-300 font-bold');
        
        let firstStrikerNum = 1;
        if (!this.isOnline) {
            firstStrikerNum = Math.random() < 0.5 ? 1 : 2;
            this.log(`🎲 BOT戦のため、50%のランダム判定により【${firstStrikerNum === 1 ? this.p1.charName : this.p2.charName}】が先攻を獲得！`, 'text-amber-300 font-bold');
        } else {
            const p1Dopa = (this.myPlayerNum === 1) ? playerState.dopa : (this.latestRoomData?.p1Profile?.dopa ?? 1000);
            const p2Dopa = (this.myPlayerNum === 2) ? playerState.dopa : (this.latestRoomData?.p2Profile?.dopa ?? 1000);
            if (p1Dopa > p2Dopa) {
                firstStrikerNum = 1;
                this.log(`💰 所持DOPA比較 により、【${this.p1.charName}】が先攻を獲得！`, 'text-amber-300 font-bold');
            } else if (p2Dopa > p1Dopa) {
                firstStrikerNum = 2;
                this.log(`💰 所持DOPA比較 により、【${this.p2.charName}】が先攻を獲得！`, 'text-amber-300 font-bold');
            } else {
                firstStrikerNum = Math.random() < 0.5 ? 1 : 2;
                this.log(`💰 所持DOPA同額のため、50%のランダム判定により【${firstStrikerNum === 1 ? this.p1.charName : this.p2.charName}】が先攻を獲得！`, 'text-amber-300 font-bold');
            }
        }
        this.firstStrikerPlayerNum = firstStrikerNum;

        const myChar = (this.isOnline && this.myPlayerNum === 2) ? this.p2 : this.p1;
        if (myChar.id === 'dopagaking') {
            const statusBody = `【ドパガキングのステータス決定！】\nHP：${myChar.hp}\n攻撃力：${myChar.atk}\n防御力：${myChar.def}\n回避率：${myChar.eva}%\nクリティカル率：${Math.round(myChar.critRate * 100)}%`;
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
            } catch(e) {}
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
                            if (this.battleLogs) {
                                this.battleLogs.push({ msg: l.msg, colorClass: l.colorClass, teamType: l.teamType || 'system' });
                            }
                            if (this.onLogUpdate) this.onLogUpdate(l.msg, l.colorClass, l.teamType || 'system');
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
                            const oppCharId = this.p1.id;
                            const oppName = data.p1Profile?.playerName || this.p1.charName || '対戦相手';
                            const oppIcon = data.p1Profile?.selectedIcon || this.p1.id;
                            const oppProfile = data.p1Profile || null;

                            if (typeof recordBattleResult === 'function') {
                                recordBattleResult(result, myCharId, oppName, oppIcon, false, 'online_p1', oppProfile, oppCharId);
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
            atk: p.atk,
            def: p.def,
            critRate: p.critRate !== undefined ? p.critRate : 0.05,
            eva: p.eva,
            buffAtk: p.buffAtk,
            buffDef: p.buffDef,
            buffAtkTurns: p.buffAtkTurns || 0,
            cooldowns: { ...p.cooldowns },
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
            defendBuffTurns: p.defendBuffTurns,
            crimeDefDownTurns: p.crimeDefDownTurns || 0,
            nightmareDefTurns: p.nightmareDefTurns || 0,
            nightmareAtkActive: !!p.nightmareAtkActive
        };
    }

    deserializePlayer(p, state) {
        if (!state) return;
        p.hp = state.hp;
        p.maxHp = state.maxHp;
        if (state.atk !== undefined) p.atk = state.atk;
        if (state.def !== undefined) p.def = state.def;
        if (state.critRate !== undefined) p.critRate = state.critRate;
        if (state.eva !== undefined) p.eva = state.eva;
        p.buffAtk = state.buffAtk;
        p.buffDef = state.buffDef;
        p.buffAtkTurns = state.buffAtkTurns || 0;
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
        p.crimeDefDownTurns = state.crimeDefDownTurns || 0;
        p.nightmareDefTurns = state.nightmareDefTurns || 0;
        p.nightmareAtkActive = !!state.nightmareAtkActive;
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
        if (pNum === 1 && this.p1Action) return;
        if (pNum === 2 && this.p2Action) return;
        if (this.waitingForOpponent) return;

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
        this.isProcessing = true;
        this.currentTurnLogs = [];

        if (this.isSuddenDeath) {
            this.log(`--- [ ターン ${this.turn} (🔥サドンデス) ] ---`, 'text-red-400 font-bold text-center');
        } else {
            this.log(`--- [ ターン ${this.turn} ] ---`, 'text-slate-400 font-bold text-center');
        }

        const isP1FirstThisTurn = (this.turn % 2 === 1) ? (this.firstStrikerPlayerNum === 1) : (this.firstStrikerPlayerNum !== 1);

        let first, second, firstAction, secondAction;
        if (isP1FirstThisTurn) {
            first = this.p1; firstAction = this.p1Action;
            second = this.p2; secondAction = this.p2Action;
        } else {
            first = this.p2; firstAction = this.p2Action;
            second = this.p1; secondAction = this.p1Action;
        }

        this.executePlayerAction(first, second, firstAction);
        if (!await this.checkWinner()) {
            if (firstAction === 'pasha_dark_nightmare' && first.id === 'pasha_dark') {
                this.endTurnPhase();
            } else {
                this.executePlayerAction(second, first, secondAction);
                if (!await this.checkWinner()) {
                    this.endTurnPhase();
                }
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
            } catch(e) {}
        }

        this.currentAttacker = null;
        this.isProcessing = false;
        this.p1Action = null;
        this.p2Action = null;
        this.waitingForOpponent = false;

        if (this.onStateChange) this.onStateChange(this);
        if (!this.battleEnded) {
            this.startTimer();
        }
    }

    executePlayerAction(attacker, defender, skillId) {
        if (attacker.hp <= 0) return;

        if (attacker.isResting) {
            attacker.isResting = false;
            this.log(`💤 ${attacker.charName} は前ターンの反動で動けない！（行動不能）`, 'text-slate-400 font-bold');
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

        if (skill.id === 'ndaihyo_analysis') {
            this.applyDamageSkill(attacker, defender, skill);
            defender.buffAtk *= 0.86;
            defender.buffDef *= 0.86;
            this.triggerHitShake(defender);
            this.log(`N高代表 は【弱点分析】を行った！`, 'text-cyan-300 font-bold');
            return;
        }
        if (skill.id === 'ndaihyo_tactics') {
            const targetTeam = (this.getCharacterTeam(attacker) === 'ally') ? [this.p2] : [this.p1];
            targetTeam.forEach(e => {
                if (e.hp > 0) {
                    if (['pasha', 'pasha_dark'].includes(e.id)) {
                        e.buffAtk *= 0.3;
                        this.log(`【特効発動！】 ${e.charName}は激怒され、攻撃力が大幅に激減した！`, 'text-yellow-300 font-bold text-base');
                        this.triggerCutin('🎯 特効発動！', 'パシャ憎へのムカつきが極限に達した！');
                    } else {
                        e.buffAtk *= 0.80;
                        e.buffDef *= 0.80;
                    }
                    this.triggerHitShake(e);
                }
            });
            this.log(`N高代表 はパシャ憎へのムカつきを放った！`, 'text-cyan-300 font-bold');
            return;
        }
        if (skill.id === 'ndaihyo_mind') {
            const hCleanseAmt = Math.floor(attacker.maxHp * 0.20);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + hCleanseAmt);
            attacker.buffAtk = Math.max(1.0, attacker.buffAtk);
            attacker.buffDef = Math.max(1.0, attacker.buffDef);
            this.log(`N高代表 は消しゴムを食った！ HPが回復しデバフが解除された！`, 'text-emerald-400 font-bold');
            return;
        }
        if (skill.id === 'iwaba_rap') {
            attacker.buffDef *= 1.40;
            attacker.defendBuffTurns = 3;
            this.log(`岩盤星人 は【フリースタイル】をかました！ 防御力大幅UP！`, 'text-emerald-300 font-bold');
            return;
        }
        if (skill.id === 'iwaba_song') {
            attacker.tempEvadeNext = true;
            this.log(`岩盤星人 の【ソウルソング】！ 攻撃1回無効化バリアが付与された！`, 'text-emerald-300 font-bold');
            return;
        }
        if (skill.id === 'iwaba_bath') {
            const hAmt = Math.floor(attacker.maxHp * 0.20);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + hAmt);
            attacker.eva = Math.min(60, (attacker.eva || 10) + 10);
            this.log(`岩盤星人 は【岩盤浴ブースト】で温まった！`, 'text-emerald-300 font-bold');
            return;
        }

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
            this.triggerHitShake(defender);
            this.log(`👑🔥 ドパガキングの「王位継承」発動！！ ${chosenMaster.name}の力を借りて ${defender.charName} に ${inheritDmg} の大ダメージを与えた！！`, 'text-amber-400 font-black text-base');
            this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'damage', `-${inheritDmg}`);
            attacker.dopaChargeCount = 0;
            attacker.selectedInheritChar = null;
            return;
        }

        if (defender.id === 'asaiomizu' && defender.digActive) {
            if (skill.type === 'attack' || skill.type === 'special' || skill.type === 'debuff_attack' || (skill.power && skill.power > 0)) {
                defender.recordedSkill = { ...skill };
                defender.digActive = false;
                this.log(`💡 ${defender.charName} は ${attacker.charName} の「${skill.name}」を記憶（コピー）した！`, 'text-cyan-300 font-bold');
            }
        }

        if (attacker.id === 'pasha' && !attacker.isDarkMode && attacker.hp <= attacker.maxHp * 0.5) {
            attacker.isDarkMode = true;
            attacker.buffAtk *= 1.4;
            this.log(`✖ パシャ僧のHPが半減！「ダークモード」発動！`, 'text-purple-400 font-bold');
            this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'buff', 'DARK MODE');
        }

        switch (skill.type) {
            case 'attack':
            case 'special':
                this.applyDamageSkill(attacker, defender, skill);
                break;
            case 'dopa_juggler_skill':
                const jugglerDmg = Math.floor(Math.random() * 51);
                defender.hp = Math.max(0, defender.hp - jugglerDmg);
                this.triggerHitShake(defender);
                this.log(`🃏 ドパガキングの「ジャグラー」！ ⇒ ${defender.charName} に ${jugglerDmg} のダメージ！`, 'text-purple-300 font-bold');
                this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'damage', `-${jugglerDmg}`);
                audioSystem.playHit();
                break;
            case 'dopa_majesty_skill':
                if (Math.random() < 0.7) {
                    attacker.tempEvadeNext = true;
                    this.log(`👑 ${attacker.charName} の「王の威厳」！ 完全回避の構え！`, 'text-amber-300 font-bold');
                    audioSystem.playBuff();
                } else {
                    attacker.hp = Math.min(attacker.maxHp, attacker.hp + 60);
                    this.log(`👑 ${attacker.charName} の「王の威厳」！ ライフが 60 回復！`, 'text-emerald-400 font-bold');
                    audioSystem.playHeal();
                }
                break;
            case 'dopa_godluck_skill':
                if (Math.random() < 0.05) {
                    defender.hp = Math.max(0, defender.hp - 1000);
                    this.triggerHitShake(defender);
                    this.log(`✨⚡【神頼み 5%的中！！】 ${defender.charName} に 1000 ダメージ！！`, 'text-yellow-300 font-black font-pixel text-base');
                    this.triggerCutin('⚡ 神頼み 5%的中！！', '奇跡の1000ダメージ炸裂！');
                    audioSystem.playSpecial();
                } else {
                    attacker.hp = Math.max(1, attacker.hp - 10);
                    this.triggerHitShake(attacker);
                    this.log(`🎲 神頼み… 自分に 10 のダメージ！`, 'text-red-400 font-bold');
                    audioSystem.playHit();
                }
                break;
            case 'courtney_charge_release':
                const charges = attacker.courtneyChargeCount || 0;
                let releaseDmg = 12;
                if (charges >= 7) releaseDmg = 110;
                else if (charges > 0) releaseDmg = 15 + (charges * 13);
                audioSystem.playSpecial();
                this.triggerEffect(attacker === this.p1 ? 'Player' : 'Enemy', 'damage', `🔥 ${releaseDmg} DMG!`);
                defender.hp = Math.max(0, defender.hp - releaseDmg);
                this.triggerHitShake(defender);
                this.log(`💖🔥 コートニーの 「FEEL SO HOT ///」解放！！ (溜め ${charges}回) ⇒ ${releaseDmg} ダメージ！！`, 'text-pink-400 font-black text-base');
                attacker.courtneyChargeCount = 0;
                break;
            case 'courtney_yoseru_skill':
                let yoseruDmg = Math.max(8, Math.floor(attacker.atk * 0.9 - defender.def * 0.3));
                defender.hp = Math.max(0, defender.hp - yoseruDmg);
                defender.buffDef = 0.0;
                this.triggerHitShake(defender);
                this.log(`💋 「ヨセル」！ 防御力 0 にした！`, 'text-pink-300 font-bold');
                audioSystem.playHit();
                break;
            case 'courtney_aegu_skill':
                attacker.tempEvadeNext = true;
                const healAmtAegu = Math.floor(attacker.maxHp * 0.45);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmtAegu);
                this.log(`✨ 「アエグ」！ ライフ ${healAmtAegu} 回復＆完全回避構え！`, 'text-pink-300 font-bold');
                audioSystem.playHeal();
                break;
            case 'eggplant_burst':
                this.log(`🐘 「超ナスちん乱舞」発動！！`, 'text-purple-300 font-bold');
                this.applyDamageSkill(attacker, defender, skill);
                attacker.isMiniZou = false;
                attacker.eggplantReady = false;
                break;
            case 'momo_chie_skill':
                const hChie = Math.floor(attacker.maxHp * 0.35);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + hChie);
                attacker.eva = (attacker.eva || 10) + 20;
                attacker.momoEvaTurns = 2;
                this.log(`🩷 「チエを呼ぶ」！ 回復＆回避アップ！`, 'text-pink-300 font-bold');
                audioSystem.playHeal();
                break;
            case 'asaiomizu_dig_skill':
                const dummyAttack = { name: '髪をかきあげる', type: 'attack', power: 1.15, isNormalAttack: true };
                this.applyDamageSkill(attacker, defender, dummyAttack);
                attacker.digActive = true;
                attacker.digUsedTurn = this.turn;
                this.log(`🕳️ ディグ発動！`, 'text-cyan-300 font-bold');
                break;
            case 'asaiomizu_club_skill':
                attacker.critRateBonus = (attacker.critRateBonus || 0) + 0.40;
                attacker.asaiomizuCritTurns = 2;
                this.log(`🎵 クラブに行く！ クリティカル率大幅向上！`, 'text-cyan-300 font-bold');
                audioSystem.playBuff();
                break;
            case 'debuff_attack':
                this.applyDamageSkill(attacker, defender, skill);
                defender.buffAtk *= 0.86;
                defender.buffDef *= 0.86;
                this.log(`📉 相手の能力低下！`, 'text-cyan-300 font-bold');
                audioSystem.playHit();
                break;
            case 'debuff':
                defender.buffAtk *= 0.80;
                defender.buffDef *= 0.80;
                this.log(`🎯 戦術成功！`, 'text-cyan-300 font-bold');
                audioSystem.playBuff();
                break;
            case 'heal_cleanse':
                const hCleanseAmt = Math.floor(attacker.maxHp * 0.20);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + hCleanseAmt);
                this.log(`💚 HP回復＆デバフリセット！`, 'text-emerald-400 font-bold');
                audioSystem.playHeal();
                break;
            case 'heal':
            case 'heal_club':
                const healAmt = Math.floor(attacker.maxHp * (skill.healRate || 0.3));
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);
                this.log(`💚 HP回復 (${healAmt})！`, 'text-emerald-400');
                audioSystem.playHeal();
                break;
            case 'buff':
                attacker.buffAtk = skill.amount || 1.4;
                attacker.buffAtkTurns = 2;
                this.log(`⚡ 攻撃力アップ！`, 'text-amber-300');
                audioSystem.playBuff();
                break;
            case 'charge':
                attacker.isMiniZou = true;
                attacker.eggplantReady = true;
                this.log(`🐘 ゾウに変身＆ナスを蓄積！`, 'text-purple-300 font-bold');
                audioSystem.playBuff();
                break;
            case 'defend_buff':
                attacker.defendBuffTurns = 2;
                this.log(`🛡️ 鉄壁ガード！`, 'text-blue-300 font-bold');
                audioSystem.playBuff();
                break;
            case 'heal_buff':
                const hAmt = Math.floor(attacker.maxHp * 0.20);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + hAmt);
                attacker.buffDef *= 1.35;
                this.log(`♨️ 回復＆防御アップ！`, 'text-emerald-300');
                audioSystem.playHeal();
                break;
            case 'pasha_crime_skill':
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + 110);
                attacker.buffDef *= 0.7;
                this.log(`🖤 パーフェクトクライム！`, 'text-purple-300 font-bold');
                audioSystem.playHeal();
                break;
            case 'pasha_nightmare_skill':
                attacker.buffAtk *= 1.3;
                attacker.nightmareAtkActive = true;
                defender.buffDef *= 0.5;
                this.log(`🖤💥 アブソリュートナイトメア！`, 'text-purple-400 font-black text-base');
                this.applyDamageSkill(attacker, defender, skill);
                break;
        }
    }

    applyDamageSkill(attacker, defender, skill, isCounter = false) {
        const isStealth = (skill.id === 'pasha_dark_stealth');

        if (defender.tempEvadeNext && !isStealth) {
            defender.tempEvadeNext = false;
            this.log(`✨ ${defender.charName} は攻撃を完全回避した！`, 'text-pink-300 font-bold');
            audioSystem.playEvade();
            this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'miss', '絶対回避!');
            return;
        }

        if (attacker.id === 'ndaihyo' && skill.isNormalAttack && defender.id === 'pasha' && !attacker.pashaKillerUsed) {
            attacker.pashaKillerUsed = true;
            const killerDamage = Math.max(1, Math.floor(defender.hp * 0.5));
            defender.hp = Math.max(0, defender.hp - killerDamage);
            this.log(`🎯💥【パシャ僧キラー発動！！】 現HP 50% (${killerDamage}) を粉砕！！`, 'text-red-400 font-bold');
            this.triggerCutin('🎯 パシャ僧キラー発動！！', '現在HP 50% を粉砕！');
            this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'damage', `-${killerDamage}`);
            audioSystem.playSpecial();
            return;
        }

        if (!isStealth) {
            const effectiveEva = Math.max(0, (defender.eva || 10) - (defender.evaDebuff || 0));
            const hitRate = 100 - effectiveEva;
            if (Math.random() * 100 > hitRate) {
                this.log(`🌀 ${defender.charName} は攻撃を回避した！`, 'text-sky-300');
                audioSystem.playEvade();
                this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'miss', 'MISS');
                return;
            }
        }

        let baseDmg = (attacker.atk * (skill.power || 1.0) * attacker.buffAtk) - (defender.def * 0.4 * defender.buffDef);
        let damage = Math.max(8, Math.floor(baseDmg + (Math.random() * 4 - 2)));

        let effectiveCritRate = (attacker.critRate || 0.05) + (attacker.critRateBonus || 0);
        if (Math.random() < effectiveCritRate) {
            damage = Math.floor(damage * 1.5);
            audioSystem.playCrit();
            this.log(`🔥✨【クリティカルヒット！！】 1.5倍 (${damage})！！`, 'text-yellow-300 font-black text-base');
            this.triggerCutin('🔥 クリティカルヒット！！', '会心の一撃！');
            this.triggerEffect(defender === this.p1 ? 'Player' : 'Enemy', 'buff', 'CRITICAL!');
        }

        if (defender.defendBuffTurns > 0) {
            damage = Math.max(3, Math.floor(damage * 0.3));
        }

        if (this.isSuddenDeath) {
            damage = Math.floor(damage * 1.35);
        }

        defender.hp = Math.max(0, defender.hp - damage);
        this.triggerHitShake(defender);
        const side = defender === this.p1 ? 'Player' : 'Enemy';
        this.log(`⚔ ${defender.charName} に ${damage} のダメージ！`, 'text-red-400 font-bold');
        this.triggerEffect(side, 'damage', `-${damage}`);
        audioSystem.playHit();

        if (!isCounter && defender.id === 'asaiomizu' && defender.hp > 0 && Math.random() < 0.5) {
            this.executeCounter(defender, attacker);
        }
    }

    executeCounter(defender, attacker) {
        if (defender.hp <= 0) return;
        this.log(`⚡ ${defender.charName} のナルシストカウンター発動！`, 'text-cyan-300 font-bold');
        const counterSkill = defender.skills.find(s => s.isNormalAttack) || defender.skills[0];
        this.applyDamageSkill(defender, attacker, counterSkill, true);
    }

    async checkWinner() {
        if (this.battleEnded) return true;

        let winnerText = '';
        let isEnded = false;

        if (this.p1.hp <= 0 && this.p2.hp <= 0) {
            winnerText = '⚔️ 引き分け！';
            isEnded = true;
        } else if (this.p2.hp <= 0) {
            winnerText = `🎉 【${this.p1.charName}】の勝利！`;
            isEnded = true;
            audioSystem.playVictory();
            if (!this.isOnline || this.myPlayerNum === 1) {
                await addDopa(100);
            }
        } else if (this.p1.hp <= 0) {
            winnerText = `💀 敗北…`;
            isEnded = true;
            audioSystem.playDefeat();
            if (this.isOnline && this.myPlayerNum === 2) {
                await addDopa(100);
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
            }

            const myCharId = (this.isOnline && this.myPlayerNum === 2) ? this.p2.id : this.p1.id;
            const oppChar = (this.isOnline && this.myPlayerNum === 2) ? this.p1 : this.p2;
            const oppCharId = oppChar.id;
            const oppProfile = this.latestRoomData ? (this.myPlayerNum === 1 ? this.latestRoomData.p2Profile : this.latestRoomData.p1Profile) : null;
            const oppName = oppProfile?.playerName || oppChar.charName || '対戦相手';
            const oppIcon = oppProfile?.selectedIcon || oppChar.id;
            const isBot = !this.isOnline;

            if (typeof recordBattleResult === 'function') {
                recordBattleResult(result, myCharId, oppName, oppIcon, isBot, isBot ? null : 'online_opp', oppProfile, oppCharId);
            }

            if (this.onBattleEnd) this.onBattleEnd(winnerText);
            return true;
        }

        return false;
    }

    endTurnPhase() {
        this.turn++;
        [this.p1, this.p2].forEach(p => {
            if (p.tempEvadeNext) p.tempEvadeNext = false;
            Object.keys(p.cooldowns).forEach(key => {
                if (p.cooldowns[key] > 0) p.cooldowns[key]--;
            });
            if (p.defendBuffTurns > 0) p.defendBuffTurns--;
            if (p.buffAtkTurns > 0) {
                p.buffAtkTurns--;
                if (p.buffAtkTurns === 0) p.buffAtk = 1.0;
            }
            if (p.critBuffTurns > 0) {
                p.critBuffTurns--;
                if (p.critBuffTurns === 0) p.critRateBonus = 0;
            }
        });

        if (this.turn >= 30 && !this.isSuddenDeath) {
            this.isSuddenDeath = true;
            this.log('🔥 30ターン経過！サドンデスモード突入！', 'text-red-500 font-black text-center');
            this.triggerCutin('🔥 サドンデス突入！', '与ダメージ1.35倍！');
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
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}

// Original Battle UI Functions
let activeBattle = null;

function confirmRetireBattle() {
    audioSystem.playSelect();
    showConfirmModal("バトル中断", "本当にバトルを中断して降参しますか？\n（ホーム画面に戻ります）", () => {
        if (activeBattle) {
            activeBattle.destroy();
            activeBattle = null;
        }
        renderHomeScreen();
    }, "降参する");
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

function launchBattle(p1Id, p2Id, isOnline = false, myPlayerNum = 1, roomId = null) {
    if (activeBattle) {
        activeBattle.destroy();
        activeBattle = null;
    }

    const container = document.getElementById('screen-container');
    container.innerHTML = `
        <div id="battle-stage" class="w-full flex flex-col gap-3 items-center justify-center relative transition-colors duration-200 landscape-battle-container">
            <div class="w-full flex flex-col gap-2.5 max-w-4xl landscape-battle-upper px-2">
                <div class="w-full grid grid-cols-2 gap-4">
                    <div id="p1-box-container" class="pixel-box p-2.5 bg-slate-900/90 relative border-blue-500 ring-2 ring-blue-500/50">
                        <div class="flex justify-between items-center mb-1">
                            <span id="p1-name-label" class="font-bold text-xs sm:text-sm text-blue-300 font-pixel truncate max-w-[140px]">自分</span>
                            <span id="p1-hp-text" class="text-xs sm:text-sm font-mono font-bold text-slate-200">100/100</span>
                        </div>
                        <div class="w-full bg-slate-950 h-2.5 sm:h-3 rounded-sm border border-slate-700 overflow-hidden p-0.5 mb-1.5">
                            <div id="p1-hp-bar" class="hp-bar-fill h-full bg-emerald-500 rounded-sm" style="width: 100%;"></div>
                        </div>
                        <div id="p1-status-badges" class="flex flex-wrap gap-1 text-[9px] sm:text-[10px] font-mono min-h-[14px]"></div>
                    </div>
                    <div id="p2-box-container" class="pixel-box p-2.5 bg-slate-900/90 relative border-red-500 ring-2 ring-red-500/50">
                        <div class="flex justify-between items-center mb-1">
                            <span id="p2-name-label" class="font-bold text-xs sm:text-sm text-red-300 font-pixel truncate max-w-[140px]">相手</span>
                            <span id="p2-hp-text" class="text-xs sm:text-sm font-mono font-bold text-slate-200">100/100</span>
                        </div>
                        <div class="w-full bg-slate-950 h-2.5 sm:h-3 rounded-sm border border-slate-700 overflow-hidden p-0.5 mb-1.5">
                            <div id="p2-hp-bar" class="hp-bar-fill h-full bg-emerald-500 rounded-sm" style="width: 100%;"></div>
                        </div>
                        <div id="p2-status-badges" class="flex flex-wrap gap-1 text-[9px] sm:text-[10px] font-mono min-h-[14px]"></div>
                    </div>
                </div>

                <div class="w-full grid grid-cols-5 gap-2 relative items-center justify-items-center my-1">
                    <div class="col-span-2 relative flex flex-col items-center w-full">
                        <div class="absolute -top-2.5 z-10 bg-blue-600 text-white font-pixel text-[9px] px-2 py-0.5 rounded border border-blue-300 shadow">YOU</div>
                        <canvas id="p1-canvas" width="200" height="200" class="pixel-box bg-slate-950 shadow-lg cursor-pointer border-2 border-blue-500 mt-1 w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36"></canvas>
                    </div>

                    <div class="col-span-1 flex flex-col items-center justify-center space-y-1.5 bg-slate-900/80 p-2 rounded border border-amber-500/50 shadow-md">
                        <div class="pixel-box-gold px-2 py-1 bg-amber-950/90 text-amber-300 font-pixel text-[10px] font-bold text-center shadow whitespace-nowrap">
                            🌟 ターン <span id="battle-turn-num">1</span>
                        </div>
                        <div class="flex items-center gap-1 text-[10px] whitespace-nowrap font-mono text-center">
                            <span class="text-slate-400">制限:</span>
                            <span id="turn-timer-display" class="font-pixel text-xs font-bold text-amber-400">15</span>秒
                        </div>
                        <button onclick="confirmRetireBattle()" class="pixel-btn pixel-btn-danger text-[9px] px-2 py-0.5 font-bold mt-1">🏳️ 降参</button>
                    </div>

                    <div class="col-span-2 relative flex flex-col items-center w-full">
                        <div class="absolute -top-2.5 z-10 bg-red-600 text-white font-pixel text-[9px] px-2 py-0.5 rounded border border-red-300 shadow">OPPONENT</div>
                        <canvas id="p2-canvas" width="200" height="200" class="pixel-box bg-slate-950 shadow-lg border-2 border-red-500 mt-1 w-24 h-24 sm:w-32 sm:h-32 lg:w-36 lg:h-36"></canvas>
                    </div>
                </div>

                <div id="battle-log-box" class="pixel-box p-2 bg-slate-950 w-full h-16 sm:h-24 overflow-y-auto text-[11px] font-mono space-y-1 border-slate-700"></div>
            </div>

            <div class="w-full flex flex-col gap-2 max-w-4xl landscape-battle-lower px-2">
                <div id="command-panel" class="w-full">
                    <div id="skill-buttons-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-2"></div>
                </div>
            </div>
        </div>
    `;

    activeBattle = new OriginalBattleEngine(p1Id, p2Id, isOnline, myPlayerNum, roomId);

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
        updateBattleUI();
        setTimeout(() => {
            const stage = document.getElementById('screen-container');
            if (!stage) return;
            const p1 = activeBattle.p1;
            const p2 = activeBattle.p2;
            const isP1Win = (activeBattle.isOnline && activeBattle.myPlayerNum === 2) ? (p2.hp <= 0 && p1.hp > 0) : (p2.hp <= 0 && p1.hp > 0);

            if (!isP1Win) {
                stage.innerHTML += `
                    <div id="battle-result-overlay" class="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center p-6 text-center">
                        <div class="text-4xl font-pixel font-black text-red-500 mb-3">LOSE</div>
                        <button onclick="renderBotModesScreen()" class="pixel-btn pixel-btn-primary px-8 py-3 text-sm font-bold font-pixel">バトル選択画面へ戻る ▶</button>
                    </div>
                `;
            } else {
                stage.innerHTML += `
                    <div id="battle-result-overlay" class="fixed inset-0 bg-black/90 z-[9999] flex flex-col items-center justify-center p-6 text-center">
                        <div class="pixel-box-gold p-8 bg-amber-950/95 border-amber-400 max-w-md w-full flex flex-col items-center">
                            <div class="text-4xl font-pixel font-black text-amber-300 mb-2">WIN</div>
                            <p class="text-xs text-amber-200 mb-4">+100 DOPA 獲得！</p>
                            <button onclick="renderBotModesScreen()" class="pixel-btn pixel-btn-primary px-8 py-3 text-sm font-bold font-pixel">バトル選択画面へ戻る ▶</button>
                        </div>
                    </div>
                `;
            }
        }, 1000);
    };

    activeBattle.startBattle();
    updateBattleUI();
}

function updateBattleUI() {
    if (!activeBattle) return;

    const turnNumEl = document.getElementById('battle-turn-num');
    if (turnNumEl) turnNumEl.innerText = activeBattle.turn;

    const p1 = activeBattle.p1;
    const p2 = activeBattle.p2;

    const p1Label = document.getElementById('p1-name-label');
    const p2Label = document.getElementById('p2-name-label');
    const p1HpText = document.getElementById('p1-hp-text');
    const p2HpText = document.getElementById('p2-hp-text');
    const p1HpBar = document.getElementById('p1-hp-bar');
    const p2HpBar = document.getElementById('p2-hp-bar');

    if (p1Label) p1Label.innerText = p1.charName;
    if (p2Label) p2Label.innerText = p2.charName;
    if (p1HpText) p1HpText.innerText = `${p1.hp}/${p1.maxHp}`;
    if (p2HpText) p2HpText.innerText = `${p2.hp}/${p2.maxHp}`;

    if (p1HpBar) {
        const pct1 = Math.max(0, Math.min(100, (p1.hp / p1.maxHp) * 100));
        p1HpBar.style.width = `${pct1}%`;
    }
    if (p2HpBar) {
        const pct2 = Math.max(0, Math.min(100, (p2.hp / p2.maxHp) * 100));
        p2HpBar.style.width = `${pct2}%`;
    }

    const p1Cvs = document.getElementById('p1-canvas');
    const p2Cvs = document.getElementById('p2-canvas');

    if (p1Cvs) CharacterRenderer.drawCharacter(p1Cvs, p1.id, p1.isMiniZou, false, p1.hp <= 0);
    if (p2Cvs) CharacterRenderer.drawCharacter(p2Cvs, p2.id, p2.isMiniZou, false, p2.hp <= 0);

    const grid = document.getElementById('skill-buttons-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const activePlayer = activeBattle.myPlayerNum === 1 ? p1 : p2;
    const isMyTurnBlocked = activeBattle.battleEnded || activeBattle.waitingForOpponent || activePlayer.isResting;

    activePlayer.skills.forEach(s => {
        const cd = activePlayer.cooldowns[s.id] || 0;
        const disabled = isMyTurnBlocked || (cd > 0);

        const btn = document.createElement('button');
        btn.className = `pixel-btn p-2 text-xs font-bold flex flex-col items-center justify-center ${disabled ? 'pixel-btn-disabled' : 'pixel-btn-primary'}`;
        btn.disabled = disabled;
        btn.innerHTML = `<span class="font-pixel text-xs mb-0.5">${s.name} ${cd > 0 ? `(CT:${cd})` : ''}</span><span class="text-[10px] text-slate-300 font-mono truncate max-w-full">${s.desc}</span>`;
        btn.onclick = () => activeBattle.submitAction(activeBattle.myPlayerNum, s.id);
        grid.appendChild(btn);
    });
}
