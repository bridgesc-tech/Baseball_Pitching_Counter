// Baseball Pitching Counter Application
class BaseballPitchingCounter {
    constructor() {
        this.players = [];
        this.firebaseEnabled = false;
        this.gameId = this.getOrCreateGameId();
        this.gameName = this.loadGameName();
        
        // Current pitch tracking state
        this.currentPlayerId = null;
        this.selectedPitchType = null;
        this.selectedSwing = null;
        this.selectedResult = null;
        
        // Pitch types
        this.pitchTypes = ['fastball', 'curveball', 'slider', 'changeup', 'cutter', 'splitter'];
        
        // Wait for Firebase scripts to load, then initialize
        this.waitForFirebase(() => {
            this.initializeFirebase();
            this.loadPlayers().then(() => {
                this.initializeApp();
            }).catch(error => {
                console.error('Error loading players:', error);
                this.initializeApp();
            });
        });
    }

    waitForFirebase(callback, attempts = 0) {
        const maxAttempts = 20;
        if (typeof firebase !== 'undefined' || attempts >= maxAttempts) {
            callback();
        } else {
            setTimeout(() => {
                this.waitForFirebase(callback, attempts + 1);
            }, 100);
        }
    }

    // Get or create a unique 6-digit game ID for syncing
    getOrCreateGameId() {
        let gameId = localStorage.getItem('pitchingCounterGameId');
        if (!gameId) {
            // Generate a 6-digit numeric code
            gameId = Math.floor(100000 + Math.random() * 900000).toString();
            localStorage.setItem('pitchingCounterGameId', gameId);
        }
        return gameId;
    }

    loadGameName() {
        return localStorage.getItem('pitchingCounterGameName') || '';
    }

