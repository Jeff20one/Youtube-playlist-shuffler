//
// Element references
//

const prevButton     = document.getElementById("Prev-button");
const nextButton      = document.getElementById("Next-button");
const resumeButton    = document.getElementById("Resume-button");

const playlistInput   = document.getElementById("Playlist-input");
const shuffleButton   = document.getElementById("Shuffle-button");

const searchInput     = document.getElementById("Search-input");

const listElement     = document.getElementById("List");

const playlistNameText  = document.getElementById("Playlist-name-text");
const videoCounterText  = document.getElementById("Video-counter-text");


//
// State
//

let sitePlaylist   = [];   // array of { id, title }
let currentIndex   = 0;
let playlistName   = "";

let youtubePlayer;
let playerReady = false;


//
// Create YouTube player
//

function onYouTubeIframeAPIReady()
{
    youtubePlayer = new YT.Player(
        "Video-container",
        {
            height: "360",
            width: "640",

            videoId: "",

            playerVars:
            {
                autoplay: 0
            },

            events:
            {
                onReady: () =>
                {
                    playerReady = true;
                }
            }
        }
    );
}


//
// Shuffle button
//

shuffleButton.addEventListener("click", async () =>
{
    const playlistId = playlistInput.value.trim();

    if (!playlistId)
    {
        alert("Enter a playlist ID");
        return;
    }

    setShuffleButtonLoading(true);

    try
    {
        await loadAndShufflePlaylist(playlistId);
    }
    finally
    {
        setShuffleButtonLoading(false);
    }
});


//
// Toggle shuffle button's disabled/loading state
//

function setShuffleButtonLoading(isLoading)
{
    shuffleButton.disabled = isLoading;

    shuffleButton.querySelector("span").textContent =
        isLoading ? "Loading..." : "Shuffle";
}


//
// Resume last session
//

resumeButton.addEventListener("click", () =>
{
    const savedPlaylist = localStorage.getItem("sitePlaylist");
    const savedIndex    = localStorage.getItem("currentIndex");
    const savedName     = localStorage.getItem("playlistName");
    const savedId        = localStorage.getItem("lastPlaylistId");

    if (!savedPlaylist)
    {
        alert("No previous session found");
        return;
    }

    sitePlaylist  = JSON.parse(savedPlaylist);
    currentIndex  = savedIndex ? parseInt(savedIndex, 10) : 0;
    playlistName  = savedName || "";

    if (savedId)
    {
        playlistInput.value = savedId;
    }

    renderPlaylist();
    updateDetails();
    playVideo(currentIndex);
});


//
// Previous / Next buttons
//

prevButton.addEventListener("click", () =>
{
    if (currentIndex > 0)
    {
        playVideo(currentIndex - 1);
    }
});

nextButton.addEventListener("click", () =>
{
    if (currentIndex < sitePlaylist.length - 1)
    {
        playVideo(currentIndex + 1);
    }
});


//
// Search filter
//

searchInput.addEventListener("input", () =>
{
    const query = searchInput.value.trim().toLowerCase();

    const items = listElement.querySelectorAll("li");

    items.forEach((item) =>
    {
        if (!query)
        {
            item.style.display = "";
            return;
        }

        const title = item.textContent.toLowerCase();

        item.style.display = title.includes(query) ? "" : "none";
    });
});


//
// Fetch + shuffle a youtubePlaylist into the sitePlaylist
//

async function loadAndShufflePlaylist(playlistId)
{
    const playlistTitle = await fetchPlaylistTitle(playlistId);

    if (playlistTitle === null)
    {
        return;
    }

    const videos = await fetchPlaylistVideos(playlistId);

    if (videos === null)
    {
        return;
    }

    if (videos.length === 0)
    {
        alert("That playlist has no videos, or the ID is wrong");
        return;
    }

    playlistName = playlistTitle;
    sitePlaylist = shuffleArray(videos);
    currentIndex = 0;

    localStorage.setItem("lastPlaylistId", playlistId);
    localStorage.setItem("playlistName", playlistName);
    localStorage.setItem("sitePlaylist", JSON.stringify(sitePlaylist));
    localStorage.setItem("currentIndex", "0");

    renderPlaylist();
    updateDetails();
    playVideo(0);
}


//
// Fetch playlist title
//

async function fetchPlaylistTitle(playlistId)
{
    const url =
        "https://www.googleapis.com/youtube/v3/playlists" +
        "?part=snippet" +
        "&id=" + playlistId +
        "&key=" + YOUTUBE_API_KEY;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error)
    {
        alert(data.error.message);
        return null;
    }

    if (!data.items || data.items.length === 0)
    {
        alert("Playlist not found");
        return null;
    }

    return data.items[0].snippet.title;
}


//
// Fetch all playlist videos (handles pagination)
//

async function fetchPlaylistVideos(playlistId)
{
    const videos = [];
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
            return null;
        }

        for (const item of data.items)
        {
            videos.push(
            {
                id: item.snippet.resourceId.videoId,
                title: item.snippet.title
            });
        }

        nextPageToken = data.nextPageToken || "";
    }
    while (nextPageToken);

    return videos;
}


//
// Fisher-Yates shuffle
//

function shuffleArray(array)
{
    const result = array.slice();

    for (let i = result.length - 1; i > 0; i--)
    {
        const j = Math.floor(Math.random() * (i + 1));

        const temp = result[i];
        result[i] = result[j];
        result[j] = temp;
    }

    return result;
}


//
// Render the sitePlaylist as <li> elements
//

function renderPlaylist()
{
    listElement.innerHTML = "";

    sitePlaylist.forEach((video, index) =>
    {
        const listItem = document.createElement("li");

        listItem.className = (index === currentIndex) ? "active" : "";

        const span = document.createElement("span");
        span.textContent = video.title;

        listItem.appendChild(span);

        listItem.addEventListener("click", () =>
        {
            playVideo(index);
        });

        listElement.appendChild(listItem);
    });

    // re-apply any active search filter
    searchInput.dispatchEvent(new Event("input"));
}


//
// Update playlist name / counter display
//

function updateDetails()
{
    playlistNameText.textContent = playlistName;

    videoCounterText.textContent =
        (currentIndex + 1) + " / " + sitePlaylist.length;
}


//
// Update the "active" class on the currently playing li
//

function updateActiveListItem()
{
    const items = listElement.querySelectorAll("li");

    items.forEach((item, index) =>
    {
        item.className = (index === currentIndex) ? "active" : "";
    });
}


//
// Play a video from the sitePlaylist by index
//

function playVideo(index)
{
    if (index < 0 || index >= sitePlaylist.length)
    {
        return;
    }

    currentIndex = index;

    localStorage.setItem("currentIndex", String(currentIndex));

    updateDetails();
    updateActiveListItem();

    if (!playerReady)
    {
        return;
    }

    youtubePlayer.loadVideoById(sitePlaylist[index].id);
}
