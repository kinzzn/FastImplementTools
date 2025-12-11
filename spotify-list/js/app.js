const domain = 'https://api.spotify.com';
const userID = '31wvg3jmhyykuwyfc2ln2g4y5fgi';
let token = localStorage.getItem('access_token') || document.getElementById('token').innerText
const month = document.getElementById('month').innerText

const YEAR = 2025;
const FROM_MONTH = 1;
const TO_MONTH = 12;

let albumPlaylistByMonth = {}
let singlePlaylistByMonth = {}

let albumPlaylist = []
let singlePlaylist = []
const TIMEOUT = 3000;

const getRefreshToken = async () => {

   // refresh token that has been previously stored
   const refreshToken = localStorage.getItem('refresh_token');
   const url = "https://accounts.spotify.com/api/token";

    const payload = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId
      }),
    }
    const body = await fetch(url, payload);
    const response = await body.json();

    localStorage.setItem('access_token', response.access_token);
    if (response.refresh_token) {
      localStorage.setItem('refresh_token', response.refresh_token);
    }
  }

async function fetchApi(endpoint, method, body = {}) {
    const config = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        method
    };
    if (method === 'POST') {
        config.headers["Content-Type"] = "application/json";
        config.body = JSON.stringify(body);
    }
    
    let res = await fetch(`${domain}/${endpoint}`, config);
    
    // If token expired (401), refresh and retry
    if (res.status === 401) {
        console.log('Token expired, refreshing...');
        await getRefreshToken();
        token = localStorage.getItem('access_token');
        
        // Retry the request with new token
        config.headers.Authorization = `Bearer ${token}`;
        res = await fetch(`${domain}/${endpoint}`, config);
    }
    
    return await res.json();
}

/**
 * scanArtistList
 * @returns artistIds
 */
async function scanArtistList() {
    const LIMIT = 50;
    let artistIds = [];

    let after = ''
    let count = 0;
    let total = Number.MAX_SAFE_INTEGER;

    while (count < total) {
        await new Promise((resolve) => {
            setTimeout(async () => {
                const res = await fetchApi(`v1/me/following?type=artist&limit=${LIMIT}${after ? '&after=' + after : ''}`, 'GET')
                const artists = res.artists?.items;
                after = res.artists?.cursors.after;
                total = res.artists?.total;
                count += artists.length;
                artists.forEach(artist => {
                    artistIds.push(artist.id);
                })
                resolve()
            }, TIMEOUT)
        })
    }
    return Array.from(new Set(artistIds));
}

/**
 * scan albums of artists
 */
async function scanAlbums(artistIds) {
    albumPlaylist = [];
    singlePlaylist = [];
    const length = artistIds.length;

    // fetch albums with timeout
    for (let i = 0; i < length; i++) {
        await fetchArtistAlbums(i);
    }

    async function fetchArtistAlbums(index) {
        return new Promise((resolve) => {
            setTimeout(async () => {
                const artistId = artistIds[index];
                console.log('start fetching', artistId)
                console.log(`[${index + 1}/${length}] processing artist: ${artistId}`)
                
                await getAlbumByMonth(artistId);
                await getSingleByMonth(artistId)    
            
                resolve()
            }, TIMEOUT)
        })
    }

    for(let i=FROM_MONTH;i<=TO_MONTH;i++){
        albumPlaylistByMonth[i]=Array.from(new Set(albumPlaylistByMonth[i]))
        singlePlaylistByMonth[i]=Array.from(new Set(singlePlaylistByMonth[i]))
    }
}

async function getAlbumByMonth(artistId) {
    console.log('getAlbumByMonth')
    return new Promise((resolve) => {
        setTimeout(async () => {
            const res = await fetchApi(`v1/artists/${artistId}/albums?limit=50&include_groups=album%2Ccompilation`, 'GET')
            const albums = res.items;
            for(let i=FROM_MONTH;i<=TO_MONTH;i++){
                const match = i<10?`${YEAR}-0${i}`:`${YEAR}-${i}`
                const valid = albums.filter(album => album['release_date'].indexOf(match) === 0)
                valid.forEach(album => albumPlaylistByMonth[i].push(album.id))
                console.log(artistId, i, valid)               
            }
            resolve()
        }, TIMEOUT)
    })
}

