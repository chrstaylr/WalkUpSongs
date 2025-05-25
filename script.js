document.addEventListener('DOMContentLoaded', () => {
    const playerListElement = document.getElementById('player-list');
    const audioPlayer = document.getElementById('audio-player'); // Your main audio element
    const stopAllAudioButton = document.getElementById('stopAllAudio');

    let players = [];
    let isAudioContextUnlocked = false; // Flag for audio unlock strategy

    // Ensure audioPlayer is not muted by default in JS if we are managing muted state for unlock
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
            listItem.innerHTML = `
                <div class="player-info">
                    <span class="number">#${player.number}</span>
                    <span class="name">${player.name}</span>
                </div>
                <div class="player-actions">
                    <button class="announce-btn" data-name="${player.announcementName || player.name}">Announce</button>
                    <button class="play-song-btn" data-song="${player.song}">Play Song</button>
                </div>
            `;
            playerListElement.appendChild(listItem);
        });
        addEventListenersToButtons();
    }

    // --- EVENT LISTENERS FOR BUTTONS ---
    function addEventListenersToButtons() {
        document.querySelectorAll('.announce-btn').forEach(button => {
            button.addEventListener('click', function() {
                announceName(this.dataset.name);
            });
        });
        document.querySelectorAll('.play-song-btn').forEach(button => {
            button.addEventListener('click', function() {
                playSong(this.dataset.song);
            });
        });
        console.log("Event listeners added to buttons.");
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
            stopAllAudio(); // Stop any currently playing audio

            audioPlayer.src = songSrc;
            audioPlayer.load(); // Explicitly load the new source

            if (!isAudioContextUnlocked) {
                console.log("Attempting to unlock audio context with a muted play...");
                audioPlayer.muted = true; // Mute for the unlock attempt
                const unlockPromise = audioPlayer.play();

                if (unlockPromise !== undefined) {
                    unlockPromise.then(() => {
                        audioPlayer.pause(); // Quickly pause after unlock
                        audioPlayer.currentTime = 0; // Reset
                        audioPlayer.muted = false; // IMPORTANT: Unmute for actual playback
                        console.log("Audio context unlock attempt SUCCEEDED (muted play). Proceeding to actual play.");
                        isAudioContextUnlocked = true;
                        proceedWithPlayback(songSrc); // Now play for real
                    }).catch(error => {
                        audioPlayer.muted = false; // Ensure unmuted even if unlock failed
                        console.error("Audio context unlock attempt FAILED (muted play):", error.name, error.message);
                        isAudioContextUnlocked = true; // Mark as attempted, try playing anyway
                        proceedWithPlayback(songSrc);
                    });
                } else {
                    // Fallback if play() doesn't return a promise (very old browsers)
                    audioPlayer.muted = false;
                    console.warn("Unlock: play() did not return a promise. Assuming unlocked and proceeding.");
                    isAudioContextUnlocked = true;
                    proceedWithPlayback(songSrc);
                }
            } else {
                // Audio context already unlocked, play directly
                console.log("Audio context already unlocked. Proceeding to play directly.");
                proceedWithPlayback(songSrc);
            }
        } else {
            alert("No song file specified or path is invalid.");
            console.warn("Attempted to play an invalid song source:", songSrc);
        }
    }

    function proceedWithPlayback(songSrcArgument) { // songSrcArgument is just for logging consistency
        console.log("ProceedWithPlayback for:", audioPlayer.src); // Use audioPlayer.src as it's already set
        if (!audioPlayer) {
            console.error("Audio player element not found in proceedWithPlayback!");
            return;
        }
        audioPlayer.muted = false; // Ensure it's not muted for actual playback

        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log("Audio playback SUCCEEDED for:", audioPlayer.src);
            }).catch(error => {
                console.error("Audio playback FAILED for:", audioPlayer.src, "Error:", error.name, "-", error.message);
                console.error("Full error object for FAILED playback:", error);
                // alert(`Playback failed: ${error.name}. Try tapping again or check volume/silent mode.`);
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
                onEnd: function (evt) {
                    const movedItem = players.splice(evt.oldIndex, 1)[0];
                    players.splice(evt.newIndex, 0, movedItem);
                    console.log('New player order (client-side):', players.map(p => p.name));
                }
            });
            console.log("SortableJS initialized.");
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