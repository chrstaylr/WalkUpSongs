document.addEventListener('DOMContentLoaded', () => {
    const playerListElement = document.getElementById('player-list');
    const audioPlayer = document.getElementById('audio-player'); // Your main audio element
    const stopAllAudioButton = document.getElementById('stopAllAudio');

    let players = []; // Initialize as empty, will be filled from JSON
    // let hasAudioBeenUnlocked = false; // Optional: for more complex audio unlocking scenarios

    // --- LOAD PLAYER DATA FROM JSON ---
    async function loadPlayers() {
        try {
            const response = await fetch('data/players.json'); // Path to your JSON file
            console.log('Fetch response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}. Could not fetch players.json. Check file path and server.`);
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const responseText = await response.text();
                console.error("Response was not JSON. Content-Type:", contentType, "Response Text:", responseText);
                throw new TypeError("Oops, we haven't got JSON! The server returned non-JSON content. Ensure players.json contains valid JSON and no comments.");
            }

            players = await response.json();
            console.log('Players loaded from JSON:', players);

            if (!Array.isArray(players)) {
                console.error("Loaded data is not an array. Check players.json structure.", players);
                throw new Error("Data loaded from players.json is not in the expected array format.");
            }

            renderPlayerList();
            initializeSortable();

        } catch (error) {
            console.error("Could not load player data:", error);
            playerListElement.innerHTML = `<li style="color: red; padding: 10px; background-color: #ffebee;">
                <strong>Error loading player data.</strong><br>
                Details: ${error.message}<br>
                Please ensure 'data/players.json' exists, is correctly formatted (valid JSON, no comments), and the path is correct.
                Check the browser console (F12) for more details.
            </li>`;
        }
    }

    // --- RENDER PLAYER LIST ---
    function renderPlayerList() {
        playerListElement.innerHTML = ''; // Clear existing list

        if (players.length === 0 && playerListElement.innerHTML.includes('Error loading')) {
            // If there was an error loading, don't overwrite the error message with "No players loaded."
            return;
        }
        if (players.length === 0) {
            playerListElement.innerHTML = '<li>No players loaded or data is empty.</li>';
            return;
        }

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
                // Pass the whole player object if you want to use pre-recorded announcement audio later
                // const playerId = parseInt(this.closest('.player-item').dataset.playerId);
                // const player = players.find(p => p.id === playerId);
                announceName(this.dataset.name);
            });
        });

        document.querySelectorAll('.play-song-btn').forEach(button => {
            button.addEventListener('click', function() {
                playSong(this.dataset.song);
            });
        });
    }

    // --- ANNOUNCE PLAYER NAME (Text-to-Speech) ---
    function announceName(name) {
        if ('speechSynthesis' in window) {
            stopAllAudio(); // Stop music if playing
            const utterance = new SpeechSynthesisUtterance(name);
            // Optional: Customize voice, pitch, rate
            // const voices = speechSynthesis.getVoices();
            // if (voices.length > 0) {
            // utterance.voice = voices.find(voice => voice.lang === 'en-US' && voice.default) || voices[0];
            // }
            // utterance.pitch = 1;
            // utterance.rate = 1;
            console.log("Attempting to announce:", name);
            speechSynthesis.speak(utterance);
        } else {
            alert("Sorry, your browser does not support Text-to-Speech.");
            console.warn("SpeechSynthesis API not available.");
        }
    }

    // --- PLAY WALK-UP SONG ---
    function playSong(songSrc) {
        if (songSrc && songSrc.trim() !== "" && songSrc !== "undefined" && songSrc !== "null") {
            console.log("Attempting to play song:", songSrc);
            stopAllAudio(); // Stop any currently playing announcement or song

            audioPlayer.src = songSrc;
            // audioPlayer.load(); // Some suggest this, but usually not strictly needed after setting src. Test if issues persist.

            const playPromise = audioPlayer.play();

            if (playPromise !== undefined) {
                playPromise.then(_ => {
                    // Playback started successfully.
                    console.log("Audio playback started successfully for:", songSrc);
                    // hasAudioBeenUnlocked = true; // If using this flag
                }).catch(error => {
                    // Playback failed. This is common on mobile if not user-initiated "enough".
                    console.error("Audio playback FAILED for:", songSrc, "Error:", error.name, "-", error.message);
                    // Log more details from the error object
                    console.error("Full error object:", error);

                    // You could provide user feedback here
                    // alert(`Could not play song. Mobile browsers often require direct interaction. Error: ${error.name}`);
                    // Or, if you implement an "Enable Audio" button, prompt for that.
                });
            } else {
                // Fallback for older browsers that might not return a Promise from play()
                // This branch is less likely with modern browsers.
                console.warn("audioPlayer.play() did not return a promise. Direct playback attempt (may fail on mobile).");
            }
        } else {
            alert("No song file specified for this player or song path is invalid.");
            console.warn("Attempted to play an undefined, null, or empty song source:", songSrc);
        }
    }

    // --- STOP ALL AUDIO ---
    function stopAllAudio() {
        console.log("Stopping all audio.");
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0; // Reset to start
        }
        if ('speechSynthesis' in window && speechSynthesis.speaking) {
            speechSynthesis.cancel(); // Stop any active speech synthesis
        }
    }

    stopAllAudioButton.addEventListener('click', stopAllAudio);

    // --- REORDERING (using SortableJS) ---
    function initializeSortable() {
        if (typeof Sortable !== 'undefined' && playerListElement.children.length > 0) {
            new Sortable(playerListElement, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: function (evt) {
                    const movedItem = players.splice(evt.oldIndex, 1)[0];
                    players.splice(evt.newIndex, 0, movedItem);
                    console.log('New player order (client-side):', players.map(p => p.name));
                    // If you implement saving order to localStorage, do it here.
                }
            });
            console.log("SortableJS initialized.");
        } else if (typeof Sortable === 'undefined') {
            console.warn("SortableJS not loaded. Reordering will not be available via drag-and-drop.");
        } else {
            console.log("SortableJS loaded, but no player items to sort yet or list element not found.");
        }
    }

    // --- INITIALIZATION ---
    console.log("DOM fully loaded and parsed. Initializing app...");
    loadPlayers(); // Start the process by loading player data

});