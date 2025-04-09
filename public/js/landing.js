const createButton = document.querySelector("#createroom");
const videoCont = document.querySelector('.video-self');
const codeCont = document.querySelector('#roomcode');
const joinBut = document.querySelector('#joinroom');
const mic = document.querySelector('#mic');
const cam = document.querySelector('#webcam');

let micAllowed = true;
let camAllowed = true;
let mediaConstraints = { video: true, audio: true };

// Initialize camera
navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(localstream => {
        videoCont.srcObject = localstream;
    })
    .catch(err => {
        console.error("Error accessing media devices:", err);
    });

// Generate random room ID
function uuidv4() {
    return 'xxyxyxxyx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Create room button handler
createButton.addEventListener('click', (e) => {
    e.preventDefault();
    createButton.disabled = true;
    createButton.textContent = 'Creating Room...';
    location.href = `room.html?room=${uuidv4()}`;
});

// Join room button handler
joinBut.addEventListener('click', (e) => {
    e.preventDefault();
    if (codeCont.value.trim() === "") {
        codeCont.classList.add('roomcode-error');
        return;
    }
    const code = codeCont.value.trim();
    location.href = `room.html?room=${code}`;
});

// Room code input handler
codeCont.addEventListener('input', (e) => {
    if (codeCont.value.trim() !== "") {
        codeCont.classList.remove('roomcode-error');
    }
});

// Toggle camera
cam.addEventListener('click', () => {
    camAllowed = !camAllowed;
    mediaConstraints.video = camAllowed;
    
    navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(localstream => {
            videoCont.srcObject = localstream;
            cam.classList.toggle("nodevice", !camAllowed);
            cam.innerHTML = camAllowed ? `<i class="fas fa-video"></i>` : `<i class="fas fa-video-slash"></i>`;
        })
        .catch(err => {
            console.error("Error toggling video:", err);
        });
});

// Toggle microphone
mic.addEventListener('click', () => {
    micAllowed = !micAllowed;
    mediaConstraints.audio = micAllowed;
    
    navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(localstream => {
            videoCont.srcObject = localstream;
            mic.classList.toggle("nodevice", !micAllowed);
            mic.innerHTML = micAllowed ? `<i class="fas fa-microphone"></i>` : `<i class="fas fa-microphone-slash"></i>`;
        })
        .catch(err => {
            console.error("Error toggling audio:", err);
        });
});