// Initialize Socket.io connection
const socket = io();
const params = new URLSearchParams(location.search);
const roomid = params.get("room");

// DOM Elements
const myvideo = document.querySelector("#vd1");
const chatRoom = document.querySelector('.chat-cont');
const sendButton = document.querySelector('.chat-send');
const messageField = document.querySelector('.chat-input');
const videoContainer = document.querySelector('#vcont');
const overlayContainer = document.querySelector('#overlay');
const continueButt = document.querySelector('.continue-name');
const nameField = document.querySelector('#name-field');
const videoButt = document.querySelector('.novideo');
const audioButt = document.querySelector('.audio');
const cutCall = document.querySelector('.cutcall');
const screenShareButt = document.querySelector('.screenshare');
const whiteboardButt = document.querySelector('.board-icon');

// Whiteboard setup
const whiteboardCont = document.querySelector('.whiteboard-cont');
const canvas = document.querySelector("#whiteboard");
const ctx = canvas.getContext('2d');
let boardVisible = false;
whiteboardCont.style.visibility = 'hidden';

// Whiteboard variables
let isDrawing = false;
let x = 0;
let y = 0;
let color = "black";
let drawsize = 3;
let colorRemote = "black";
let drawsizeRemote = 3;

// WebRTC variables
let videoAllowed = true;
let audioAllowed = true;
let micInfo = {};
let videoInfo = {};
const configuration = { iceServers: [{ urls: "stun:stun.stunprotocol.org" }] };
const mediaConstraints = { video: true, audio: true };
let connections = {};
let cName = {};
let audioTrackSent = {};
let videoTrackSent = {};
let mystream, myscreenshare;
let screenshareEnabled = false;

// Display room code
document.querySelector('.roomcode').textContent = roomid;

// Whiteboard functions
function fitToContainer(canvas) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

fitToContainer(canvas);

function setColor(newcolor) {
    color = newcolor;
    drawsize = 3;
}

function setEraser() {
    color = "white";
    drawsize = 10;
}

function clearBoard() {
    if (window.confirm('Are you sure you want to clear board? This cannot be undone')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        socket.emit('store canvas', canvas.toDataURL());
        socket.emit('clearBoard');
    }
}

function draw(newx, newy, oldx, oldy) {
    ctx.strokeStyle = color;
    ctx.lineWidth = drawsize;
    ctx.beginPath();
    ctx.moveTo(oldx, oldy);
    ctx.lineTo(newx, newy);
    ctx.stroke();
    ctx.closePath();
    socket.emit('store canvas', canvas.toDataURL());
}

function drawRemote(newx, newy, oldx, oldy) {
    ctx.strokeStyle = colorRemote;
    ctx.lineWidth = drawsizeRemote;
    ctx.beginPath();
    ctx.moveTo(oldx, oldy);
    ctx.lineTo(newx, newy);
    ctx.stroke();
    ctx.closePath();
}

// Whiteboard event listeners
canvas.addEventListener('mousedown', e => {
    x = e.offsetX;
    y = e.offsetY;
    isDrawing = true;
});

canvas.addEventListener('mousemove', e => {
    if (isDrawing) {
        draw(e.offsetX, e.offsetY, x, y);
        socket.emit('draw', e.offsetX, e.offsetY, x, y, color, drawsize);
        x = e.offsetX;
        y = e.offsetY;
    }
});

window.addEventListener('mouseup', () => {
    isDrawing = false;
});

// Socket.io event listeners
socket.on('getCanvas', url => {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = url;
});

