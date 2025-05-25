document.addEventListener('DOMContentLoaded', () => {
    const playerListElement = document.getElementById('player-list');
    const audioPlayer = document.getElementById('audio-player');
    const stopAllAudioButton = document.getElementById('stopAllAudio');

    let players = []; // Initialize as empty, will be filled from JSON

    // --- LOAD PLAYER DATA FROM JSON ---
    async function loadPlayers() {
        try {
            const response = await fetch('data/players.json'); // Path to your JSON file
            console.log('Fetch response status:', response.status); // For debugging

            if (!response.ok) { // Check if the request was successful (status 200-299)
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}. Could not fetch players.json. Check file path and server.`);
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const responseText = await response.text(); // Get response as text to see what it is
                console.error("Response was not JSON. Content-Type:", contentType, "Response Text:", responseText);
                throw new TypeError("Oops, we haven't got JSON! The server returned non-JSON content.");
            }

            players = await response.json(); // Parse the JSON data
            console.log('Players loaded from JSON:', players); // For debugging

            if (!Array.isArray(players)) {
                console.error("Loaded data is not an array. Check players.json structure.", players);
                throw new Error("Data loaded from players.json is not in the expected array format.");
            }

            renderPlayerList(); // Now render the list with the loaded data
            initializeSortable(); // Initialize SortableJS after players are loaded and rendered

        } catch (error) {
            console.error("Could not load player data:", error);
            // Display a user-friendly error message on the page
            playerListElement.innerHTML = `<li style="color: red; padding: 10px; background-color: #ffebee;">
                <strong>Error loading player data.</strong><br>
                Please ensure 'data/players.json' exists, is correctly formatted, and the path is correct.
                Check the browser console (F12) for more details.
            </li>`;
            // Optionally, load some default hardcoded data as a fallback or to allow app usage
            // players = [ { id: 0, number: "ERR", name: "Error Loading Players", song: "", announcementName: "Error" }];
            // renderPlayerList();
            // initializeSortable();
        }
    }

    // --- RENDER PLAYER LIST ---
    function renderPlayerList() {
        playerListElement.innerHTML = ''; // Clear existing list

        if (players.length === 0) {
            playerListElement.innerHTML = '<li>No players loaded.</li>';
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
        // ... (your existing announce and play song button logic) ...
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
    }

    // --- ANNOUNCE PLAYER NAME (Text-to-Speech) ---
    function announceName(name) {
        // ... (your existing announceName logic) ...
        if ('speechSynthesis' in window) {
            stopAllAudio();
            const utterance = new SpeechSynthesisUtterance(name);
            speechSynthesis.speak(utterance);
        } else {
            alert("Sorry, your browser does not support Text-to-Speech.");
        }
    }

    // --- PLAY WALK-UP SONG ---
    function playSong(songSrc) {
        // ... (your existing playSong logic) ...
        if (songSrc && songSrc !== "undefined" && songSrc !== "null") {
            audioPlayer.src = songSrc;
            audioPlayer.play()
                .catch(error => {
                    console.error("Error playing audio:", error);
                    alert(`Could not play song: ${songSrc}. Check console for errors. Ensure the file exists.`);
                });
        } else {
            alert("No song file specified for this player.");
            console.warn("Attempted to play an undefined or null song source.");
        }
    }

    // --- STOP ALL AUDIO ---
    function stopAllAudio() {
        // ... (your existing stopAllAudio logic) ...
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        if ('speechSynthesis' in window && speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
    }
    stopAllAudioButton.addEventListener('click', stopAllAudio);


    // --- REORDERING (using SortableJS) ---
    function initializeSortable() {
        if (typeof Sortable !== 'undefined' && playerListElement.children.length > 0) { // Check if Sortable exists and there are items
            new Sortable(playerListElement, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: function (evt) {
                    const movedItem = players.splice(evt.oldIndex, 1)[0];
                    players.splice(evt.newIndex, 0, movedItem);
                    console.log('New player order:', players.map(p => p.name));
                }
            });
        } else if (typeof Sortable === 'undefined') {
            console.warn("SortableJS not loaded. Reordering will not be available via drag-and-drop.");
        }
    }

    // --- INITIALIZATION ---
    loadPlayers(); // <<-- THIS IS THE KEY CALL to start the loading process

});