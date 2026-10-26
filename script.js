//
// Element references
//

const prevButton     = document.getElementById("Prev-button");
const nextButton      = document.getElementById("Next-button");

const loopButton        = document.getElementById("Loop-button");
const autoShuffleButton = document.getElementById("Auto-shuffle-button");
const resumeButton    = document.getElementById("Resume-button");

const playlistInput   = document.getElementById("Playlist-input");
const shuffleButton   = document.getElementById("Shuffle-button");

const searchInput     = document.getElementById("Search-input");

const listElement     = document.getElementById("List");

const playlistNameText  = document.getElementById("Playlist-name-text");
const videoCounterText  = document.getElementById("Video-counter-text");

const whitelistButton = document.getElementById("Whitelist-button");
const blacklistButton = document.getElementById("Blacklist-button");


//
// State
//

let loopEnabled        = localStorage.getItem("loopEnabled") === "true";
let autoShuffleEnabled = localStorage.getItem("autoShuffleEnabled") === "true";

let sitePlaylist   = [];   // array of { id, title }
let currentIndex   = 0;
let playlistName   = "";

let youtubePlayer;
let playerReady = false;

let whitelist = new Set();   // video ids, persistent across playlists
let blacklist = new Set();   // video ids, persistent across playlists

let blacklistCheckTimeout = null;


//
// Load persistent whitelist / blacklist on startup
//

loadRatingLists();

function loadRatingLists()
{
    const savedWhitelist = localStorage.getItem("whitelist");
    const savedBlacklist = localStorage.getItem("blacklist");

    whitelist = new Set(savedWhitelist ? JSON.parse(savedWhitelist) : []);
    blacklist = new Set(savedBlacklist ? JSON.parse(savedBlacklist) : []);
}

function saveWhitelist()
{
    localStorage.setItem("whitelist", JSON.stringify(Array.from(whitelist)));
}

function saveBlacklist()
{
    localStorage.setItem("blacklist", JSON.stringify(Array.from(blacklist)));
}


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
                },

                onStateChange: (event) =>
                {
                    if (event.data === YT.PlayerState.ENDED)
                    {
                        playNextVideo();
                    }
                },

                onError: () =>
                {
                    playNextVideo();
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
        isLoading ? "Loading" : "Shuffle";
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
// Loop / Auto Shuffle toggles
//

loopButton.classList.toggle("active", loopEnabled);
autoShuffleButton.classList.toggle("active", autoShuffleEnabled);

loopButton.addEventListener("click", () =>
{
    loopEnabled = !loopEnabled;
    localStorage.setItem("loopEnabled", String(loopEnabled));
    loopButton.classList.toggle("active", loopEnabled);
});

autoShuffleButton.addEventListener("click", () =>
{
    autoShuffleEnabled = !autoShuffleEnabled;
    localStorage.setItem("autoShuffleEnabled", String(autoShuffleEnabled));
    autoShuffleButton.classList.toggle("active", autoShuffleEnabled);
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
// Whitelist / Blacklist buttons
//

whitelistButton.addEventListener("click", () =>
{
    const video = sitePlaylist[currentIndex];

    if (!video)
    {
        return;
    }

    if (whitelist.has(video.id))
    {
        whitelist.delete(video.id);
    }
    else
    {
        whitelist.add(video.id);
        blacklist.delete(video.id);
    }

    saveWhitelist();
    saveBlacklist();
    updateRatingButtons();
});

blacklistButton.addEventListener("click", () =>
{
    const video = sitePlaylist[currentIndex];

    if (!video)
    {
        return;
    }

    if (blacklist.has(video.id))
    {
        blacklist.delete(video.id);
    }
    else
    {
        blacklist.add(video.id);
        whitelist.delete(video.id);
    }

    saveWhitelist();
    saveBlacklist();
    updateRatingButtons();
});


//
// Update whitelist / blacklist button highlighting for current video
//

function updateRatingButtons()
{
    const video = sitePlaylist[currentIndex];

    const videoId = video ? video.id : null;

    whitelistButton.classList.toggle("active", whitelist.has(videoId));
    blacklistButton.classList.toggle("active", blacklist.has(videoId));
}


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
    sitePlaylist = sortWhitelistedFirst(sitePlaylist);
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
// Move whitelisted videos to the front, preserving shuffle order within each group
//

function sortWhitelistedFirst(array)
{
    const result = array.slice();

    result.sort((a, b) =>
    {
        const aRank = whitelist.has(a.id) ? 0 : 1;
        const bRank = whitelist.has(b.id) ? 0 : 1;

        return aRank - bRank;
    });

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

        const number = String(index + 1).padStart(4, "0");

        const span = document.createElement("span");
        span.textContent = number + " ~~ " + video.title;

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
    
    scrollActiveItemIntoView();
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
    updateRatingButtons();

    if (blacklistCheckTimeout)
    {
        clearTimeout(blacklistCheckTimeout);
    }

    const video = sitePlaylist[index];

    blacklistCheckTimeout = setTimeout(() =>
    {
        if (currentIndex === index && blacklist.has(video.id))
        {
            playNextVideo();
        }
    }, 5000);

    if (!playerReady)
    {
        return;
    }

    youtubePlayer.loadVideoById(video.id);
}

//
// Auto-advance to next video when current one ends
//

function playNextVideo()
{
    if (currentIndex < sitePlaylist.length - 1)
    {
        playVideo(currentIndex + 1);
        return;
    }

    // end of the sitePlaylist
    if (!loopEnabled || sitePlaylist.length === 0)
    {
        return;
    }

    if (autoShuffleEnabled)
    {
        reshuffleSitePlaylist();
    }

    playVideo(0);
}

//
// Reshuffle the already-loaded sitePlaylist (no API call needed)
//

function reshuffleSitePlaylist()
{
    sitePlaylist = sortWhitelistedFirst(shuffleArray(sitePlaylist));
    currentIndex = 0;

    localStorage.setItem("sitePlaylist", JSON.stringify(sitePlaylist));
    localStorage.setItem("currentIndex", "0");

    renderPlaylist();
    updateDetails();
}

//
// Scroll the active list item to the center of the Playlist div
//

function scrollActiveItemIntoView()
{
    const container = document.getElementById("List");
    const activeItem = listElement.querySelector("li.active");

    if (!activeItem)
    {
        return;
    }

    const containerHeight = container.clientHeight;
    const itemTop = activeItem.offsetTop;
    const itemHeight = activeItem.offsetHeight;

    let targetScrollTop = itemTop - (containerHeight / 2) + (itemHeight / 2);

    const maxScrollTop = container.scrollHeight - containerHeight;
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));

    animateScrollTo(container, targetScrollTop, 200);
}


//
// Animate a container's scrollTop over a fixed duration (ms)
//

function animateScrollTo(container, targetScrollTop, duration)
{
    const startScrollTop = container.scrollTop;
    const distance = targetScrollTop - startScrollTop;
    const startTime = performance.now();

    function step(currentTime)
    {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        container.scrollTop = startScrollTop + (distance * progress);

        if (progress < 1)
        {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

//
// Remove focus from any button after it's clicked
// (stops outline persisting + spacebar re-triggering it)
//

document.addEventListener("click", (event) =>
{
    if (event.target.closest("button"))
    {
        event.target.closest("button").blur();
    }
});
