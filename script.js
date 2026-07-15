const loadButton = document.getElementById("loadButton");
const resumeButton = document.getElementById("resumeButton");

const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");

const playlistInput = document.getElementById("playlistIdInput");

const videoList = document.getElementById("videoList");
const videoCount = document.getElementById("videoCount");


let loadedVideos = [];

let currentVideoIndex = 0;

let youtubePlayer;



//
// Create YouTube player
//

function onYouTubeIframeAPIReady()
{
    youtubePlayer = new YT.Player(
        "player",
        {
            height: "360",
            width: "640",

            videoId: "",

            playerVars:
            {
                autoplay: 0
            }
        }
    );
}



//
// Load playlist button
//

loadButton.addEventListener("click", async () =>
{
    const playlistId = playlistInput.value.trim();


    if (!playlistId)
    {
        alert("Enter a playlist ID");
        return;
    }


    localStorage.setItem(
        "lastPlaylistId",
        playlistId
    );


    await loadPlaylistVideos(playlistId);


    currentVideoIndex = 0;


    displayVideos();


    if (loadedVideos.length > 0)
    {
        playVideo(0);
    }
});



//
// Resume previous playlist
//

resumeButton.addEventListener("click", async () =>
{
    const lastPlaylistId =
        localStorage.getItem("lastPlaylistId");


    if (!lastPlaylistId)
    {
        alert("No previous session found");
        return;
    }


    playlistInput.value = lastPlaylistId;


    await loadPlaylistVideos(lastPlaylistId);


    currentVideoIndex = 0;


    displayVideos();


    if (loadedVideos.length > 0)
    {
        playVideo(0);
    }
});



//
// Load all playlist videos
//

async function loadPlaylistVideos(playlistId)
{
    loadedVideos = [];

    let nextPageToken = "";


    do
    {
        let url =
            "https://www.googleapis.com/youtube/v3/playlistItems" +
            "?part=snippet" +
            "&maxResults=50" +
            "&playlistId=" + playlistId +
            "&key=" + YOUTUBE_API_KEY;


        if (nextPageToken)
        {
            url += "&pageToken=" + nextPageToken;
        }


        const response = await fetch(url);

        const data = await response.json();


        if (data.error)
        {
            alert(data.error.message);
            return;
        }


        for (const item of data.items)
        {
            loadedVideos.push(
            {
                id: item.snippet.resourceId.videoId,

                title: item.snippet.title
            });
        }


        nextPageToken =
            data.nextPageToken || "";


        videoCount.textContent =
            loadedVideos.length;

    }
    while (nextPageToken);
}



//
// Display playlist
//

function displayVideos()
{
    videoList.innerHTML = "";


    loadedVideos.forEach(
        (video, index) =>
        {
            const listItem =
                document.createElement("li");


            listItem.textContent =
                video.title;


            listItem.addEventListener(
                "click",
                () =>
                {
                    playVideo(index);
                }
            );


            videoList.appendChild(listItem);
        }
    );
}



//
// Play selected video
//

function playVideo(index)
{
    if (!youtubePlayer)
    {
        return;
    }


    if (index < 0 ||
        index >= loadedVideos.length)
    {
        return;
    }


    currentVideoIndex = index;


    youtubePlayer.loadVideoById(
        loadedVideos[index].id
    );
}



//
// Next button
//

nextButton.addEventListener(
    "click",
    () =>
    {
        if (currentVideoIndex < loadedVideos.length - 1)
        {
            playVideo(currentVideoIndex + 1);
        }
    }
);




//
// Previous button
//

previousButton.addEventListener(
    "click",
    () =>
    {
        if (currentVideoIndex > 0)
        {
            playVideo(currentVideoIndex - 1);
        }
    }
);