socket.on('clearBoard', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('draw', (newX, newY, prevX, prevY, color, size) => {
    colorRemote = color;
    drawsizeRemote = size;
    drawRemote(newX, newY, prevX, prevY);
});

// WebRTC functions
function startCall() {
    navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(localStream => {
            myvideo.srcObject = localStream;
            myvideo.muted = true;
            mystream = localStream;

            Object.keys(connections).forEach(key => {
                localStream.getTracks().forEach(track => {
                    connections[key].addTrack(track, localStream);
                    if (track.kind === 'audio') {
                        audioTrackSent[key] = track;
                    } else {
                        videoTrackSent[key] = track;
                    }
                });
            });
        })
        .catch(handleGetUserMediaError);
}

function handleVideoOffer(offer, sid, cname, micinf, vidinf) {
    cName[sid] = cname;
    micInfo[sid] = micinf;
    videoInfo[sid] = vidinf;
    
    connections[sid] = new RTCPeerConnection(configuration);

    connections[sid].onicecandidate = event => {
        if (event.candidate) {
            socket.emit('new icecandidate', event.candidate, sid);
        }
    };

    connections[sid].ontrack = event => {
        if (!document.getElementById(sid)) {
            const vidCont = document.createElement('div');
            vidCont.id = sid;
            vidCont.classList.add('video-box');
            
            const newvideo = document.createElement('video');
            newvideo.classList.add('video-frame');
            newvideo.autoplay = true;
            newvideo.playsinline = true;
            newvideo.id = `video${sid}`;
            newvideo.srcObject = event.streams[0];
            
            const name = document.createElement('div');
            name.classList.add('nametag');
            name.textContent = cName[sid];
            
            const muteIcon = document.createElement('div');
            muteIcon.classList.add('mute-icon');
            muteIcon.id = `mute${sid}`;
            muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
            muteIcon.style.visibility = micInfo[sid] === 'on' ? 'hidden' : 'visible';
            
            const videoOff = document.createElement('div');
            videoOff.classList.add('video-off');
            videoOff.id = `vidoff${sid}`;
            videoOff.textContent = 'Video Off';
            videoOff.style.visibility = videoInfo[sid] === 'on' ? 'hidden' : 'visible';
            
            vidCont.appendChild(newvideo);
            vidCont.appendChild(name);
            vidCont.appendChild(muteIcon);
            vidCont.appendChild(videoOff);
            
            videoContainer.appendChild(vidCont);
        }
    };

    connections[sid].onremovetrack = () => {
        const elem = document.getElementById(sid);
        if (elem) elem.remove();
    };

    connections[sid].onnegotiationneeded = () => {
        connections[sid].createOffer()
            .then(offer => connections[sid].setLocalDescription(offer))
            .then(() => socket.emit('video-offer', connections[sid].localDescription, sid))
            .catch(reportError);
    };

    const desc = new RTCSessionDescription(offer);
    
    connections[sid].setRemoteDescription(desc)
        .then(() => navigator.mediaDevices.getUserMedia(mediaConstraints))
        .then(localStream => {
            myvideo.srcObject = localStream;
            myvideo.muted = true;
            mystream = localStream;
            
            localStream.getTracks().forEach(track => {
                connections[sid].addTrack(track, localStream);
                if (track.kind === 'audio') {
                    audioTrackSent[sid] = track;
                    track.enabled = audioAllowed;
                } else {
                    videoTrackSent[sid] = track;
                    track.enabled = videoAllowed;
                }
            });
            
            return connections[sid].createAnswer();
        })
        .then(answer => connections[sid].setLocalDescription(answer))
        .then(() => socket.emit('video-answer', connections[sid].localDescription, sid))
        .catch(handleGetUserMediaError);
}

function handleNewIceCandidate(candidate, sid) {
    const newcandidate = new RTCIceCandidate(candidate);
    connections[sid].addIceCandidate(newcandidate).catch(reportError);
}

function handleVideoAnswer(answer, sid) {
    const ans = new RTCSessionDescription(answer);
    connections[sid].setRemoteDescription(ans).catch(reportError);
}

// Screen sharing
function screenShareToggle() {
    const screenMediaPromise = screenshareEnabled 
        ? navigator.mediaDevices.getUserMedia({ video: true })
        : (navigator.mediaDevices.getDisplayMedia || navigator.getDisplayMedia).call(navigator, { video: true });

    screenMediaPromise
        .then(stream => {
            screenshareEnabled = !screenshareEnabled;
            
            Object.keys(connections).forEach(key => {
                const sender = connections[key].getSenders()
                    .find(s => s.track && s.track.kind === "video");
                if (sender) sender.replaceTrack(stream.getVideoTracks()[0]);
            });
            
            const newStream = new MediaStream([stream.getVideoTracks()[0]]);
            myvideo.srcObject = newStream;
            myvideo.muted = true;
            mystream = newStream;
            
            screenShareButt.innerHTML = screenshareEnabled 
                ? `<i class="fas fa-desktop"></i><span class="tooltiptext">Stop Share Screen</span>`
                : `<i class="fas fa-desktop"></i><span class="tooltiptext">Share Screen</span>`;
            
            stream.getVideoTracks()[0].onended = () => {
                if (screenshareEnabled) screenShareToggle();
            };
        })
        .catch(err => {
            console.error("Screen sharing error:", err);
            alert("Unable to share screen: " + err.message);
        });
}

// UI Event Listeners
continueButt.addEventListener('click', () => {
    if (!nameField.value.trim()) return;
    
    username = nameField.value.trim();
    overlayContainer.style.visibility = 'hidden';
    document.querySelector("#myname").textContent = `${username} (You)`;
    socket.emit("join room", roomid, username);
});

nameField.addEventListener("keyup", e => {
    if (e.key === "Enter") continueButt.click();
});

sendButton.addEventListener('click', () => {
    const msg = messageField.value.trim();
    if (!msg) return;
    
    messageField.value = '';
    socket.emit('message', msg, username, roomid);
});

messageField.addEventListener("keyup", e => {
    if (e.key === "Enter") sendButton.click();
});

videoButt.addEventListener('click', () => {
    videoAllowed = !videoAllowed;
    
    Object.keys(videoTrackSent).forEach(key => {
        videoTrackSent[key].enabled = videoAllowed;
    });
    
    if (mystream) {
        mystream.getVideoTracks().forEach(track => {
            track.enabled = videoAllowed;
        });
    }
    
    videoButt.innerHTML = videoAllowed 
        ? `<i class="fas fa-video"></i>` 
        : `<i class="fas fa-video-slash"></i>`;
    videoButt.style.backgroundColor = videoAllowed ? "#4ECCA3" : "#b12c2c";
    document.querySelector("#myvideooff").style.visibility = videoAllowed ? 'hidden' : 'visible';
    socket.emit('action', videoAllowed ? 'videoon' : 'videooff');
});

audioButt.addEventListener('click', () => {
    audioAllowed = !audioAllowed;
    
    Object.keys(audioTrackSent).forEach(key => {
        audioTrackSent[key].enabled = audioAllowed;
    });
    
    if (mystream) {
        mystream.getAudioTracks().forEach(track => {
            track.enabled = audioAllowed;
        });
    }
    
    audioButt.innerHTML = audioAllowed 
        ? `<i class="fas fa-microphone"></i>` 
        : `<i class="fas fa-microphone-slash"></i>`;
    audioButt.style.backgroundColor = audioAllowed ? "#4ECCA3" : "#b12c2c";
    document.querySelector("#mymuteicon").style.visibility = audioAllowed ? 'hidden' : 'visible';
    socket.emit('action', audioAllowed ? 'unmute' : 'mute');
});

whiteboardButt.addEventListener('click', () => {
    boardVisible = !boardVisible;
    whiteboardCont.style.visibility = boardVisible ? 'visible' : 'hidden';
});

cutCall.addEventListener('click', () => {
    location.href = '/';
});

screenShareButt.addEventListener('click', screenShareToggle);

// Utility functions
function CopyClassText() {
    const textToCopy = document.querySelector('.roomcode');
    const range = document.createRange();
    range.selectNode(textToCopy);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
    
    const button = document.querySelector(".copycode-button");
    button.textContent = "Copied!";
    setTimeout(() => button.textContent = "Copy Code", 5000);
}

function handleGetUserMediaError(e) {
    switch (e.name) {
        case "NotFoundError":
            alert("Unable to open your call because no camera and/or microphone were found.");
            break;
        case "SecurityError":
        case "PermissionDeniedError":
            break;
        default:
            alert("Error opening your camera and/or microphone: " + e.message);
    }
}

function reportError(e) {
    console.error(e);
}

// Socket.io event listeners
socket.on('user count', count => {
    videoContainer.className = count > 1 ? 'video-cont' : 'video-cont-single';
});

socket.on('video-offer', handleVideoOffer);
socket.on('new icecandidate', handleNewIceCandidate);
socket.on('video-answer', handleVideoAnswer);

socket.on('join room', async (conc, cnames, micinfo, videoinfo) => {
    socket.emit('getCanvas');
    
    if (cnames) cName = cnames;
    if (micinfo) micInfo = micinfo;
    if (videoinfo) videoInfo = videoinfo;
    
    if (conc && conc.length > 0) {
        await Promise.all(conc.map(sid => {
            connections[sid] = new RTCPeerConnection(configuration);
            
            connections[sid].onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('new icecandidate', event.candidate, sid);
                }
            };
            
            connections[sid].ontrack = event => {
                if (!document.getElementById(sid)) {
                    const vidCont = document.createElement('div');
                    vidCont.id = sid;
                    vidCont.classList.add('video-box');
                    
                    const newvideo = document.createElement('video');
                    newvideo.classList.add('video-frame');
                    newvideo.autoplay = true;
                    newvideo.playsinline = true;
                    newvideo.id = `video${sid}`;
                    newvideo.srcObject = event.streams[0];
                    
                    const name = document.createElement('div');
                    name.classList.add('nametag');
                    name.textContent = cName[sid];
                    
                    const muteIcon = document.createElement('div');
                    muteIcon.classList.add('mute-icon');
                    muteIcon.id = `mute${sid}`;
                    muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
                    muteIcon.style.visibility = micInfo[sid] === 'on' ? 'hidden' : 'visible';
                    
                    const videoOff = document.createElement('div');
                    videoOff.classList.add('video-off');
                    videoOff.id = `vidoff${sid}`;
                    videoOff.textContent = 'Video Off';
                    videoOff.style.visibility = videoInfo[sid] === 'on' ? 'hidden' : 'visible';
                    
                    vidCont.appendChild(newvideo);
                    vidCont.appendChild(name);
                    vidCont.appendChild(muteIcon);
                    vidCont.appendChild(videoOff);
                    
                    videoContainer.appendChild(vidCont);
                }
            };
            
            connections[sid].onremovetrack = () => {
                const elem = document.getElementById(sid);
                if (elem) elem.remove();
            };
            
            connections[sid].onnegotiationneeded = () => {
                connections[sid].createOffer()
                    .then(offer => connections[sid].setLocalDescription(offer))
                    .then(() => socket.emit('video-offer', connections[sid].localDescription, sid))
                    .catch(reportError);
            };
        }));
        
        startCall();
    } else {
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localStream => {
                myvideo.srcObject = localStream;
                myvideo.muted = true;
                mystream = localStream;
            })
            .catch(handleGetUserMediaError);
    }
});

