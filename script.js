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
        this.selectedHitPlacement = null;
        this.selectedHitType = null;
        
        // Practice pitches
        this.practicePitches = this.loadPracticePitches();
        this.pendingPracticeClick = null; // Store click position while modal is open
        
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
                }
            }, 500);
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

        // Tab navigation
        document.getElementById('playersTabBtn').addEventListener('click', () => this.switchTab('players'));
        document.getElementById('statsTabBtn').addEventListener('click', () => this.switchTab('stats'));
        document.getElementById('practiceTabBtn').addEventListener('click', () => this.switchTab('practice'));

        // Add player button
        document.getElementById('addPlayerBtn').addEventListener('click', () => this.addPlayer());
        document.getElementById('playerNumberInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addPlayer();
        });
        
        // Modal close buttons
        document.getElementById('closeModal').addEventListener('click', () => this.closePitchModal());
        document.getElementById('closeStatsModal').addEventListener('click', () => this.closeStatsModal());
        document.getElementById('closePracticeModal').addEventListener('click', () => this.closePracticeModal());

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

        // Hit placement field positions
        document.querySelectorAll('.field-position').forEach(position => {
            position.addEventListener('click', (e) => {
                const positionValue = e.currentTarget.dataset.position;
                this.selectHitPlacement(positionValue);
            });
        });

        // Hit type buttons
        document.querySelectorAll('.hit-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectHitType(e.target.dataset.hitType);
            });
        });

        // Record pitch button
        document.getElementById('recordPitchBtn').addEventListener('click', () => this.recordPitch());

        // Delete player button
        document.getElementById('deletePlayerBtn').addEventListener('click', () => this.deleteCurrentPlayer());

        // Practice diagram click handler
        const practiceDiagram = document.getElementById('pitchersBoxDiagram');
        if (practiceDiagram) {
            practiceDiagram.addEventListener('click', (e) => this.handlePracticeDiagramClick(e));
        }

        // Practice pitch type buttons (in practice modal)
        document.querySelectorAll('#practicePitchModal .pitch-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.recordPracticePitch(e.target.dataset.type);
            });
        });

        // Clear practice button
        document.getElementById('clearPracticeBtn').addEventListener('click', () => this.clearPracticePitches());

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            const pitchModal = document.getElementById('pitchModal');
            const statsModal = document.getElementById('statsModal');
            const practiceModal = document.getElementById('practicePitchModal');
            const gameModal = document.getElementById('gameModal');
            if (e.target === pitchModal) {
                this.closePitchModal();
            }
            if (e.target === statsModal) {
                this.closeStatsModal();
            }
            if (e.target === practiceModal) {
                this.closePracticeModal();
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
        this.selectedHitPlacement = null;
        this.selectedHitType = null;
        
        document.getElementById('modalPlayerNumber').textContent = `Player #${player.number}`;
        document.getElementById('pitchModal').style.display = 'block';
        
        // Reset UI
        document.querySelectorAll('.pitch-type-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.swing-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.result-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.hit-type-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.field-position').forEach(pos => pos.classList.remove('selected'));
        document.getElementById('resultSection').style.display = 'none';
        document.getElementById('hitDetailsSection').style.display = 'none';
        document.getElementById('recordPitchBtn').style.display = 'none';
        const displayEl = document.getElementById('selectedPositionDisplay');
        if (displayEl) displayEl.textContent = '';
        this.updateSummary();
    }

    openStatsModal(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        this.currentPlayerId = playerId;
        document.getElementById('statsModalTitle').textContent = `Player Statistics - Player #${player.number}`;
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
            this.selectedHitPlacement = null;
            this.selectedHitType = null;
            document.querySelectorAll('.result-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('hitDetailsSection').style.display = 'none';
            document.querySelectorAll('.field-position').forEach(pos => pos.classList.remove('selected'));
            document.querySelectorAll('.hit-type-btn').forEach(btn => btn.classList.remove('active'));
            const displayEl = document.getElementById('selectedPositionDisplay');
            if (displayEl) displayEl.textContent = '';
        } else {
            // If swing is "no", auto-record the pitch (if pitch type is already selected)
            document.getElementById('resultSection').style.display = 'none';
            document.getElementById('hitDetailsSection').style.display = 'none';
            this.selectedResult = null;
            this.selectedHitPlacement = null;
            this.selectedHitType = null;
            // Auto-record for no swing
            if (this.selectedPitchType) {
                // Hide record button immediately
                document.getElementById('recordPitchBtn').style.display = 'none';
                setTimeout(() => this.recordPitch(), 100);
            }
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
        
        // Show/hide hit details section
        const hitDetailsSection = document.getElementById('hitDetailsSection');
        if (result === 'hit') {
            if (hitDetailsSection) {
                hitDetailsSection.style.display = 'block';
            }
            // Reset hit details if switching from miss to hit
            this.selectedHitPlacement = null;
            this.selectedHitType = null;
            document.querySelectorAll('.field-position').forEach(pos => pos.classList.remove('selected'));
            document.querySelectorAll('.hit-type-btn').forEach(btn => btn.classList.remove('active'));
            const displayEl = document.getElementById('selectedPositionDisplay');
            if (displayEl) displayEl.textContent = '';
        } else {
            // If result is "miss", auto-record the pitch
            if (hitDetailsSection) {
                hitDetailsSection.style.display = 'none';
            }
            this.selectedHitPlacement = null;
            this.selectedHitType = null;
            // Hide record button immediately
            document.getElementById('recordPitchBtn').style.display = 'none';
            // Auto-record for miss
            setTimeout(() => this.recordPitch(), 100);
        }
        
        this.updateSummary();
    }

    selectHitPlacement(position) {
        this.selectedHitPlacement = position;
        
        // Update visual selection
        document.querySelectorAll('.field-position').forEach(pos => {
            pos.classList.remove('selected');
            if (pos.dataset.position === position) {
                pos.classList.add('selected');
            }
        });
        
        // Update display text
        const positionNames = {
            'P': 'Pitcher',
            'C': 'Catcher',
            '1B': 'First Base',
            '2B': 'Second Base',
            '3B': 'Third Base',
            'SS': 'Shortstop',
            'LF': 'Left Field',
            'CF': 'Center Field',
            'RF': 'Right Field'
        };
        
        const displayEl = document.getElementById('selectedPositionDisplay');
        if (displayEl) {
            displayEl.textContent = `Selected: ${position} (${positionNames[position]})`;
        }
        
        // If hit type is already selected, auto-record
        if (this.selectedHitType) {
            // Hide record button immediately
            document.getElementById('recordPitchBtn').style.display = 'none';
            setTimeout(() => this.recordPitch(), 100);
        }
        
        this.updateSummary();
    }

    selectHitType(hitType) {
        this.selectedHitType = hitType;
        document.querySelectorAll('.hit-type-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.hitType === hitType) {
                btn.classList.add('active');
            }
        });
        
        // If hit placement is already selected, auto-record
        if (this.selectedHitPlacement) {
            // Hide record button immediately
            document.getElementById('recordPitchBtn').style.display = 'none';
            setTimeout(() => this.recordPitch(), 100);
        }
        
        this.updateSummary();
    }

    updateSummary() {
        // For hits, require hit placement and hit type
        const hitDetailsComplete = this.selectedResult !== 'hit' || 
                                   (this.selectedHitPlacement && this.selectedHitType);
        
        const canRecord = this.selectedPitchType && this.selectedSwing && 
                         (this.selectedSwing === 'no' || (this.selectedResult && hitDetailsComplete));
        
        // Check if we're about to auto-record (all required fields are complete)
        const willAutoRecord = canRecord && (
            (this.selectedSwing === 'no') ||
            (this.selectedResult === 'miss') ||
            (this.selectedResult === 'hit' && this.selectedHitPlacement && this.selectedHitType)
        );
        
        // Only show button if we can record but won't auto-record
        if (canRecord && !willAutoRecord) {
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
        // For hits, require hit placement and hit type
        if (this.selectedResult === 'hit' && (!this.selectedHitPlacement || !this.selectedHitType)) return;

        const player = this.players.find(p => p.id === this.currentPlayerId);
        if (!player) return;

        const pitch = {
            id: Date.now().toString(),
            type: this.selectedPitchType,
            swing: this.selectedSwing,
            result: this.selectedSwing === 'yes' ? this.selectedResult : null,
            hitPlacement: this.selectedResult === 'hit' ? this.selectedHitPlacement : null,
            hitType: this.selectedResult === 'hit' ? this.selectedHitType : null,
            timestamp: new Date().toISOString()
        };

        player.pitches.push(pitch);
        this.savePlayers();
        this.renderPlayers();
        
        // Show confirmation message
        this.showPitchConfirmation();
        
        // Reset and keep modal open for quick entry
        this.selectedPitchType = null;
        this.selectedSwing = null;
        this.selectedResult = null;
        this.selectedHitPlacement = null;
        this.selectedHitType = null;
        
        document.querySelectorAll('.pitch-type-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.swing-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.result-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.hit-type-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.field-position').forEach(pos => pos.classList.remove('selected'));
        document.getElementById('resultSection').style.display = 'none';
        document.getElementById('hitDetailsSection').style.display = 'none';
        document.getElementById('recordPitchBtn').style.display = 'none';
        const displayEl = document.getElementById('selectedPositionDisplay');
        if (displayEl) displayEl.textContent = '';
        this.updateSummary();
    }

    showPitchConfirmation() {
        const confirmation = document.getElementById('pitchConfirmation');
        if (!confirmation) return;
        
        // Show the message
        confirmation.style.opacity = '1';
        confirmation.style.pointerEvents = 'auto';
        
        // Hide after 2 seconds with fade out
        setTimeout(() => {
            confirmation.style.opacity = '0';
            setTimeout(() => {
                confirmation.style.pointerEvents = 'none';
            }, 300); // Wait for fade transition to complete
        }, 2000);
    }

    switchTab(tab) {
        const playersTab = document.getElementById('playersTab');
        const statsTab = document.getElementById('statsTab');
        const practiceTab = document.getElementById('practiceTab');
        const playersBtn = document.getElementById('playersTabBtn');
        const statsBtn = document.getElementById('statsTabBtn');
        const practiceBtn = document.getElementById('practiceTabBtn');

        // Hide all tabs
        playersTab.style.display = 'none';
        statsTab.style.display = 'none';
        practiceTab.style.display = 'none';

        // Reset button classes
        playersBtn.className = 'btn btn-secondary tab-btn';
        statsBtn.className = 'btn btn-secondary tab-btn';
        practiceBtn.className = 'btn btn-secondary tab-btn';

        if (tab === 'players') {
            playersTab.style.display = 'block';
            playersBtn.className = 'btn btn-primary tab-btn active';
        } else if (tab === 'stats') {
            statsTab.style.display = 'block';
            statsBtn.className = 'btn btn-primary tab-btn active';
            this.renderStats();
        } else if (tab === 'practice') {
            practiceTab.style.display = 'block';
            practiceBtn.className = 'btn btn-primary tab-btn active';
            this.renderPracticeDiagram();
        }
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

    calculateGameStats() {
        let totalPitches = 0;
        let totalSwings = 0;
        let totalHits = 0;
        let totalMisses = 0;
        const pitchTypeStats = {};
        const hitPlacementStats = {};
        const hitTypeStats = {};

        this.players.forEach(player => {
            const pitches = player.pitches || [];
            totalPitches += pitches.length;
            
            pitches.forEach(pitch => {
                if (pitch.swing === 'yes') {
                    totalSwings++;
                    if (pitch.result === 'hit') {
                        totalHits++;
                        // Count hit placements
                        if (pitch.hitPlacement) {
                            hitPlacementStats[pitch.hitPlacement] = (hitPlacementStats[pitch.hitPlacement] || 0) + 1;
                        }
                        // Count hit types
                        if (pitch.hitType) {
                            hitTypeStats[pitch.hitType] = (hitTypeStats[pitch.hitType] || 0) + 1;
                        }
                    } else if (pitch.result === 'miss') {
                        totalMisses++;
                    }
                }

                // Count by pitch type
                if (pitch.type) {
                    if (!pitchTypeStats[pitch.type]) {
                        pitchTypeStats[pitch.type] = { total: 0, swings: 0, hits: 0, misses: 0 };
                    }
                    pitchTypeStats[pitch.type].total++;
                    if (pitch.swing === 'yes') {
                        pitchTypeStats[pitch.type].swings++;
                        if (pitch.result === 'hit') {
                            pitchTypeStats[pitch.type].hits++;
                        } else if (pitch.result === 'miss') {
                            pitchTypeStats[pitch.type].misses++;
                        }
                    }
                }
            });
        });

        return {
            totalPitches,
            totalSwings,
            totalHits,
            totalMisses,
            pitchTypeStats,
            hitPlacementStats,
            hitTypeStats,
            hitRate: totalSwings > 0 ? ((totalHits / totalSwings) * 100).toFixed(1) : '0'
        };
    }

    renderStats() {
        const container = document.getElementById('statsContainer');
        const gameStats = this.calculateGameStats();

        if (this.players.length === 0 || gameStats.totalPitches === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No pitches recorded yet. Add players and record pitches to see statistics.</p>';
            return;
        }

        let html = `
            <h2 style="font-size: 22px; margin-bottom: 8px; color: var(--text-primary);">Game Statistics</h2>
            
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-bottom: 12px;">
                <div style="padding: 6px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 9px; color: var(--text-secondary); margin-bottom: 2px;">Total</div>
                    <div style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${gameStats.totalPitches}</div>
                </div>
                <div style="padding: 6px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 9px; color: var(--text-secondary); margin-bottom: 2px;">Swings</div>
                    <div style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${gameStats.totalSwings}</div>
                </div>
                <div style="padding: 6px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 9px; color: var(--text-secondary); margin-bottom: 2px;">Hits</div>
                    <div style="font-size: 16px; font-weight: 700; color: var(--success-color);">${gameStats.totalHits}</div>
                </div>
                <div style="padding: 6px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 9px; color: var(--text-secondary); margin-bottom: 2px;">Misses</div>
                    <div style="font-size: 16px; font-weight: 700; color: var(--danger-color);">${gameStats.totalMisses}</div>
                </div>
                <div style="padding: 6px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 9px; color: var(--text-secondary); margin-bottom: 2px;">Hit Rate</div>
                    <div style="font-size: 16px; font-weight: 700; color: var(--success-color);">${gameStats.hitRate}%</div>
                </div>
            </div>
        `;

        // Stats by Pitch Type
        const pitchTypes = Object.keys(gameStats.pitchTypeStats).sort();
        if (pitchTypes.length > 0) {
            html += '<h3 style="margin-top: 16px; margin-bottom: 8px; font-size: 16px; color: var(--text-primary);">By Pitch Type</h3>';
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 16px;">';
            pitchTypes.forEach(type => {
                const stats = gameStats.pitchTypeStats[type];
                const hitRate = stats.swings > 0 ? ((stats.hits / stats.swings) * 100).toFixed(1) : '0';
                html += `
                    <div style="padding: 10px; background: var(--bg-color); border-radius: 6px;">
                        <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px;">${this.formatPitchType(type)}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 4px;">
                                <div>Total: ${stats.total}</div>
                                <div>Swings: ${stats.swings}</div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 4px;">
                                <div style="color: var(--success-color);">Hits: ${stats.hits}</div>
                                <div style="color: var(--danger-color);">Misses: ${stats.misses}</div>
                            </div>
                            <div style="margin-top: 4px; font-weight: 600; color: var(--success-color);">${hitRate}%</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Baseball Field Diagram Section
        const hitPlacements = gameStats.hitPlacementStats;
        const totalHits = gameStats.totalHits;
        
        html += '<h3 style="margin-top: 16px; margin-bottom: 8px; font-size: 16px; color: var(--text-primary);">Hit Placement Diagram</h3>';
        html += '<div style="display: flex; justify-content: center; margin-bottom: 16px;">';
        html += '<div class="baseball-field-diagram" style="position: relative; width: 450px; height: 450px; margin: 0 auto;">';
        
        // SVG background (scaled up)
        html += `
            <svg viewBox="0 0 300 300" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;">
                <path d="M 150 280 Q 150 50, 150 20 Q 50 20, 20 80 Q 20 150, 80 200 Q 150 250, 220 200 Q 280 150, 280 80 Q 280 20, 150 20 Q 150 50, 150 280 Z" fill="#90EE90" opacity="0.4"/>
                <path d="M 150 280 L 240 150 L 150 20 L 60 150 Z" fill="#D2B48C" opacity="0.6"/>
                <line x1="150" y1="280" x2="240" y2="150" stroke="#8B4513" stroke-width="3" opacity="0.7"/>
                <line x1="150" y1="280" x2="60" y2="150" stroke="#8B4513" stroke-width="3" opacity="0.7"/>
                <line x1="240" y1="150" x2="150" y2="20" stroke="#8B4513" stroke-width="3" opacity="0.7"/>
                <line x1="60" y1="150" x2="150" y2="20" stroke="#8B4513" stroke-width="3" opacity="0.7"/>
                <circle cx="150" cy="150" r="8" fill="#8B4513" opacity="0.8"/>
                <circle cx="150" cy="150" r="6" fill="#D2B48C" opacity="0.9"/>
                <rect x="235" y="145" width="12" height="12" fill="white" stroke="#333" stroke-width="2" rx="2"/>
                <rect x="144" y="14" width="12" height="12" fill="white" stroke="#333" stroke-width="2" rx="2" transform="rotate(45 150 20)"/>
                <rect x="53" y="145" width="12" height="12" fill="white" stroke="#333" stroke-width="2" rx="2"/>
                <path d="M 150 280 L 145 275 L 140 275 L 140 285 L 160 285 L 160 275 L 155 275 Z" fill="white" stroke="#333" stroke-width="2"/>
            </svg>
        `;
        
        // Position circles with percentages
        const positions = [
            { pos: 'P', top: '48%', left: '48%', transform: 'translate(-50%, -50%)', title: 'Pitcher' },
            { pos: 'C', bottom: '8%', left: '50%', transform: 'translateX(-50%)', title: 'Catcher' },
            { pos: '1B', top: '48%', right: '18%', transform: 'translateY(-50%)', title: 'First Base' },
            { pos: '2B', top: '11%', left: '50%', transform: 'translateX(-50%)', title: 'Second Base' },
            { pos: '3B', top: '48%', left: '18%', transform: 'translateY(-50%)', title: 'Third Base' },
            { pos: 'SS', top: '25%', left: '32%', transform: '', title: 'Shortstop' },
            { pos: 'LF', top: '14%', left: '8%', transform: '', title: 'Left Field' },
            { pos: 'CF', top: '0%', left: '50%', transform: 'translateX(-50%)', title: 'Center Field' },
            { pos: 'RF', top: '14%', right: '8%', transform: '', title: 'Right Field' }
        ];
        
        positions.forEach(({ pos, top, bottom, left, right, transform, title }) => {
            const count = hitPlacements[pos] || 0;
            const percentage = totalHits > 0 ? ((count / totalHits) * 100).toFixed(1) : '0.0';
            const style = `position: absolute; ${top ? `top: ${top};` : ''} ${bottom ? `bottom: ${bottom};` : ''} ${left ? `left: ${left};` : ''} ${right ? `right: ${right};` : ''} ${transform ? `transform: ${transform};` : ''} width: 60px; height: 60px; border-radius: 50%; background: rgba(255, 255, 255, 0.9); border: 2px solid #333; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; z-index: 10; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);`;
            html += `<div style="${style}" title="${title}: ${count} hits (${percentage}%)">${percentage}%</div>`;
        });
        
        html += '</div></div>';

        // Hit Placement Stats
        const placements = Object.entries(gameStats.hitPlacementStats).sort((a, b) => b[1] - a[1]);
        if (placements.length > 0) {
            html += '<h3 style="margin-top: 16px; margin-bottom: 8px; font-size: 16px; color: var(--text-primary);">Hit Placements</h3>';
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 6px; margin-bottom: 16px;">';
            placements.forEach(([placement, count]) => {
                html += `
                    <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-color); border-radius: 6px; font-size: 12px;">
                        <span>${placement}</span>
                        <span style="font-weight: 600; color: var(--success-color);">${count}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Hit Type Stats
        const hitTypes = Object.entries(gameStats.hitTypeStats).sort((a, b) => b[1] - a[1]);
        if (hitTypes.length > 0) {
            html += '<h3 style="margin-top: 16px; margin-bottom: 8px; font-size: 16px; color: var(--text-primary);">Hit Types</h3>';
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 6px;">';
            hitTypes.forEach(([hitType, count]) => {
                html += `
                    <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-color); border-radius: 6px; font-size: 12px;">
                        <span>${this.formatHitType(hitType)}</span>
                        <span style="font-weight: 600; color: var(--success-color);">${count}</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        container.innerHTML = html;
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

        // Sort players by last pitch time (most recent at top)
        // When a player receives a pitch, they go to top, previous top goes to very bottom
        // Players with no pitches maintain their input order (first added at top)
        const playersWithPitches = this.players.filter(p => (p.pitches || []).length > 0);
        const playersWithoutPitches = this.players.filter(p => (p.pitches || []).length === 0);
        
        // Sort players with pitches by timestamp (newest first)
        const sortedWithPitches = [...playersWithPitches].sort((a, b) => {
            const aPitches = a.pitches || [];
            const bPitches = b.pitches || [];
            const aLastPitch = aPitches[aPitches.length - 1].timestamp;
            const bLastPitch = bPitches[bPitches.length - 1].timestamp;
            const aTime = new Date(aLastPitch).getTime();
            const bTime = new Date(bLastPitch).getTime();
            return bTime - aTime; // Newest first
        });
        
        // Sort players without pitches by creation time (oldest first, so first added is at top)
        const sortedWithoutPitches = [...playersWithoutPitches].sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return aTime - bTime; // Oldest first (first added at top)
        });
        
        // Reorganize: most recent at top, middle players at end of middle section, second most recent at very bottom
        let sortedPlayers = [];
        if (sortedWithPitches.length > 0) {
            // Most recent player goes to top
            sortedPlayers.push(sortedWithPitches[0]);
            
            // If there are 2+ players with pitches
            if (sortedWithPitches.length > 1) {
                // Players without pitches go first in the middle section
                sortedPlayers.push(...sortedWithoutPitches);
                
                // All players except the newest and second newest go after players without pitches
                // Sort them oldest first so they're at the end of middle section (right before bottom player)
                const middlePlayers = sortedWithPitches.slice(2).sort((a, b) => {
                    const aPitches = a.pitches || [];
                    const bPitches = b.pitches || [];
                    const aLastPitch = aPitches[aPitches.length - 1].timestamp;
                    const bLastPitch = bPitches[bPitches.length - 1].timestamp;
                    const aTime = new Date(aLastPitch).getTime();
                    const bTime = new Date(bLastPitch).getTime();
                    return aTime - bTime; // Oldest first (at end of middle section)
                });
                sortedPlayers.push(...middlePlayers);
                
                // Second most recent goes to very bottom (below everything)
                sortedPlayers.push(sortedWithPitches[1]);
            } else {
                // Only one player with pitches - players without pitches go after them
                sortedPlayers.push(...sortedWithoutPitches);
            }
        } else {
            // No players with pitches - just show players without pitches in order
            sortedPlayers.push(...sortedWithoutPitches);
        }

        sortedPlayers.forEach(player => {
            const card = document.createElement('div');
            card.className = 'player-card';
            
            // Get last three pitches
            const pitches = player.pitches || [];
            const lastThreePitches = pitches.slice(-3).reverse(); // Get last 3, most recent first
            
            let pitchesInfo = '';
            if (lastThreePitches.length > 0) {
                const pitchItems = lastThreePitches.map((pitch, index) => {
                    const pitchType = this.formatPitchType(pitch.type);
                    const swingText = pitch.swing === 'yes' ? 'Swung' : "Didn't Swing";
                    
                    let pitchContent = '';
                    if (pitch.swing === 'no') {
                        pitchContent = `${pitchType} - ${swingText}`;
                    } else {
                        const resultText = pitch.result === 'hit' ? 'Hit' : 'Miss';
                        const resultColor = pitch.result === 'hit' ? 'var(--success-color)' : 'var(--danger-color)';
                        
                        let hitDetails = '';
                        if (pitch.result === 'hit' && pitch.hitPlacement && pitch.hitType) {
                            hitDetails = ` - ${pitch.hitPlacement} (${this.formatHitType(pitch.hitType)})`;
                        }
                        
                        pitchContent = `${pitchType} - ${swingText} - <span style="color: ${resultColor}; font-weight: 600; white-space: nowrap; display: inline;">${resultText}</span>${hitDetails}`;
                    }
                    
                    return `<div style="grid-column: ${index + 1}; padding: 4px 2px; text-align: center; font-size: 10px; line-height: 1.3; min-height: 45px; display: flex; align-items: center; justify-content: center; word-wrap: break-word; overflow-wrap: break-word; border-right: ${index < 2 ? '1px solid var(--border-color)' : 'none'}; white-space: normal;">${pitchContent}</div>`;
                });
                
                // Fill empty slots if less than 3 pitches
                while (pitchItems.length < 3) {
                    const index = pitchItems.length;
                    pitchItems.push(`<div style="grid-column: ${index + 1}; padding: 4px 2px; text-align: center; font-size: 10px; color: var(--text-secondary); min-height: 45px; display: flex; align-items: center; justify-content: center; border-right: ${index < 2 ? '1px solid var(--border-color)' : 'none'}; white-space: normal;">—</div>`);
                }
                
                pitchesInfo = pitchItems.join('');
            } else {
                // Show 3 empty slots if no pitches
                pitchesInfo = `<div style="grid-column: 1; padding: 4px 2px; text-align: center; font-size: 10px; color: var(--text-secondary); min-height: 45px; display: flex; align-items: center; justify-content: center; border-right: 1px solid var(--border-color);">—</div><div style="grid-column: 2; padding: 4px 2px; text-align: center; font-size: 10px; color: var(--text-secondary); min-height: 45px; display: flex; align-items: center; justify-content: center; border-right: 1px solid var(--border-color);">—</div><div style="grid-column: 3; padding: 4px 2px; text-align: center; font-size: 10px; color: var(--text-secondary); min-height: 45px; display: flex; align-items: center; justify-content: center;">—</div>`;
            }
            
            card.innerHTML = `
                <div class="player-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <h3 style="margin: 0; font-size: 16px;">Player #${player.number}</h3>
                        <button class="btn btn-secondary" onclick="event.stopPropagation(); app.openStatsModal('${player.id}')" style="padding: 6px 12px; font-size: 13px;">Stats</button>
                    </div>
                    <button class="delete-btn" onclick="event.stopPropagation(); app.deletePlayer('${player.id}')" aria-label="Delete player" style="width: 24px; height: 24px; font-size: 18px;">×</button>
                </div>
                <div style="padding: 0;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600;">Last 3 Pitches:</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; width: 100%; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; box-sizing: border-box;">${pitchesInfo}</div>
                </div>
            `;

            // Make entire card clickable to open pitch modal
            card.addEventListener('click', () => {
                this.openPitchModal(player.id);
            });
            card.style.cursor = 'pointer';

            container.appendChild(card);
        });
    }

    renderDetailedStats(player) {
        const stats = this.calculateStats(player);
        const statsDisplay = document.getElementById('statsDisplay');
        
        if (stats.totalPitches === 0) {
            statsDisplay.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 12px; font-size: 13px;">No pitches recorded yet.</p>';
            return;
        }

        const hitRate = stats.swings > 0 ? ((stats.hits / stats.swings) * 100).toFixed(1) : '0';

        let html = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px;">
                <div style="padding: 8px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Total</div>
                    <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${stats.totalPitches}</div>
                </div>
                <div style="padding: 8px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Swings</div>
                    <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${stats.swings}</div>
                </div>
                <div style="padding: 8px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Hit Rate</div>
                    <div style="font-size: 18px; font-weight: 700; color: var(--success-color);">${hitRate}%</div>
                </div>
                <div style="padding: 8px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Hits</div>
                    <div style="font-size: 18px; font-weight: 700; color: var(--success-color);">${stats.hits}</div>
                </div>
                <div style="padding: 8px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">Misses</div>
                    <div style="font-size: 18px; font-weight: 700; color: var(--danger-color);">${stats.misses}</div>
                </div>
                <div style="padding: 8px; background: var(--bg-color); border-radius: 6px; text-align: center;">
                    <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">No Swing</div>
                    <div style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${stats.totalPitches - stats.swings}</div>
                </div>
            </div>
        `;

        // Stats by Pitch Type
        const pitchTypesWithData = this.pitchTypes.filter(type => (stats.pitchTypeCounts[type] || 0) > 0);
        if (pitchTypesWithData.length > 0) {
            html += '<h3 style="margin-top: 12px; margin-bottom: 6px; font-size: 14px; color: var(--text-primary);">By Pitch Type</h3>';
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 6px; margin-bottom: 12px;">';
            
            pitchTypesWithData.forEach(type => {
                const count = stats.pitchTypeCounts[type] || 0;
                const swings = player.pitches.filter(p => p.type === type && p.swing === 'yes').length;
                const hits = player.pitches.filter(p => p.type === type && p.result === 'hit').length;
                const misses = player.pitches.filter(p => p.type === type && p.result === 'miss').length;
                const typeHitRate = swings > 0 ? ((hits / swings) * 100).toFixed(1) : '0';
                
                html += `
                    <div style="padding: 6px; background: var(--bg-color); border-radius: 4px;">
                        <div style="font-weight: 600; font-size: 12px; margin-bottom: 2px;">${this.formatPitchType(type)}</div>
                        <div style="font-size: 10px; color: var(--text-secondary); line-height: 1.3;">Total: ${count} Swings: ${swings} Hits: ${hits}<br>Misses: ${misses}</div>
                        <div style="font-size: 11px; color: var(--success-color); font-weight: 600;">${typeHitRate}%</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Player Hit Placement Diagram
        const playerHits = player.pitches.filter(p => p.result === 'hit' && p.hitPlacement);
        const playerHitPlacements = {};
        playerHits.forEach(pitch => {
            playerHitPlacements[pitch.hitPlacement] = (playerHitPlacements[pitch.hitPlacement] || 0) + 1;
        });
        const playerTotalHits = playerHits.length;
        
        if (playerTotalHits > 0) {
            html += '<h3 style="margin-top: 12px; margin-bottom: 6px; font-size: 14px; color: var(--text-primary);">Hit Placement Diagram</h3>';
            html += '<div style="display: flex; justify-content: center; margin-bottom: 12px;">';
            html += '<div class="baseball-field-diagram" style="position: relative; width: 450px; height: 450px; margin: 0 auto;">';
            
            // SVG background (scaled up)
            html += `
                <svg viewBox="0 0 300 300" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;">
                    <path d="M 150 280 Q 150 50, 150 20 Q 50 20, 20 80 Q 20 150, 80 200 Q 150 250, 220 200 Q 280 150, 280 80 Q 280 20, 150 20 Q 150 50, 150 280 Z" fill="#90EE90" opacity="0.4"/>
                    <path d="M 150 280 L 240 150 L 150 20 L 60 150 Z" fill="#D2B48C" opacity="0.6"/>
                    <line x1="150" y1="280" x2="240" y2="150" stroke="#8B4513" stroke-width="3" opacity="0.7"/>
                    <line x1="150" y1="280" x2="60" y2="150" stroke="#8B4513" stroke-width="3" opacity="0.7"/>
                    <line x1="240" y1="150" x2="150" y2="20" stroke="#8B4513" stroke-width="3" opacity="0.7"/>
                    <line x1="60" y1="150" x2="150" y2="20" stroke="#8B4513" stroke-width="3" opacity="0.7"/>
                    <circle cx="150" cy="150" r="8" fill="#8B4513" opacity="0.8"/>
                    <circle cx="150" cy="150" r="6" fill="#D2B48C" opacity="0.9"/>
                    <rect x="235" y="145" width="12" height="12" fill="white" stroke="#333" stroke-width="2" rx="2"/>
                    <rect x="144" y="14" width="12" height="12" fill="white" stroke="#333" stroke-width="2" rx="2" transform="rotate(45 150 20)"/>
                    <rect x="53" y="145" width="12" height="12" fill="white" stroke="#333" stroke-width="2" rx="2"/>
                    <path d="M 150 280 L 145 275 L 140 275 L 140 285 L 160 285 L 160 275 L 155 275 Z" fill="white" stroke="#333" stroke-width="2"/>
                </svg>
            `;
            
            // Position circles with percentages
            const positions = [
                { pos: 'P', top: '48%', left: '48%', transform: 'translate(-50%, -50%)', title: 'Pitcher' },
                { pos: 'C', bottom: '8%', left: '50%', transform: 'translateX(-50%)', title: 'Catcher' },
                { pos: '1B', top: '48%', right: '18%', transform: 'translateY(-50%)', title: 'First Base' },
                { pos: '2B', top: '11%', left: '50%', transform: 'translateX(-50%)', title: 'Second Base' },
                { pos: '3B', top: '48%', left: '18%', transform: 'translateY(-50%)', title: 'Third Base' },
                { pos: 'SS', top: '25%', left: '32%', transform: '', title: 'Shortstop' },
                { pos: 'LF', top: '14%', left: '8%', transform: '', title: 'Left Field' },
                { pos: 'CF', top: '0%', left: '50%', transform: 'translateX(-50%)', title: 'Center Field' },
                { pos: 'RF', top: '14%', right: '8%', transform: '', title: 'Right Field' }
            ];
            
            positions.forEach(({ pos, top, bottom, left, right, transform, title }) => {
                const count = playerHitPlacements[pos] || 0;
                const percentage = playerTotalHits > 0 ? ((count / playerTotalHits) * 100).toFixed(1) : '0.0';
                const style = `position: absolute; ${top ? `top: ${top};` : ''} ${bottom ? `bottom: ${bottom};` : ''} ${left ? `left: ${left};` : ''} ${right ? `right: ${right};` : ''} ${transform ? `transform: ${transform};` : ''} width: 60px; height: 60px; border-radius: 50%; background: rgba(255, 255, 255, 0.9); border: 2px solid #333; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; z-index: 10; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);`;
                html += `<div style="${style}" title="${title}: ${count} hits (${percentage}%)">${percentage}%</div>`;
            });
            
            html += '</div></div>';
        }

        statsDisplay.innerHTML = html;
    }

    formatPitchType(type) {
        const types = {
            fastball: 'Fastball',
            curveball: 'Curveball',
            slider: 'Slider',
            changeup: 'Changeup',
            cutter: 'Cutter',
            splitter: 'Splitter'
        };
        return types[type] || type;
    }

    formatHitType(type) {
        const types = {
            'line-drive': 'Line Drive',
            'ground-ball': 'Ground Ball',
            'fly-ball': 'Fly Ball',
            'foul': 'Foul'
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

    // Practice pitch methods
    loadPracticePitches() {
        const saved = localStorage.getItem('practicePitches');
        return saved ? JSON.parse(saved) : [];
    }

    savePracticePitches() {
        localStorage.setItem('practicePitches', JSON.stringify(this.practicePitches));
    }

    handlePracticeDiagramClick(e) {
        const diagram = document.getElementById('pitchersBoxDiagram');
        const rect = diagram.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Store click position relative to diagram
        this.pendingPracticeClick = {
            x: x,
            y: y,
            percentX: (x / rect.width) * 100,
            percentY: (y / rect.height) * 100
        };
        
        this.openPracticeModal();
    }

    openPracticeModal() {
        document.getElementById('practicePitchModal').style.display = 'block';
    }

    closePracticeModal() {
        document.getElementById('practicePitchModal').style.display = 'none';
        this.pendingPracticeClick = null;
    }

    recordPracticePitch(pitchType) {
        if (!this.pendingPracticeClick) return;
        
        const practicePitch = {
            id: Date.now(),
            pitchType: pitchType,
            x: this.pendingPracticeClick.x,
            y: this.pendingPracticeClick.y,
            percentX: this.pendingPracticeClick.percentX,
            percentY: this.pendingPracticeClick.percentY,
            timestamp: new Date().toISOString()
        };
        
        this.practicePitches.push(practicePitch);
        this.savePracticePitches();
        this.closePracticeModal();
        this.renderPracticeDiagram();
    }

    renderPracticeDiagram() {
        const diagram = document.getElementById('pitchersBoxDiagram');
        if (!diagram) return;
        
        // Clear existing markers
        diagram.innerHTML = '';
        
        // Draw strike zone outline (rectangular strike zone)
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('style', 'position: absolute; top: 0; left: 0; pointer-events: none;');
        
        // Draw strike zone rectangle
        const strikeZone = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const width = 300;
        const height = 400;
        const zoneWidth = width * 0.5;
        const zoneHeight = height * 0.4;
        const zoneX = (width - zoneWidth) / 2;
        const zoneY = height * 0.3;
        
        strikeZone.setAttribute('x', zoneX);
        strikeZone.setAttribute('y', zoneY);
        strikeZone.setAttribute('width', zoneWidth);
        strikeZone.setAttribute('height', zoneHeight);
        strikeZone.setAttribute('fill', 'none');
        strikeZone.setAttribute('stroke', '#000');
        strikeZone.setAttribute('stroke-width', '3');
        svg.appendChild(strikeZone);
        
        // Draw home plate at bottom
        const platePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const plateWidth = zoneWidth * 0.8;
        const plateHeight = height * 0.08;
        const plateX = (width - plateWidth) / 2;
        const plateY = height * 0.75;
        
        // Home plate shape: pentagon
        const platePoints = `
            M ${plateX} ${plateY}
            L ${plateX + plateWidth * 0.5} ${plateY + plateHeight * 0.3}
            L ${plateX + plateWidth} ${plateY}
            L ${plateX + plateWidth * 0.75} ${plateY + plateHeight}
            L ${plateX + plateWidth * 0.25} ${plateY + plateHeight}
            Z
        `;
        platePath.setAttribute('d', platePoints);
        platePath.setAttribute('fill', 'none');
        platePath.setAttribute('stroke', '#000');
        platePath.setAttribute('stroke-width', '2');
        svg.appendChild(platePath);
        
        diagram.appendChild(svg);
        
        // Render practice pitch markers
        this.practicePitches.forEach(pitch => {
            const marker = document.createElement('div');
            marker.style.position = 'absolute';
            marker.style.left = `${pitch.percentX}%`;
            marker.style.top = `${pitch.percentY}%`;
            marker.style.transform = 'translate(-50%, -50%)';
            marker.style.width = '27px';
            marker.style.height = '27px';
            marker.style.borderRadius = '50%';
            marker.style.backgroundColor = this.getPitchTypeColor(pitch.pitchType);
            marker.style.border = '2px solid #000';
            marker.style.cursor = 'pointer';
            marker.style.zIndex = '10';
            marker.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            marker.title = this.formatPitchType(pitch.pitchType);
            
            diagram.appendChild(marker);
        });
    }

    getPitchTypeColor(pitchType) {
        const colors = {
            fastball: '#FF4444',
            curveball: '#4444FF',
            slider: '#44FF44',
            changeup: '#FF8844',
            cutter: '#8844FF',
            splitter: '#FF44FF'
        };
        return colors[pitchType] || '#888888';
    }

    clearPracticePitches() {
        if (confirm('Are you sure you want to clear all practice pitches?')) {
            this.practicePitches = [];
            this.savePracticePitches();
            this.renderPracticeDiagram();
        }
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
