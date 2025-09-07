console.log("lets write js");

let currentAudio = null;
let songsGlobal = []; // full URLs to mp3s
let currentIndex = -1;

// helpers to set play/pause icons (playbar middle button)
function setPlayButtonToPlaying(playBtn) {
  if (!playBtn) return;
  playBtn.src = "pause.svg";
}
function setPlayButtonToPaused(playBtn) {
  if (!playBtn) return;
  playBtn.src = "middleplay.svg";
}

// format seconds -> mm:ss
function formatTime(sec = 0) {
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function getsongs() {
  const a = await fetch("http://127.0.0.1:5500/songs/");
  const response = await a.text();

  const div = document.createElement("div");
  div.innerHTML = response;

  const as = div.getElementsByTagName("a");
  const songs = [];
  for (let i = 0; i < as.length; i++) {
    const href = as[i].href;
    if (href.endsWith(".mp3")) {
      songs.push(href); // keep full encoded URL
    }
  }
  return songs;
}

// --- Seekbar utilities & interaction ---
const Seek = {
  seekbarEl: null,
  circleEl: null,
  isDragging: false,
  // initialize element refs and listeners
  init() {
    this.seekbarEl = document.querySelector(".playbar .seekbar");
    if (!this.seekbarEl) return;
    this.circleEl = this.seekbarEl.querySelector(".cir");

    // click-to-seek
    this.seekbarEl.addEventListener("click", (e) => {
      // ignore clicks while dragging
      if (this.isDragging) return;
      this.seekToEvent(e);
    });

    // drag handlers (mouse)
    if (this.circleEl) {
      this.circleEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.isDragging = true;
        document.addEventListener("mousemove", this._onMouseMove);
        document.addEventListener("mouseup", this._onMouseUp);
      });

      // touch support
      this.circleEl.addEventListener("touchstart", (e) => {
        this.isDragging = true;
        document.addEventListener("touchmove", this._onTouchMove, { passive: false });
        document.addEventListener("touchend", this._onTouchEnd);
      });
    }
  },

  // internal handlers bound to Seek via arrow wrappers
  _onMouseMove: (e) => {
    Seek._handlePointerMove(e.clientX);
  },
  _onMouseUp: (e) => {
    Seek._finalizeDrag(e.clientX);
  },
  _onTouchMove: (e) => {
    if (!e.touches || e.touches.length === 0) return;
    // prevent scrolling while dragging
    e.preventDefault();
    Seek._handlePointerMove(e.touches[0].clientX);
  },
  _onTouchEnd: (e) => {
    // touchend doesn't have touches; use changedTouches
    const touch = e.changedTouches && e.changedTouches[0];
    Seek._finalizeDrag(touch ? touch.clientX : null);
  },

  // handle moving the circle visually while dragging
  _handlePointerMove(clientX) {
    if (!this.isDragging || !this.seekbarEl || !this.circleEl) return;
    const rect = this.seekbarEl.getBoundingClientRect();
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    const pct = rect.width === 0 ? 0 : (x / rect.width) * 100;
    this._setCirclePercent(pct);
  },

  // finalize drag — actually set audio.currentTime
  _finalizeDrag(clientX) {
    if (!this.isDragging) return;
    this.isDragging = false;
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mouseup", this._onMouseUp);
    document.removeEventListener("touchmove", this._onTouchMove);
    document.removeEventListener("touchend", this._onTouchEnd);

    // if we have a valid clientX then seek audio
    if (clientX !== null && currentAudio && isFinite(currentAudio.duration) && currentAudio.duration > 0) {
      const rect = this.seekbarEl.getBoundingClientRect();
      let x = clientX - rect.left;
      if (x < 0) x = 0;
      if (x > rect.width) x = rect.width;
      const pct = rect.width === 0 ? 0 : (x / rect.width);
      currentAudio.currentTime = pct * currentAudio.duration;
    } else {
      // if duration not ready, we still visually leave the circle where user dragged
    }
  },

  // click based seeking using event
  seekToEvent(e) {
    if (!this.seekbarEl || !currentAudio) return;
    const rect = this.seekbarEl.getBoundingClientRect();
    const clientX = (e.touches && e.touches[0] && e.touches[0].clientX) || e.clientX;
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    const pct = rect.width === 0 ? 0 : (x / rect.width);
    if (isFinite(currentAudio.duration) && currentAudio.duration > 0) {
      currentAudio.currentTime = pct * currentAudio.duration;
    }
    this._setCirclePercent(pct * 100);
  },

  // visual placement helper (% from 0..100)
  _setCirclePercent(pct) {
    if (!this.circleEl) return;
    // clamp
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    // position the circle using left percent
    this.circleEl.style.left = pct + "%";
  },

  // update UI given current audio time/duration; used in timeupdate
  updateFromAudio(audio) {
    if (!this.seekbarEl || !this.circleEl || !audio) return;
    if (this.isDragging) return; // while dragging, don't overwrite
    const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const pct = dur === 0 ? 0 : (audio.currentTime / dur) * 100;
    this._setCirclePercent(pct);
  }
};

