if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);


const drone = new ScaleDrone('sAPCXO33NNAUvf3R');

const roomName = 'observable-' + roomHash;

const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};

let room;

let peer;


function onSuccess() {};

function onError(error) {
  console.error(error);
};

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });
 
  room.on('members', members => {
    console.log('MEMBERS', members);
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  peer = new RTCPeerConnection(configuration);

  peer.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };

  if (isOfferer) {
    peer.onnegotiationneeded = () => {
      peer.createOffer().then(localDescCreated).catch(onError);
    }
  }

  peer.onaddstream = event => {
    remoteVideo.srcObject = event.stream;
  };

  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(stream => {

    localVideo.srcObject = stream;

    peer.addStream(stream);
  }, onError);

  room.on('data', (message, client) => {

    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
   
      peer.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        if (peer.remoteDescription.type === 'offer') {
          peer.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      peer.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    }
  });
}

function localDescCreated(desc) {
  peer.setLocalDescription(
    desc,
    () => sendMessage({'sdp': peer.localDescription}),
    onError
  );
}