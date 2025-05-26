document.addEventListener('DOMContentLoaded', () => {
    const playerListElement = document.getElementById('player-list');
    const audioPlayer = document.getElementById('audio-player');
    const resetTimesBattedButton = document.getElementById('resetTimesBatted');

    // Initialize Reset button icon if not already in HTML
    if (resetTimesBattedButton && !resetTimesBattedButton.innerHTML.includes('fas')) {
        resetTimesBattedButton.innerHTML = `<i class="fas fa-undo"></i> Reset At-Bats`;
    }

    let players = []; // This will hold the current state of players, including their order
    let isAudioContextUnlocked = false;
    let currentlyPlayingPlayerId = null;

    if (audioPlayer) {
        audioPlayer.muted = false;
        audioPlayer.onended = () => {
            console.log("Audio playback ended naturally.");
            if (currentlyPlayingPlayerId !== null) {
                updatePlayButtonIcon(currentlyPlayingPlayerId, false);
                currentlyPlayingPlayerId = null;
            }
        };
    }

    // --- LOAD PLAYER DATA FROM JSON ---
    async function loadPlayers() {
        try {
            const response = await fetch('data/players.json');
            console.log('Fetch response status:', response.status);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}.`);
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const responseText = await response.text();
                console.error("Response was not JSON. CT:", contentType, "Text:", responseText);
                throw new TypeError("Oops, not JSON! Check players.json (no comments).");
            }
            let fetchedPlayers = await response.json(); // Store fetched players temporarily
            console.log('Players fetched from JSON:', fetchedPlayers);
            if (!Array.isArray(fetchedPlayers)) throw new Error("Data from players.json is not an array.");

            // --- LOAD AND APPLY SAVED ORDER FROM LOCALSTORAGE ---
            try {
                const savedOrderJson = localStorage.getItem('walkUpPlayerOrder');
                if (savedOrderJson) {
                    const savedOrderIds = JSON.parse(savedOrderJson);
                    if (Array.isArray(savedOrderIds) && savedOrderIds.length > 0) {
                        const orderedPlayers = [];
                        // Add players in the saved order
                        savedOrderIds.forEach(id => {
                            const player = fetchedPlayers.find(p => p.id === id);
                            if (player) {
                                orderedPlayers.push(player);
                            }
                        });
                        // Add any new players from fetchedPlayers that weren't in savedOrder
                        // (e.g., if players.json was updated)
                        fetchedPlayers.forEach(player => {
                            if (!orderedPlayers.some(op => op.id === player.id)) {
                                orderedPlayers.push(player);
                            }
                        });
                        players = orderedPlayers;
                        console.log('Player order loaded and applied from localStorage.');
                    } else {
                        console.warn("Saved player order in localStorage was invalid or empty. Using default order.");
                        players = fetchedPlayers;
                    }
                } else {
                    console.log('No saved player order found. Using default order from players.json.');
                    players = fetchedPlayers;
                }
            } catch (e) {
                console.error("Error loading/parsing player order from localStorage:", e);
                players = fetchedPlayers; // Fallback to default order
            }
            // --- END LOAD AND APPLY SAVED ORDER ---

            renderPlayerList();
            initializeSortable();
        } catch (error) {
            console.error("Could not load player data:", error.name, error.message);
            playerListElement.innerHTML = `<li style="color:red;padding:10px;background:#ffebee;"><strong>Error:</strong> ${error.message}</li>`;
            players = []; // Ensure players is empty on critical load error
        }
    }

    // --- RENDER PLAYER LIST ---
    function renderPlayerList() {
        playerListElement.innerHTML = '';
        if (players.length === 0 && !playerListElement.innerHTML.includes('Error:')) {
            playerListElement.innerHTML = '<li>No players loaded.</li>'; return;
        }
        if (players.length === 0 && playerListElement.innerHTML.includes('Error:')) return;

        players.forEach(player => {
            const listItem = document.createElement('li');
            listItem.classList.add('player-item');
            listItem.dataset.playerId = player.id;

            let timesBattedRowHTML = '';
            if (player.timesBatted > 0) {
                let timesBattedValueHTML = '';
                for (let i = 0; i < player.timesBatted; i++) {
                    timesBattedValueHTML += '<i class="fas fa-baseball-ball batted-marker"></i>';
                }
                timesBattedRowHTML = `
                    <div class="times-batted-tracker" data-player-id="${player.id}">
                        <span class="times-batted-label">At-bats:</span>
                        <span class="times-batted-value-container">${timesBattedValueHTML}</span>
                        <div class="manual-adjust-controls">
                            <button class="adjust-btn decrease-bats" title="Decrease At-Bats" data-player-id="${player.id}" data-action="decrease">
                                <i class="fas fa-minus"></i>
                            </button>
                            <button class="adjust-btn increase-bats" title="Increase At-Bats" data-player-id="${player.id}" data-action="increase">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>`;
            }

            const isCurrentlyPlayingThisPlayer = player.id === currentlyPlayingPlayerId;
            const playButtonIconClass = isCurrentlyPlayingThisPlayer ? 'fa-stop' : 'fa-play';
            const playButtonTitleText = isCurrentlyPlayingThisPlayer ? 'Stop Song' : 'Play Song';

            listItem.innerHTML = `
                <div class="player-item-main">
                    <span class="drag-handle"><i class="fas fa-grip-vertical"></i></span>
                    <div class="player-info">
                        <span class="number">#${player.number}</span>
                        <span class="name">${player.name}</span>
                    </div>
                    <div class="player-actions">
                        <button class="announce-btn" title="Announce" data-name="${player.announcementName || player.name}"><i class="fas fa-bullhorn"></i></button>
                        <button class="play-song-btn" title="${playButtonTitleText}" data-song="${player.song}" data-player-id="${player.id}">
                            <i class="fas ${playButtonIconClass}"></i>
                        </button>
                    </div>
                </div>
                ${timesBattedRowHTML}`;
            playerListElement.appendChild(listItem);
        });
        addEventListenersToButtons();
    }

    // --- Helper to Update Play/Stop Button Icon ---
    function updatePlayButtonIcon(playerId, makeStopButton) {
        const playButton = playerListElement.querySelector(`.play-song-btn[data-player-id="${playerId}"]`);
        if (playButton) {
            const iconElement = playButton.querySelector('i');
            if (makeStopButton) {
                iconElement.classList.remove('fa-play'); iconElement.classList.add('fa-stop');
                playButton.title = "Stop Song";
            } else {
                iconElement.classList.remove('fa-stop'); iconElement.classList.add('fa-play');
                playButton.title = "Play Song";
            }
        } else {
            console.warn("Could not find play button for player ID:", playerId, "to update icon.");
        }
    }

    // --- EVENT LISTENERS FOR BUTTONS ---
    function addEventListenersToButtons() {
        document.querySelectorAll('.announce-btn').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                announceName(this.dataset.name);
            });
        });

        document.querySelectorAll('.play-song-btn').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                const songToPlay = this.dataset.song;
                const clickedPlayerId = parseInt(this.dataset.playerId);
                if (currentlyPlayingPlayerId === clickedPlayerId) {
                    stopAllAudio();
                } else {
                    playSong(songToPlay, clickedPlayerId);
                }
            });
        });

        document.querySelectorAll('.adjust-btn').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                const playerId = parseInt(this.dataset.playerId);
                const action = this.dataset.action;
                manualAdjustTimesBatted(playerId, action);
            });
        });
        console.log("Event listeners added (including adjust buttons).");
    }

    // --- Increment Times Batted (when song plays) ---
    function incrementTimesBatted(playerId) {
        const player = players.find(p => p.id === playerId);
        if (player) {
            player.timesBatted = (player.timesBatted || 0) + 1;
            console.log(`Player ${player.name} (ID: ${playerId}) times batted: ${player.timesBatted}`);
            // renderPlayerList() is called in proceedWithPlayback after this
        } else {
            console.error("Player not found for ID:", playerId, "in incrementTimesBatted");
        }
    }

    // --- Manual Adjustment for Times Batted ---
    function manualAdjustTimesBatted(playerId, action) {
        const player = players.find(p => p.id === playerId);
        if (player) {
            if (action === 'increase') {
                player.timesBatted = (player.timesBatted || 0) + 1;
            } else if (action === 'decrease') {
                if (player.timesBatted > 0) {
                    player.timesBatted--;
                } else {
                    console.log(`${player.name} already has 0 at-bats, cannot decrease further.`);
                    return; // No change, no need to re-render
                }
            }
            console.log(`Manually adjusted ${player.name} to ${player.timesBatted} at-bats.`);
            renderPlayerList(); // Re-render to show the manual change
        } else {
            console.error("Player not found for ID:", playerId, "in manualAdjustTimesBatted");
        }
    }

    // --- Reset Button Logic ---
    if (resetTimesBattedButton) {
        resetTimesBattedButton.addEventListener('click', () => {
            console.log("Resetting all times batted counts.");
            if (confirm("Are you sure you want to reset all at-bat counts AND the player order?")) { // Updated confirm message
                players.forEach(player => { player.timesBatted = 0; });
                if (currentlyPlayingPlayerId !== null) {
                    updatePlayButtonIcon(currentlyPlayingPlayerId, false);
                    currentlyPlayingPlayerId = null;
                }

                // Clear saved order from localStorage
                try {
                    localStorage.removeItem('walkUpPlayerOrder');
                    console.log('Saved player order cleared from localStorage.');
                } catch (e) {
                    console.error("Error clearing player order from localStorage:", e);
                }

                // To reflect the order reset immediately, we need to reload players from default
                // This is an async operation, so we'll chain it.
                // The simplest way is to just call loadPlayers() again after confirming.
                // This will fetch, then apply (no) saved order, then render.
                console.log("Reloading players to reset order to default...");
                loadPlayers().then(() => { // loadPlayers is async
                    // renderPlayerList(); // loadPlayers now calls renderPlayerList
                    console.log("At-bat counts and player order have been reset.");
                    // alert("At-bat counts and player order have been reset."); // Your choice on alert
                }).catch(error => {
                    console.error("Error reloading players after reset:", error);
                    // Still render with the current (potentially unsorted) in-memory player data if load fails
                    renderPlayerList();
                });

            }
        });
    } else { console.warn("Reset Times Batted button not found."); }

    // --- ANNOUNCE PLAYER NAME ---
    function announceName(name) {
        if ('speechSynthesis' in window) {
            stopAllAudio();
            const utterance = new SpeechSynthesisUtterance(name);
            console.log("Attempting to announce:", name);
            speechSynthesis.speak(utterance);
        } else {
            alert("Sorry, your browser does not support Text-to-Speech.");
            console.warn("SpeechSynthesis API not available.");
        }
    }

    // --- PLAY WALK-UP SONG ---
    function playSong(songSrc, playerId) {
        if (!audioPlayer) { console.error("Audio player element not found!"); alert("Audio player error."); return; }
        if (songSrc && songSrc.trim() !== "" && songSrc !== "undefined" && songSrc !== "null") {
            console.log("PlaySong called for:", songSrc, "Player ID:", playerId, "Unlocked:", isAudioContextUnlocked);
            stopAllAudio();

            audioPlayer.src = songSrc;
            audioPlayer.load();
            if (!isAudioContextUnlocked) {
                console.log("Attempting to unlock audio context with a muted play...");
                audioPlayer.muted = true;
                const unlockPromise = audioPlayer.play();
                if (unlockPromise !== undefined) {
                    unlockPromise.then(() => {
                        audioPlayer.pause(); audioPlayer.currentTime = 0; audioPlayer.muted = false;
                        console.log("Audio context unlock SUCCEEDED (muted play).");
                        isAudioContextUnlocked = true;
                        proceedWithPlayback(songSrc, playerId);
                    }).catch(error => {
                        audioPlayer.muted = false;
                        console.error("Audio context unlock FAILED (muted play):", error.name, error.message);
                        isAudioContextUnlocked = true;
                        proceedWithPlayback(songSrc, playerId);
                    });
                } else {
                    audioPlayer.muted = false; console.warn("Unlock: play() no promise.");
                    isAudioContextUnlocked = true; proceedWithPlayback(songSrc, playerId);
                }
            } else {
                console.log("Audio context already unlocked.");
                proceedWithPlayback(songSrc, playerId);
            }
        } else { alert("No song file specified."); console.warn("Invalid song source:", songSrc); }
    }

    // --- PROCEED WITH PLAYBACK ---
    function proceedWithPlayback(songSrcArgument, playerId) {
        console.log("ProceedWithPlayback for:", audioPlayer.src, "Player ID:", playerId);
        if (!audioPlayer) { console.error("Audio player not found in proceed!"); return; }
        audioPlayer.muted = false;
        console.log("In proceed, muted:", audioPlayer.muted, "volume:", audioPlayer.volume);

        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log("Audio playback SUCCEEDED for:", audioPlayer.src);
                currentlyPlayingPlayerId = playerId;
                incrementTimesBatted(playerId);
                renderPlayerList(); // Update UI including at-bat count and play/stop icon
            }).catch(error => {
                console.error("Audio playback FAILED:", audioPlayer.src, "Error:", error.name, "-", error.message);
                console.error("Full error object for FAILED playback:", error);
                updatePlayButtonIcon(playerId, false); // Reset icon on failure
                if(currentlyPlayingPlayerId === playerId) currentlyPlayingPlayerId = null;
            });
        } else { console.warn("ProceedWithPlayback: play() did not return a promise."); }
    }

    // --- STOP ALL AUDIO (Still used internally) ---
    function stopAllAudio() {
        console.log("Stopping all audio.");
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
        }
        if ('speechSynthesis' in window && speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        if (currentlyPlayingPlayerId !== null) {
            updatePlayButtonIcon(currentlyPlayingPlayerId, false);
            currentlyPlayingPlayerId = null;
        }
    }
    // No event listener for a global stopAllAudioButton as it was removed

    // --- REORDERING (using SortableJS) ---
    function initializeSortable() {
        if (typeof Sortable !== 'undefined' && playerListElement && playerListElement.children.length > 0) {
            new Sortable(playerListElement, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                handle: '.drag-handle',
                filter: '.announce-btn, .play-song-btn, .player-info, .adjust-btn',
                preventOnFilter: true,
                onEnd: function (evt) {
                    console.log('SortableJS onEnd. Old:', evt.oldIndex, 'New:', evt.newIndex);
                    if (typeof evt.oldIndex !== 'undefined' && typeof evt.newIndex !== 'undefined' && evt.oldIndex !== evt.newIndex) {
                        const movedItem = players.splice(evt.oldIndex, 1)[0];
                        players.splice(evt.newIndex, 0, movedItem);
                        console.log('New player order (in memory):', players.map(p => p.name));
                        try {
                            const playerOrderIds = players.map(p => p.id);
                            localStorage.setItem('walkUpPlayerOrder', JSON.stringify(playerOrderIds));
                            console.log('Player order saved to localStorage.');
                        } catch (e) {
                            console.error("Error saving player order to localStorage:", e);
                        }
                    } else if (evt.oldIndex === evt.newIndex) {
                        console.log("SortableJS onEnd: old === new.");
                    } else { console.warn("SortableJS onEnd: Unexpected event."); }
                }
            });
            console.log("SortableJS initialized with filter and handle.");
        } else if (typeof Sortable === 'undefined') { console.warn("SortableJS not loaded.");
        } else { console.log("SortableJS: No items or list not ready."); }
    }

    // --- INITIALIZATION ---
    console.log("DOM fully loaded. Initializing app...");
    if (!audioPlayer) { console.error("CRITICAL: Audio player element not found on DOMContentLoaded!"); }
    loadPlayers(); // Start the app by loading players (which includes loading saved order)
});