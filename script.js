document.addEventListener('DOMContentLoaded', () => {
    const playerListElement = document.getElementById('player-list');
    const audioPlayer = document.getElementById('audio-player');
    const stopAllAudioButton = document.getElementById('stopAllAudio');

    // Optional: Update Stop Button with icon via JS if not done in HTML
    if (stopAllAudioButton && !stopAllAudioButton.innerHTML.includes('fas')) { // Check if icon isn't already there
        stopAllAudioButton.innerHTML = `<i class="fas fa-stop-circle"></i> Stop All Audio`;
    }

    let players = [];
    let isAudioContextUnlocked = false;

    if (audioPlayer) {
        audioPlayer.muted = false;
    }

    // --- LOAD PLAYER DATA FROM JSON ---
    async function loadPlayers() {
        try {
            const response = await fetch('data/players.json');
            console.log('Fetch response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}.`);
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const responseText = await response.text();
                console.error("Response was not JSON. Content-Type:", contentType, "Response Text:", responseText);
                throw new TypeError("Oops, we haven't got JSON! Ensure players.json is valid JSON (no comments).");
            }

            players = await response.json();
            console.log('Players loaded from JSON:', players);

            if (!Array.isArray(players)) {
                console.error("Loaded data is not an array.", players);
                throw new Error("Data from players.json is not an array.");
            }

            renderPlayerList();
            initializeSortable();

        } catch (error) {
            console.error("Could not load player data:", error.name, error.message);
            playerListElement.innerHTML = `<li style="color: red; padding: 10px; background-color: #ffebee;">
                <strong>Error loading player data.</strong><br>
                Details: ${error.message}<br>
                Check console (F12) and ensure 'data/players.json' is valid.
            </li>`;
        }
    }

    // --- RENDER PLAYER LIST ---
    function renderPlayerList() {
        playerListElement.innerHTML = '';
        if (players.length === 0 && !playerListElement.innerHTML.includes('Error loading')) {
            playerListElement.innerHTML = '<li>No players loaded or data is empty.</li>';
            return;
        }
        if (players.length === 0 && playerListElement.innerHTML.includes('Error loading')) return;

        players.forEach(player => {
            const listItem = document.createElement('li');
            listItem.classList.add('player-item');
            listItem.dataset.playerId = player.id;

            // Added a drag handle icon and icons for buttons
            listItem.innerHTML = `
                <span class="drag-handle">
                    <i class="fas fa-grip-vertical"></i>
                </span>
                <div class="player-info">
                    <span class="number">#${player.number}</span>
                    <span class="name">${player.name}</span>
                </div>
                <div class="player-actions">
                    <button class="announce-btn" title="Announce Player" data-name="${player.announcementName || player.name}">
                        <i class="fas fa-bullhorn"></i>
                    </button>
                    <button class="play-song-btn" title="Play Song" data-song="${player.song}">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            `;
            playerListElement.appendChild(listItem);
        });
        addEventListenersToButtons();
    }

    // --- EVENT LISTENERS FOR BUTTONS ---
    function addEventListenersToButtons() {
        document.querySelectorAll('.announce-btn').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation(); // Still good practice, though filter should handle SortableJS
                announceName(this.dataset.name);
            });
        });

        document.querySelectorAll('.play-song-btn').forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation(); // Still good practice
                playSong(this.dataset.song);
            });
        });
        console.log("Event listeners added to buttons (stopPropagation still present).");
    }

    // --- ANNOUNCE PLAYER NAME (Text-to-Speech) ---
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
    function playSong(songSrc) {
        if (!audioPlayer) {
            console.error("Audio player element not found!");
            alert("Audio player error. Please refresh.");
            return;
        }

        if (songSrc && songSrc.trim() !== "" && songSrc !== "undefined" && songSrc !== "null") {
            console.log("PlaySong called for:", songSrc, "Audio unlocked:", isAudioContextUnlocked);
            stopAllAudio();

            audioPlayer.src = songSrc;
            audioPlayer.load();

            if (!isAudioContextUnlocked) {
                console.log("Attempting to unlock audio context with a muted play...");
                audioPlayer.muted = true;
                const unlockPromise = audioPlayer.play();

                if (unlockPromise !== undefined) {
                    unlockPromise.then(() => {
                        audioPlayer.pause();
                        audioPlayer.currentTime = 0;
                        audioPlayer.muted = false;
                        console.log("Audio context unlock attempt SUCCEEDED (muted play). Proceeding to actual play.");
                        isAudioContextUnlocked = true;
                        proceedWithPlayback(songSrc);
                    }).catch(error => {
                        audioPlayer.muted = false;
                        console.error("Audio context unlock attempt FAILED (muted play):", error.name, error.message);
                        isAudioContextUnlocked = true;
                        proceedWithPlayback(songSrc);
                    });
                } else {
                    audioPlayer.muted = false;
                    console.warn("Unlock: play() did not return a promise. Assuming unlocked and proceeding.");
                    isAudioContextUnlocked = true;
                    proceedWithPlayback(songSrc);
                }
            } else {
                console.log("Audio context already unlocked. Proceeding to play directly.");
                proceedWithPlayback(songSrc);
            }
        } else {
            alert("No song file specified or path is invalid.");
            console.warn("Attempted to play an invalid song source:", songSrc);
        }
    }

    function proceedWithPlayback(songSrcArgument) { // songSrcArgument is mainly for potential logging
        console.log("ProceedWithPlayback for:", audioPlayer.src); // Use audioPlayer.src as it's already set
        if (!audioPlayer) {
            console.error("Audio player element not found in proceedWithPlayback!");
            return;
        }
        audioPlayer.muted = false; // Ensure it's not muted for actual playback
        console.log("In proceedWithPlayback, audioPlayer.muted:", audioPlayer.muted, "audioPlayer.volume:", audioPlayer.volume);

        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log("Audio playback SUCCEEDED for:", audioPlayer.src);
            }).catch(error => {
                console.error("Audio playback FAILED for:", audioPlayer.src, "Error:", error.name, "-", error.message);
                console.error("Full error object for FAILED playback:", error);
            });
        } else {
            console.warn("ProceedWithPlayback: play() did not return a promise.");
        }
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
    }

    stopAllAudioButton.addEventListener('click', stopAllAudio);

    // --- REORDERING (using SortableJS) ---
    function initializeSortable() {
        if (typeof Sortable !== 'undefined' && playerListElement && playerListElement.children.length > 0) {
            new Sortable(playerListElement, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                handle: '.drag-handle', // Specify the drag handle
                filter: '.announce-btn, .play-song-btn, .player-info', // Also filter player-info if you only want dragging via handle
                preventOnFilter: true,
                onEnd: function (evt) {
                    console.log('SortableJS onEnd triggered. Old:', evt.oldIndex, 'New:', evt.newIndex);
                    if (typeof evt.oldIndex !== 'undefined' && typeof evt.newIndex !== 'undefined' && evt.oldIndex !== evt.newIndex) {
                        const movedItem = players.splice(evt.oldIndex, 1)[0];
                        players.splice(evt.newIndex, 0, movedItem);
                        console.log('New player order (client-side - from SortableJS onEnd DRAG):', players.map(p => p.name));
                    } else if (evt.oldIndex === evt.newIndex) {
                        console.log("SortableJS onEnd: oldIndex === newIndex. Likely a click/tap not filtered, or no actual move.");
                    } else {
                        console.warn("SortableJS onEnd: Undefined old/new index or unexpected event. Event target:", evt.target, "Item:", evt.item);
                    }
                }
            });
            console.log("SortableJS initialized with filter and handle options.");
        } else if (typeof Sortable === 'undefined') {
            console.warn("SortableJS not loaded. Reordering will not be available.");
        } else {
            console.log("SortableJS: No items to sort or list element not ready.");
        }
    }

    // --- INITIALIZATION ---
    console.log("DOM fully loaded. Initializing app...");
    if (!audioPlayer) {
        console.error("CRITICAL: Audio player element not found on DOMContentLoaded!");
    }
    loadPlayers();
});