async function getSingleByMonth(artistId) {
    console.log('getSingleByMonth')
    return new Promise((resolve) => {
        setTimeout(async () => {
            const res = await fetchApi(`v1/artists/${artistId}/albums?limit=50&include_groups=single`, 'GET')
            const singles = res.items;
            for(let i=FROM_MONTH;i<=TO_MONTH;i++){
                const match = i<10?`${YEAR}-0${i}`:`${YEAR}-${i}`
                const valid = singles.filter(single => single['release_date'].indexOf(match) === 0)
                valid.forEach(single => singlePlaylistByMonth[i].push(single.id))
                console.log(artistId, i, valid)                    
            }
            resolve()
        }, TIMEOUT)
    })
}

async function createPlaylist(name, description) {
    const body = {
        name,
        description,
        "public": false
    }
    const res = await fetchApi(`v1/users/${userID}/playlists`, 'POST', body)
    return res.id;
}

async function getPlaylistId(name, desc) {
    const res = await fetchApi(`v1/me/playlists?limit=50`, 'GET')
    const lists = res.items;
    console.log('getPlaylistId',name, lists)
    let playlistId = '';
    if (lists.some(list => list && list.name.indexOf(name) === 0)) {
        const exist = lists.filter(list => list.name.indexOf(name) === 0);
        playlistId = exist[0].id;
    } else {
        playlistId = createPlaylist(name, desc);
    }
    return playlistId;
}

async function generatePlaylist(name, desc, trackList) {
    const MAX = 100;
    console.log('Generating playlist:', name)

    const playlistId = await getPlaylistId(name, desc)

    for (let i = 0; i < trackList.length; i += MAX) {
        const requestList = trackList.slice(i, i + MAX);
        const body = {
            position: 0,
            uris: requestList.map(trackId => `spotify:track:${trackId}`)
        }
        const res = await fetchApi(`v1/playlists/${playlistId}/tracks`, 'POST', body)
        const result = res['snapshot_id'];
        if (result) {
            console.log(`Add ${requestList.length} tracks to playlist`);
        } else {
            console.log(res)
        }
    }

}

/**
 * generate playlist
 * if playlist exist, append new songs
 * else create new playlist
 */
async function generateSinglePlaylist(month) {
    console.log('generateSinglePlaylist', month)
    let playlist = []
    for (let i = 0; i < singlePlaylistByMonth[month].length; i++) {
        const albumId = singlePlaylistByMonth[month][i];
        const tracks = await getTracksOfAlbum(albumId);
        playlist.push(tracks[0].id);
    }

    if (Object.values(playlist).length > 0) {
        const match = month<10?`${YEAR}-0${month}`:`${YEAR}-${month}`
        await generatePlaylist(
            `[${match}] Single & EP - ${new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 14)}`,
            `New releases. Monthly generated by script.`,
            playlist
        )
    }
}

async function generateAlbumPlaylist(month) {
    console.log('generateAlbumPlaylist', month)
    let playlist = []
    for (let i = 0; i < albumPlaylistByMonth[month].length; i++) {
        const albumId = albumPlaylistByMonth[month][i];
        const tracks = await getTracksOfAlbum(albumId);
        playlist.push(tracks[0].id);
    }

    // generate playlist
    if (playlist.length > 0) {
        const match = month<10?`${YEAR}-0${month}`:`${YEAR}-${month}`
        await generatePlaylist(
            `[${match}] Album - ${new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 14)}`,
            `New releases. Monthly generated by script.`,
            playlist
        )
    }
}

async function getTracksOfAlbum(albumId) {
    const res = await fetchApi(`v1/albums/${albumId}/tracks?limit=50`, 'GET')
    const tracks = res.items;
    return tracks;
}

/**
 * main
 */
async function generation() {
    
    for(let i=FROM_MONTH;i<=TO_MONTH;i++){
        albumPlaylistByMonth[i] = [];
        singlePlaylistByMonth[i] = [];
    }

    // scan artistList, find albums and singles
    let artistIds = await scanArtistList();
    // artistIds = artistIds.slice(0, 10); // for testing only


    // gather all the albums and singles by artistIds
    await scanAlbums(artistIds);

    // reorganize and generate playlist
    for(let i=FROM_MONTH;i<=TO_MONTH;i++){
        if (albumPlaylistByMonth[i].length > 0) {
            await generateAlbumPlaylist(i)
        }
        if (singlePlaylistByMonth[i].length > 0) {
            await generateSinglePlaylist(i)
        }
    }
}

generation();

