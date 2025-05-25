document.addEventListener('DOMContentLoaded', () => {
    const playerListElement = document.getElementById('player-list');
    const audioPlayer = document.getElementById('audio-player');
    const stopAllAudioButton = document.getElementById('stopAllAudio');
    const resetTimesBattedButton = document.getElementById('resetTimesBatted');

    if (stopAllAudioButton && !stopAllAudioButton.innerHTML.includes('fas')) {
        stopAllAudioButton.innerHTML = `<i class="fas fa-stop-circle"></i> Stop All Audio`;
    }
    if (resetTimesBattedButton && !resetTimesBattedButton.innerHTML.includes('fas')) {
        resetTimesBattedButton.innerHTML = `<i class="fas fa-undo"></i> Reset At-Bats`;
    }

    let players = [];
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
            players = await response.json();
            console.log('Players loaded from JSON:', players);
            if (!Array.isArray(players)) throw new Error("Data from players.json is not an array.");
            renderPlayerList();
            initializeSortable();
        } catch (error) {
            console.error("Could not load player data:", error.name, error.message);
            playerListElement.innerHTML = `<li style="color:red;padding:10px;background:#ffebee;"><strong>Error:</strong> ${error.message}</li>`;
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

            let timesBattedRowHTML = ''; // Initialize as empty

            // --- Conditionally create the Times Batted Row ---
            if (player.timesBatted > 0) {
                let timesBattedValueHTML = '';
                for (let i = 0; i < player.timesBatted; i++) {
                    timesBattedValueHTML += '<i class="fas fa-baseball-ball batted-marker"></i>';
                }
                // Note: If timesBatted becomes 0 again (e.g., manual decrease), this row will NOT be rendered
                // which is the desired "hide" behavior.

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
                    </div>
                `;
            }
            // --- End Times Batted Row ---

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
                ${timesBattedRowHTML}`; // This will be an empty string if timesBatted is 0
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
            // renderPlayerList() will be called by proceedWithPlayback
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
            renderPlayerList(); // Re-render to show the manual change (and hide/show row if needed)
        } else {
            console.error("Player not found for ID:", playerId, "in manualAdjustTimesBatted");
        }
    }

    // --- Reset Button Logic ---
    if (resetTimesBattedButton) {
        resetTimesBattedButton.addEventListener('click', () => {
            console.log("Resetting all times batted counts.");
            if (confirm("Are you sure you want to reset all at-bat counts?")) {
                players.forEach(player => { player.timesBatted = 0; });
                if (currentlyPlayingPlayerId !== null) {
                    updatePlayButtonIcon(currentlyPlayingPlayerId, false);
                    currentlyPlayingPlayerId = null;
                }
                renderPlayerList(); // This will now correctly hide all "At-bats" rows
                // alert("At-bat counts have been reset."); // Alert removed
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
                // updatePlayButtonIcon is not strictly needed here because renderPlayerList will handle it
                incrementTimesBatted(playerId); // This will update data
                renderPlayerList(); // This will update UI including at-bat row and play/stop icon
            }).catch(error => {
                console.error("Audio playback FAILED:", audioPlayer.src, "Error:", error.name, "-", error.message);
                console.error("Full error object for FAILED playback:", error);
                updatePlayButtonIcon(playerId, false);
                if(currentlyPlayingPlayerId === playerId) currentlyPlayingPlayerId = null;
            });
        } else { console.warn("ProceedWithPlayback: play() did not return a promise."); }
    }

    // --- STOP ALL AUDIO ---
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
    stopAllAudioButton.addEventListener('click', stopAllAudio);

    // --- REORDERING (using SortableJS) ---
    function initializeSortable() {
        if (typeof Sortable !== 'undefined' && playerListElement && playerListElement.children.length > 0) {
            new Sortable(playerListElement, {
                animation: 150, ghostClass: 'sortable-ghost', handle: '.drag-handle',
                filter: '.announce-btn, .play-song-btn, .player-info, .adjust-btn',
                preventOnFilter: true,
                onEnd: function (evt) {
                    console.log('SortableJS onEnd. Old:', evt.oldIndex, 'New:', evt.newIndex);
                    if (typeof evt.oldIndex !== 'undefined' && typeof evt.newIndex !== 'undefined' && evt.oldIndex !== evt.newIndex) {
                        const movedItem = players.splice(evt.oldIndex, 1)[0];
                        players.splice(evt.newIndex, 0, movedItem);
                        console.log('New player order (from SortableJS DRAG):', players.map(p => p.name));
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
    loadPlayers();
});