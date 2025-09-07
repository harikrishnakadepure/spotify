console.log("hello harikrishna");
let currentsong =new Audio();

async function main() {
  let a = await fetch("http://127.0.0.1:5500/songs/");
  let response = await a.text();
  console.log(response);
  let div = document.createElement("div");
  div.innerHTML = response;
  let as = div.getElementsByTagName("a");
  let songs = [];
  for (let index = 0; index < as.length; index++) {
    const element = as[index];
    if (element.href.endsWith(".mp3")) {
      songs.push(element.href.split("/songs/")[]);
    }
    return songs;
  }


  const playMusic = (track) => {
    // let Audio = new Audio(`songs/${track}`);
    currentsong.src="/songs/"+track;
    currentsong.play();
  }

  async function main() {
   
    let songs = getSongs();
    console.log(songs);
    document.querySelector(".songlist").getElementsByTagName("ul") [0]
    for(const song of songs) {
      songUL.innerHTML=songUL.innerHTML + `<li> 
     
      <div class="leftsonginfo">
        <div class="musicsvg invert">
          <img src="musicsvg.svg" alt="musicsvg" />
        </div>
        <div class="songinfo">
          <div>${song.replaceAll("%20%","")}</div>
          <div>hari</div>
        </div>
      </div>

      <div class="playnowsong">
        <span>playnow</span>
        <img class="invert" src="playnowsong.svg" alt="playnowsong" />
      </div>
   

      
      </li>`;
      
    }
    

  }

 Array.from( document.querySelector(".songlist")).getElementsByTagName("li").forEach((e) => {
  e.addeventListener("click", element => {
  
    console.log(e.querySelector(".info").firstElementChild.innerHTML);
    playMusic(e.querySelector(".info").firstElementChild.innerHTML.trim());
  })
    })
}
main()