socket.on('remove peer', sid => {
    const elem = document.getElementById(sid);
    if (elem) elem.remove();
    delete connections[sid];
});

socket.on('message', (msg, sendername, time) => {
    chatRoom.innerHTML += `
        <div class="message">
            <div class="info">
                <div class="username">${sendername}</div>
                <div class="time">${time}</div>
            </div>
            <div class="content">${msg}</div>
        </div>`;
    chatRoom.scrollTop = chatRoom.scrollHeight;
});

socket.on('action', (msg, sid) => {
    if (!document.getElementById(sid)) return;
    
    switch (msg) {
        case 'mute':
            document.querySelector(`#mute${sid}`).style.visibility = 'visible';
            micInfo[sid] = 'off';
            break;
        case 'unmute':
            document.querySelector(`#mute${sid}`).style.visibility = 'hidden';
            micInfo[sid] = 'on';
            break;
        case 'videooff':
            document.querySelector(`#vidoff${sid}`).style.visibility = 'visible';
            videoInfo[sid] = 'off';
            break;
        case 'videoon':
            document.querySelector(`#vidoff${sid}`).style.visibility = 'hidden';
            videoInfo[sid] = 'on';
            break;
    }
});

// Window resize handler
window.addEventListener('resize', () => {
    fitToContainer(canvas);
});