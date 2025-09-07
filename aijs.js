console.log("lets write js");

let currentAudio = null;

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
      songs.push(href); // keep full, encoded URL
    }
  }
  return songs;
}

function playmusic(track) {
  // Accepts full URL or filename; encodes if needed
  const src = track.startsWith("http")
    ? track
    : `/songs/${encodeURIComponent(track)}`;

  if (currentAudio) currentAudio.pause();
  currentAudio = new Audio(src);
  currentAudio.play();
  play.src="pause.svg"
}

async function main() {
  const songs = await getsongs();
  console.log(songs);

  const songList = document.querySelector(".songlist ul");

  // Render list items
  for (const song of songs) {
    const fileName = decodeURIComponent(song.split("/").pop());
    songList.innerHTML += `
      <li>
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
        </div>
      </li>`;
  }

  // Attach click handlers by index → exact song URL
  Array.from(songList.getElementsByTagName("li")).forEach((li, idx) => {
    li.addEventListener("click", () => {
      playmusic(songs[idx]);
    });
  });



  play.addEventListener("click",()=>{
    if(currentsong.paused){
      currentsong.play()
      
      play.src="pause.svg"
    }
    else{
      currentsong.pause()
      play.src="middleplay.svg"
    }
  })


}

main();