    saveGameName(name) {
        this.gameName = name;
        localStorage.setItem('pitchingCounterGameName', name);
        if (this.firebaseEnabled) {
            const firebaseDb = (typeof window !== 'undefined' && window.db) ? window.db : (typeof db !== 'undefined' ? db : null);
            if (firebaseDb) {
                firebaseDb.collection('pitchingCounterGames').doc(this.gameId).set({
                    gameName: name,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        }
        this.updateGameNameDisplay();
    }

    // Initialize Firebase connection
    initializeFirebase() {
        const checkFirebase = () => {
            // Check for window.db (from firebase-config.js) or global db
            const firebaseDb = (typeof window !== 'undefined' && window.db) ? window.db : (typeof db !== 'undefined' ? db : null);
            
            if (typeof window !== 'undefined' && firebaseDb !== null && window.location.protocol !== 'file:') {
                this.firebaseEnabled = true;
                console.log('Firebase sync enabled for game:', this.gameId);
                
                // Listen for real-time updates from other devices
                firebaseDb.collection('pitchingCounterGames').doc(this.gameId)
                    .onSnapshot((docSnapshot) => {
                        if (docSnapshot.exists) {
                            const data = docSnapshot.data();
                            if (data.gameName) {
                                this.gameName = data.gameName;
                                localStorage.setItem('pitchingCounterGameName', this.gameName);
                                this.updateGameNameDisplay();
                            }
                            if (data.players) {
                                this.players = data.players;
                                this.saveToLocalStorage();
                                this.renderPlayers();
                                console.log('Synced from cloud');
                            }
                        }
                    }, (error) => {
                        console.error('Firebase sync error:', error);
                    });
                
                this.updateSyncStatus();
                this.updateSettingsModal();
                return true;
            }
            return false;
        };
        
        if (!checkFirebase()) {
            // Listen for Firebase ready event
            window.addEventListener('firebaseReady', () => {
                if (checkFirebase()) {
                    // Already set up listener in checkFirebase
                }
            });
            
            setTimeout(() => {
                if (!checkFirebase()) {
                    console.log('Firebase not configured - running in local-only mode');
                    this.updateSyncStatus();
                    this.updateSettingsModal();
                }
            }, 500);
        }
    }

    updateSettingsModal() {
        const syncStatusEl = document.getElementById('firebaseSyncStatus');
        const gameIdEl = document.getElementById('firebaseGameId');
        
        if (syncStatusEl) {
            if (this.firebaseEnabled) {
                syncStatusEl.textContent = '☁️ Connected';
                syncStatusEl.style.color = '#52C41A';
            } else if (window.location.protocol === 'file:') {
                syncStatusEl.textContent = '📁 File Protocol (Disabled)';
                syncStatusEl.style.color = '#FAAD14';
            } else {
                syncStatusEl.textContent = '❌ Not Available';
                syncStatusEl.style.color = '#e74c3c';
            }
        }
        
        if (gameIdEl) {
            gameIdEl.textContent = this.gameId;
        }
    }

    async manualSyncToFirebase() {
        if (!this.firebaseEnabled || window.location.protocol === 'file:') {
            const messageEl = document.getElementById('firebaseSyncMessage');
            if (messageEl) {
                messageEl.textContent = 'Firebase requires HTTP/HTTPS. Deploy to GitHub Pages to enable sync.';
                messageEl.style.color = '#e74c3c';
            }
            return;
        }

        const messageEl = document.getElementById('firebaseSyncMessage');
        if (messageEl) {
            messageEl.textContent = 'Syncing...';
            messageEl.style.color = '#DC143C';
        }

        try {
            const firebaseDb = (typeof window !== 'undefined' && window.db) ? window.db : (typeof db !== 'undefined' ? db : null);
            if (!firebaseDb) {
                throw new Error('Firebase not available');
            }

            await firebaseDb.collection('pitchingCounterGames').doc(this.gameId).set({
                players: this.players,
                gameName: this.gameName,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            if (messageEl) {
                messageEl.textContent = '✓ Synced successfully!';
                messageEl.style.color = '#52C41A';
                setTimeout(() => {
                    messageEl.textContent = '';
                }, 3000);
            }
        } catch (error) {
            console.error('Manual sync error:', error);
            if (messageEl) {
                messageEl.textContent = '✗ Sync failed. Please try again.';
                messageEl.style.color = '#e74c3c';
            }
        }
    }

    async loadPlayers() {
        if (this.firebaseEnabled) {
            try {
                const firebaseDb = (typeof window !== 'undefined' && window.db) ? window.db : (typeof db !== 'undefined' ? db : null);
                if (!firebaseDb) return this.loadFromLocalStorage();
                
                const docSnapshot = await firebaseDb.collection('pitchingCounterGames').doc(this.gameId).get();
                if (docSnapshot.exists) {
                    const data = docSnapshot.data();
                    if (data.players) {
                        this.players = data.players;
                        this.saveToLocalStorage();
                    }
                    if (data.gameName) {
                        this.gameName = data.gameName;
                        localStorage.setItem('pitchingCounterGameName', this.gameName);
                        this.updateGameNameDisplay();
                    }
                    return this.players;
                }
            } catch (error) {
                console.error('Error loading from Firebase:', error);
            }
        }
        
        const stored = localStorage.getItem('pitchingCounterPlayers');
        this.players = stored ? JSON.parse(stored) : [];
        return this.players;
    }

    savePlayers() {
        this.saveToLocalStorage();
        
        if (this.firebaseEnabled) {
            const firebaseDb = (typeof window !== 'undefined' && window.db) ? window.db : (typeof db !== 'undefined' ? db : null);
            if (!firebaseDb) return;
            
            firebaseDb.collection('pitchingCounterGames').doc(this.gameId).set({
                players: this.players,
                gameName: this.gameName,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true })
            .then(() => {
                console.log('Synced to cloud');
            })
            .catch((error) => {
                console.error('Error syncing to Firebase:', error);
            });
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('pitchingCounterPlayers', JSON.stringify(this.players));
    }

    initializeApp() {
        if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => {});
        }

        this.updateSyncStatus();
        this.updateGameNameDisplay();
        this.setupGameIdUI();
        this.setupSettings();

        // Add player button
        document.getElementById('addPlayerBtn').addEventListener('click', () => this.addPlayer());
        document.getElementById('playerNumberInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addPlayer();
        });
        
        // Modal close buttons
        document.getElementById('closeModal').addEventListener('click', () => this.closePitchModal());
        document.getElementById('closeStatsModal').addEventListener('click', () => this.closeStatsModal());

        // Pitch type buttons
        document.querySelectorAll('.pitch-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectPitchType(e.target.dataset.type);
            });
        });

        // Swing buttons
        document.querySelectorAll('.swing-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectSwing(e.target.dataset.swing);
            });
        });

        // Result buttons
        document.querySelectorAll('.result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectResult(e.target.dataset.result);
            });
        });

        // Record pitch button
        document.getElementById('recordPitchBtn').addEventListener('click', () => this.recordPitch());

        // Delete player button
        document.getElementById('deletePlayerBtn').addEventListener('click', () => this.deleteCurrentPlayer());

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            const pitchModal = document.getElementById('pitchModal');
            const statsModal = document.getElementById('statsModal');
            const gameModal = document.getElementById('gameModal');
            if (e.target === pitchModal) {
                this.closePitchModal();
            }
            if (e.target === statsModal) {
                this.closeStatsModal();
            }
            if (e.target === gameModal) {
                this.closeGameModal();
            }
        });

        // Game Sync Modal button
        document.getElementById('openGameModalBtn').addEventListener('click', () => {
            this.openGameModal();
        });
        document.getElementById('closeGameModal').addEventListener('click', () => {
            this.closeGameModal();
        });

        // Save game name button
        document.getElementById('saveGameNameBtn').addEventListener('click', () => {
            this.saveGameNameInput();
        });

        // Enter key in game name input
        document.getElementById('gameNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveGameNameInput();
            }
        });

        // Create new game button
        document.getElementById('createNewGameBtn').addEventListener('click', () => {
            this.createNewGame();
        });

        this.renderPlayers();
    }

    addPlayer() {
        const input = document.getElementById('playerNumberInput');
        const number = parseInt(input.value.trim());
        
        if (!number || number < 1 || number > 99) {
            alert('Please enter a valid player number (1-99)');
            return;
        }
        
        if (this.players.some(player => player.number === number)) {
            alert('Player #' + number + ' already exists');
            input.value = '';
            return;
        }
        
        const newPlayer = {
            id: Date.now().toString(),
            number: number,
            pitches: [],
            createdAt: new Date().toISOString()
        };

        this.players.push(newPlayer);
        this.savePlayers();
        input.value = '';
        this.renderPlayers();
    }

    deletePlayer(playerId) {
        if (confirm('Are you sure you want to remove this player?')) {
            this.players = this.players.filter(player => player.id !== playerId);
            this.savePlayers();
            this.renderPlayers();
        }
    }

    deleteCurrentPlayer() {
        if (this.currentPlayerId) {
            this.deletePlayer(this.currentPlayerId);
            this.closeStatsModal();
        }
    }

    openPitchModal(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        this.currentPlayerId = playerId;
        this.selectedPitchType = null;
        this.selectedSwing = null;
        this.selectedResult = null;
        
        document.getElementById('modalPlayerNumber').textContent = `Player #${player.number}`;
        document.getElementById('pitchModal').style.display = 'block';
        
        // Reset UI
        document.querySelectorAll('.pitch-type-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.swing-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.result-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('resultSection').style.display = 'none';
        document.getElementById('recordPitchBtn').style.display = 'none';
        this.updateSummary();
    }

    openStatsModal(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        this.currentPlayerId = playerId;
        document.getElementById('statsModalPlayerNumber').textContent = `Player #${player.number}`;
        document.getElementById('statsModal').style.display = 'block';
        this.renderDetailedStats(player);
    }

    selectPitchType(type) {
        this.selectedPitchType = type;
        document.querySelectorAll('.pitch-type-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === type) {
                btn.classList.add('active');
            }
        });
        this.updateSummary();
    }

    selectSwing(swing) {
        this.selectedSwing = swing;
        document.querySelectorAll('.swing-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.swing === swing) {
                btn.classList.add('active');
            }
        });
        
        // Show result section only if they swung
        if (swing === 'yes') {
            document.getElementById('resultSection').style.display = 'block';
            this.selectedResult = null; // Reset result
            document.querySelectorAll('.result-btn').forEach(btn => btn.classList.remove('active'));
        } else {
            document.getElementById('resultSection').style.display = 'none';
            this.selectedResult = null;
        }
        this.updateSummary();
    }

    selectResult(result) {
        this.selectedResult = result;
        document.querySelectorAll('.result-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.result === result) {
                btn.classList.add('active');
            }
        });
        this.updateSummary();
    }

    updateSummary() {
        const canRecord = this.selectedPitchType && this.selectedSwing && 
                         (this.selectedSwing === 'no' || this.selectedResult);
        
        if (canRecord) {
            document.getElementById('recordPitchBtn').style.display = 'block';
        } else {
            document.getElementById('recordPitchBtn').style.display = 'none';
        }

        // Update summary stats
        const player = this.players.find(p => p.id === this.currentPlayerId);
        if (player) {
            const stats = this.calculateStats(player);
            document.getElementById('summaryStats').innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Total Pitches:</span>
                    <span class="stat-value">${stats.totalPitches}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Swings:</span>
                    <span class="stat-value">${stats.swings}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Hits:</span>
                    <span class="stat-value">${stats.hits}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Misses:</span>
                    <span class="stat-value">${stats.misses}</span>
                </div>
            `;
        }
    }

    recordPitch() {
        if (!this.selectedPitchType || !this.selectedSwing) return;
        if (this.selectedSwing === 'yes' && !this.selectedResult) return;

        const player = this.players.find(p => p.id === this.currentPlayerId);
        if (!player) return;

        const pitch = {
            id: Date.now().toString(),
            type: this.selectedPitchType,
            swing: this.selectedSwing,
            result: this.selectedSwing === 'yes' ? this.selectedResult : null,
            timestamp: new Date().toISOString()
        };

        player.pitches.push(pitch);
        this.savePlayers();
        this.renderPlayers();
        
        // Reset and keep modal open for quick entry
        this.selectedPitchType = null;
        this.selectedSwing = null;
        this.selectedResult = null;
        
        document.querySelectorAll('.pitch-type-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.swing-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.result-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('resultSection').style.display = 'none';
        document.getElementById('recordPitchBtn').style.display = 'none';
        this.updateSummary();
    }

    calculateStats(player) {
        const pitches = player.pitches || [];
        const totalPitches = pitches.length;
        const swings = pitches.filter(p => p.swing === 'yes').length;
        const hits = pitches.filter(p => p.result === 'hit').length;
        const misses = pitches.filter(p => p.result === 'miss').length;

        // Count by pitch type
        const pitchTypeCounts = {};
        this.pitchTypes.forEach(type => {
            pitchTypeCounts[type] = pitches.filter(p => p.type === type).length;
        });

        return {
            totalPitches,
            swings,
            hits,
            misses,
            pitchTypeCounts
        };
    }

    renderPlayers() {
        const container = document.getElementById('playersList');
        const emptyState = document.getElementById('emptyState');

        if (this.players.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = '';

        this.players.forEach(player => {
            const stats = this.calculateStats(player);
            const card = document.createElement('div');
            card.className = 'player-card';
            
            card.innerHTML = `
                <div class="player-header">
                    <h3>Player #${player.number}</h3>
                    <button class="delete-btn" onclick="app.deletePlayer('${player.id}')" aria-label="Delete player">×</button>
                </div>
                <div class="stats-overview">
                    <div class="stat-box">
                        <span class="stat-label-small">Total</span>
                        <span class="stat-value-large">${stats.totalPitches}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label-small">Swings</span>
                        <span class="stat-value-large">${stats.swings}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label-small">Hits</span>
                        <span class="stat-value-large">${stats.hits}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label-small">Misses</span>
                        <span class="stat-value-large">${stats.misses}</span>
                    </div>
                </div>
                <div class="player-actions">
                    <button class="btn btn-secondary" onclick="app.openPitchModal('${player.id}')">Record Pitch</button>
                    <button class="btn btn-secondary" onclick="app.openStatsModal('${player.id}')">View Stats</button>
                </div>
            `;

            container.appendChild(card);
        });
    }

    renderDetailedStats(player) {
        const stats = this.calculateStats(player);
        const statsDisplay = document.getElementById('statsDisplay');
        
        let html = `
            <div class="detailed-stats">
                <div class="stats-section">
                    <h3>Overall Stats</h3>
                    <div class="stats-grid">
                        <div class="detailed-stat-item">
                            <span class="stat-label">Total Pitches:</span>
                            <span class="stat-value">${stats.totalPitches}</span>
                        </div>
                        <div class="detailed-stat-item">
                            <span class="stat-label">Swings:</span>
                            <span class="stat-value">${stats.swings}</span>
                        </div>
                        <div class="detailed-stat-item">
                            <span class="stat-label">Didn't Swing:</span>
                            <span class="stat-value">${stats.totalPitches - stats.swings}</span>
                        </div>
                        <div class="detailed-stat-item">
                            <span class="stat-label">Hits:</span>
                            <span class="stat-value">${stats.hits}</span>
                        </div>
                        <div class="detailed-stat-item">
                            <span class="stat-label">Misses:</span>
                            <span class="stat-value">${stats.misses}</span>
                        </div>
                        <div class="detailed-stat-item">
                            <span class="stat-label">Hit Rate:</span>
                            <span class="stat-value">${stats.swings > 0 ? ((stats.hits / stats.swings) * 100).toFixed(1) : '0'}%</span>
                        </div>
                    </div>
                </div>
                
                <div class="stats-section">
                    <h3>By Pitch Type</h3>
                    <div class="pitch-type-stats">
        `;

        this.pitchTypes.forEach(type => {
            const count = stats.pitchTypeCounts[type] || 0;
            const swings = player.pitches.filter(p => p.type === type && p.swing === 'yes').length;
            const hits = player.pitches.filter(p => p.type === type && p.result === 'hit').length;
            const misses = player.pitches.filter(p => p.type === type && p.result === 'miss').length;
            
            html += `
                <div class="pitch-type-stat-item">
                    <div class="pitch-type-name">${this.formatPitchType(type)}</div>
                    <div class="pitch-type-numbers">
                        <span>Total: ${count}</span>
                        <span>Swing: ${swings}</span>
                        <span>Hit: ${hits}</span>
                        <span>Miss: ${misses}</span>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        statsDisplay.innerHTML = html;
    }

    formatPitchType(type) {
        const types = {
            fastball: '⚡ Fastball',
            curveball: '🌀 Curveball',
            slider: '➡️ Slider',
            changeup: '🐢 Changeup',
            cutter: '✂️ Cutter',
            splitter: '✋ Splitter'
        };
        return types[type] || type;
    }

    closePitchModal() {
        document.getElementById('pitchModal').style.display = 'none';
        this.currentPlayerId = null;
        this.selectedPitchType = null;
        this.selectedSwing = null;
        this.selectedResult = null;
    }

    closeStatsModal() {
        document.getElementById('statsModal').style.display = 'none';
        this.currentPlayerId = null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateSyncStatus() {
        const statusEl = document.getElementById('syncStatus');
        if (statusEl) {
            if (this.firebaseEnabled) {
                statusEl.innerHTML = '🟢 Syncing across devices';
                statusEl.style.color = '#90EE90';
                statusEl.style.fontWeight = '600';
            } else {
                statusEl.innerHTML = '⚪ Local mode (Firebase not configured)';
                statusEl.style.color = 'rgba(255, 255, 255, 0.8)';
                statusEl.style.fontWeight = '500';
            }
        }
    }

    updateGameNameDisplay() {
        const gameNameDisplay = document.getElementById('gameNameDisplay');
        const subtitle = document.getElementById('subtitleText');
        
        if (gameNameDisplay) {
            if (this.gameName) {
                gameNameDisplay.textContent = this.gameName;
                gameNameDisplay.style.display = 'block';
            } else {
                gameNameDisplay.textContent = '';
                gameNameDisplay.style.display = 'none';
            }
        }
        
        if (subtitle && !this.gameName) {
            subtitle.textContent = 'Track opponent player pitches during the game';
        } else if (subtitle && this.gameName) {
            subtitle.textContent = '';
        }
    }

    saveGameNameInput() {
        const input = document.getElementById('gameNameInput');
        const name = input.value.trim();
        if (name) {
            this.saveGameName(name);
            input.value = name;
            const saveBtn = document.getElementById('saveGameNameBtn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '✓ Saved!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
            }, 2000);
        }
    }

    createNewGame() {
        if (confirm('Create a new game? This will generate a new Game Code and clear all current players and data. Continue?')) {
            // Generate new 6-digit game ID
            this.gameId = Math.floor(100000 + Math.random() * 900000).toString();
            localStorage.setItem('pitchingCounterGameId', this.gameId);
            
            // Clear players
            this.players = [];
            this.savePlayers();
            
            // Clear game name
            this.gameName = '';
            localStorage.removeItem('pitchingCounterGameName');
            this.updateGameNameDisplay();
            
            // Clear game name input
            const gameNameInput = document.getElementById('gameNameInput');
            if (gameNameInput) {
                gameNameInput.value = '';
            }
            
            // Update game ID display
            const gameIdDisplay = document.getElementById('gameIdDisplay');
            if (gameIdDisplay) {
                gameIdDisplay.value = this.gameId;
            }
            
            // Clear game ID input
            const gameIdInput = document.getElementById('gameIdInput');
            if (gameIdInput) {
                gameIdInput.value = '';
            }
            
            // Reinitialize Firebase connection if enabled
            if (this.firebaseEnabled) {
                location.reload();
            } else {
                this.renderPlayers();
                alert('New game created! Game Code: ' + this.gameId);
            }
        }
    }

    openGameModal() {
        const gameIdDisplay = document.getElementById('gameIdDisplay');
        const gameNameInput = document.getElementById('gameNameInput');
        if (gameIdDisplay) {
            gameIdDisplay.value = this.gameId;
        }
        if (gameNameInput) {
            gameNameInput.value = this.gameName || '';
        }
        document.getElementById('gameModal').style.display = 'block';
    }

    closeGameModal() {
        document.getElementById('gameModal').style.display = 'none';
    }

    setupSettings() {
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsModal = document.getElementById('closeSettingsModal');
        const manualSyncBtn = document.getElementById('manualSyncBtn');
        const openGameModalFromSettingsBtn = document.getElementById('openGameModalFromSettingsBtn');

        if (settingsBtn && settingsModal) {
            settingsBtn.addEventListener('click', () => {
                this.updateSettingsModal();
                settingsModal.style.display = 'block';
            });
        }

        if (closeSettingsModal && settingsModal) {
            closeSettingsModal.addEventListener('click', () => {
                settingsModal.style.display = 'none';
            });
        }

        if (manualSyncBtn) {
            manualSyncBtn.addEventListener('click', () => {
                this.manualSyncToFirebase();
            });
        }

        if (openGameModalFromSettingsBtn) {
            openGameModalFromSettingsBtn.addEventListener('click', () => {
                settingsModal.style.display = 'none';
                this.openGameModal();
            });
        }

        // Close modal when clicking outside
        if (settingsModal) {
            window.addEventListener('click', (event) => {
                if (event.target === settingsModal) {
                    settingsModal.style.display = 'none';
                }
            });
        }
    }

    setupGameIdUI() {
        const copyBtn = document.getElementById('copyGameIdBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const gameIdInput = document.getElementById('gameIdDisplay');
                gameIdInput.select();
                gameIdInput.setSelectionRange(0, 99999);
                try {
                    document.execCommand('copy');
                    copyBtn.textContent = 'Copied!';
                    copyBtn.style.background = '#52C41A';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy';
                        copyBtn.style.background = '';
                    }, 2000);
                } catch (err) {
                    navigator.clipboard.writeText(this.gameId).then(() => {
                        copyBtn.textContent = 'Copied!';
                        copyBtn.style.background = '#52C41A';
                        setTimeout(() => {
                            copyBtn.textContent = 'Copy';
                            copyBtn.style.background = '';
                        }, 2000);
                    });
                }
            });
        }

        const setBtn = document.getElementById('setGameIdBtn');
        const gameIdInput = document.getElementById('gameIdInput');
        if (setBtn && gameIdInput) {
            setBtn.addEventListener('click', () => {
                const newGameId = gameIdInput.value.trim().replace(/\D/g, ''); // Only digits
                if (newGameId && newGameId.length === 6) {
                    if (confirm('This will connect to a different game. All local data will sync with the new game. Continue?')) {
                        localStorage.setItem('pitchingCounterGameId', newGameId);
                        this.gameId = newGameId;
                        const gameIdDisplay = document.getElementById('gameIdDisplay');
                        if (gameIdDisplay) {
                            gameIdDisplay.value = newGameId;
                        }
                        gameIdInput.value = '';
                        
                        // Load game name from new game
                        if (this.firebaseEnabled) {
                            location.reload();
                        } else {
                            alert('Game ID updated. Refresh the page to connect.');
                        }
                    }
                } else {
                    alert('Please enter a valid 6-digit Game Code');
                }
            });
            
            // Only allow digits
            gameIdInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').substring(0, 6);
            });
            
            gameIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    setBtn.click();
                }
            });
        }
    }
}

// Initialize the app
let app;
document.addEventListener('DOMContentLoaded', () => {
    try {
        app = new BaseballPitchingCounter();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = '<h1>Error Loading App</h1><p>Please refresh the page. If the problem persists, clear your browser cache.</p>';
        }
    }
});

// Suppress harmless browser extension errors in console
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('message channel closed')) {
        event.preventDefault();
        return false;
    }
}, true);