// play by index in songsGlobal
async function playIndex(idx) {
  if (!songsGlobal || songsGlobal.length === 0) return;
  if (idx < 0) idx = songsGlobal.length - 1;
  if (idx >= songsGlobal.length) idx = 0;

  currentIndex = idx;

  // stop previous audio if any
  if (currentAudio) {
    try { currentAudio.pause(); } catch (e) {}
    currentAudio = null;
  }

  const src = songsGlobal[currentIndex];
  currentAudio = new Audio(src);

  // UI elements
  const playBtn = document.querySelector(".playbar .songbuttons img:nth-child(2)");
  const songInfoEl = document.querySelector(".song-info");
  const songTimeEl = document.querySelector(".song-time");

  // show song name
  if (songInfoEl) {
    const fileName = decodeURIComponent(src.split("/").pop());
    songInfoEl.textContent = fileName;
  }

  // attach metadata/time handlers
  currentAudio.addEventListener("loadedmetadata", () => {
    if (songTimeEl) {
      const dur = isFinite(currentAudio.duration) ? formatTime(currentAudio.duration) : "00:00";
      songTimeEl.textContent = `00:00 / ${dur}`;
      // update seek UI now that duration is available
      Seek.updateFromAudio(currentAudio);
    }
  });

  currentAudio.addEventListener("timeupdate", () => {
    if (songTimeEl && isFinite(currentAudio.duration)) {
      songTimeEl.textContent = `${formatTime(currentAudio.currentTime)} / ${formatTime(currentAudio.duration)}`;
    } else if (songTimeEl) {
      songTimeEl.textContent = `${formatTime(currentAudio.currentTime)} / 00:00`;
    }
    // update the seek circle position (won't override while dragging)
    Seek.updateFromAudio(currentAudio);
  });

  currentAudio.addEventListener("play", () => setPlayButtonToPlaying(playBtn));
  currentAudio.addEventListener("pause", () => setPlayButtonToPaused(playBtn));

  // when a song ends -> advance to next automatically
  currentAudio.addEventListener("ended", () => {
    nextSong();
  });

  // attempt to play
  try {
    await currentAudio.play();
    setPlayButtonToPlaying(playBtn);
  } catch (err) {
    console.error("Playback failed:", err);
    setPlayButtonToPaused(playBtn);
  }
}

function pauseCurrent() {
  if (!currentAudio) return;
  currentAudio.pause();
}

function resumeCurrent() {
  if (!currentAudio) return;
  return currentAudio.play();
}

function prevSong() {
  if (!songsGlobal || songsGlobal.length === 0) return;
  // wrap around
  const prevIdx = currentIndex <= 0 ? songsGlobal.length - 1 : currentIndex - 1;
  playIndex(prevIdx);
}

function nextSong() {
  if (!songsGlobal || songsGlobal.length === 0) return;
  const nextIdx = (currentIndex + 1) % songsGlobal.length;
  playIndex(nextIdx);
}

async function main() {
  const songs = await getsongs();
  songsGlobal = songs;
  console.log("songs:", songsGlobal);

  const songList = document.querySelector(".songlist ul");
  if (!songList) {
    console.error("Could not find .songlist ul");
    return;
  }

  // render list
  const frag = document.createDocumentFragment();
  songsGlobal.forEach((song) => {
    const fileName = decodeURIComponent(song.split("/").pop());
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="leftsonginfo">
        <div class="musicsvg invert">
          <img src="musicsvg.svg" alt="musicsvg" />
        </div>
        <div class="songinfo">
          <div>${fileName}</div>
          <div>hari</div>
        </div>
      </div>
      <div class="playnowsong">
        <span>playnow</span>
        <img class="invert" src="playnowsong.svg" alt="playnowsong" />
      </div>`;
    frag.appendChild(li);
  });
  songList.innerHTML = "";
  songList.appendChild(frag);

  // attach click handlers, mapping index -> song
  Array.from(songList.getElementsByTagName("li")).forEach((li, idx) => {
    li.addEventListener("click", () => {
      playIndex(idx);
    });
  });

  // initialize seek UI
  Seek.init();

  // wire playbar buttons
  const buttonImgs = document.querySelectorAll(".playbar .songbuttons img");
  const prevBtn = buttonImgs[0]; // previousplay.svg
  const playBtn = buttonImgs[1]; // middleplay.svg
  const nextBtn = buttonImgs[2]; // nextplay.svg

  if (playBtn) {
    playBtn.addEventListener("click", async () => {
      if (currentAudio) {
        if (currentAudio.paused) {
          try {
            await resumeCurrent();
            setPlayButtonToPlaying(playBtn);
          } catch (err) {
            console.error("Failed to resume:", err);
          }
        } else {
          pauseCurrent();
          setPlayButtonToPaused(playBtn);
        }
      } else {
        // fallback: play first song
        if (songsGlobal.length > 0) {
          await playIndex(0);
        } else {
          console.warn("No songs available to play.");
        }
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      prevSong();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      nextSong();
    });
  }

  
}

main().catch((e) => console.error(e));

document.addEventListener("DOMContentLoaded", () => {
  const plusBtn = document.querySelector(".plussvg");
  const cardContainer = document.querySelector(".spotify-playlists");

  plusBtn.addEventListener("click", () => {
    // create a new card element
    const newCard = document.createElement("div");
    newCard.classList.add("card");

    newCard.innerHTML = `
      <div class="play">
        <svg viewBox="0 0 24 24">
          <path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606"></path>
        </svg>
      </div>
      <img src="https://i.scdn.co/image/ab67616d00001e02627b5b17cb48f6e6956b842e" alt="new song" />
      <h3>New Song</h3>
      <p>New Artist</p>
    `;

    // 👉 insert new card right after the card-container
    cardContainer.insertAdjacentElement("afterend", newCard);
  });
});


document.addEventListener("DOMContentLoaded", () => {
  const cardContainer = document.querySelector(".card-container");
  const leftBtn = document.querySelector(".scroll-btn.left");
  const rightBtn = document.querySelector(".scroll-btn.right");

  const scrollAmount = 300; // adjust how far to scroll per click

  rightBtn.addEventListener("click", () => {
    cardContainer.scrollBy({ left: scrollAmount, behavior: "smooth" });
  });

  leftBtn.addEventListener("click", () => {
    cardContainer.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.querySelector(".login-btn");
  const signupBtn = document.querySelector(".signup-btn");
  const loginModal = document.querySelector(".login-modal");
  const signupModal = document.querySelector(".signup-modal");
  const closeBtns = document.querySelectorAll(".modal .close");

  // open modals
  loginBtn.addEventListener("click", () => {
    loginModal.style.display = "block";
  });

  signupBtn.addEventListener("click", () => {
    signupModal.style.display = "block";
  });

  // close modals
  closeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      btn.closest(".modal").style.display = "none";
    });
  });

  // close if clicking outside
  window.addEventListener("click", e => {
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none";
    }
  });
});






/* ---------- Search / Play integration ---------- */

async function ensureSongsLoaded() {
  // if songsGlobal already loaded, return immediately
  if (songsGlobal && songsGlobal.length > 0) return songsGlobal;
  // otherwise try fetching quickly
  try {
    const songs = await getsongs();
    songsGlobal = songs;
    return songsGlobal;
  } catch (err) {
    console.error("Failed to load songs for search:", err);
    return [];
  }
}

function renderSearchResults(matches) {
  const resultsEl = document.getElementById("searchResults");
  resultsEl.innerHTML = "";
  if (!matches || matches.length === 0) {
    resultsEl.innerHTML = `<div class="no-results">No results found</div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  matches.forEach(({ index, fileName }) => {
    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `<div class="r-name">${fileName}</div><div class="r-action">Play</div>`;
    div.addEventListener("click", async () => {
      // hide search UI (optional)
      const searchBar = document.querySelector(".search-bar");
      if (searchBar) searchBar.classList.add("hidden");

      // play the actual index from songsGlobal
      await playIndex(index);
    });
    frag.appendChild(div);
  });
  resultsEl.appendChild(frag);
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[-_.+]/g, " ");
}

/* Attach search listeners on DOM ready */
document.addEventListener("DOMContentLoaded", () => {
  const searchSvg = document.getElementById("searchSvg");
  const searchBar = document.querySelector(".search-bar");
  const searchInput = document.getElementById("songSearch");
  const resultsEl = document.getElementById("searchResults");

  if (!searchSvg || !searchBar || !searchInput || !resultsEl) {
    // nothing to do
    return;
  }

  // toggle search bar when search icon clicked
  searchSvg.addEventListener("click", async () => {
    // ensure songs list loaded before searching
    await ensureSongsLoaded();

    searchBar.classList.toggle("hidden");
    if (!searchBar.classList.contains("hidden")) {
      searchInput.focus();
      searchInput.value = ""; // clear prior query
      resultsEl.innerHTML = `<div class="no-results">Type to search songs</div>`;
    }
  });

  // input handler (debounced-ish)
  let searchTimer = null;
  searchInput.addEventListener("input", async (e) => {
    clearTimeout(searchTimer);
    const q = (e.target.value || "").trim().toLowerCase();
    searchTimer = setTimeout(async () => {
      // ensure songs loaded
      const songs = await ensureSongsLoaded();
      if (!songs || songs.length === 0) {
        resultsEl.innerHTML = `<div class="no-results">No songs available</div>`;
        return;
      }

      if (q === "") {
        resultsEl.innerHTML = `<div class="no-results">Type to search songs</div>`;
        return;
      }

      // find matches with their original index
      const matches = [];
      for (let i = 0; i < songs.length; i++) {
        try {
          const decoded = decodeURIComponent(songs[i].split("/").pop() || "");
          const name = normalizeName(decoded);
          if (name.includes(q)) {
            matches.push({ index: i, fileName: decoded });
          }
        } catch (err) {
          // fallback
          const raw = songs[i].split("/").pop() || songs[i];
          if ((raw + "").toLowerCase().includes(q)) {
            matches.push({ index: i, fileName: raw });
          }
        }
      }

      renderSearchResults(matches);
    }, 180); // small debounce
  });

  // optional: close search on Escape
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchBar.classList.add("hidden");
    }
  });
});






