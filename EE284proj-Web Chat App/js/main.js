
var startButton = document.getElementById('startButton');
var callButton = document.getElementById('callButton');
var hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
hangupButton.disabled = true;
startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;

var startingTime;
var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');

var localStream;
var client1;
var client2;
var offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

function getName(client) {
  return (client === client1) ? 'client1' : 'client2';
}

function getOtherclient(client) {
  return (client === client1) ? client2 : client1;
}

function start() {
  trace('Requesting local stream');
  startButton.disabled = true;
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
}
  function gotStream(stream) {
  trace('Received local stream');
  localVideo.srcObject = stream;
  // Add localStream to global scope so it's accessible from the browser console
  window.localStream = localStream = stream;
  callButton.disabled = false;
}

function call() {
  callButton.disabled = true;
  hangupButton.disabled = false;
  trace('Starting call');
  startingTime = window.performance.now();
  var videoTracks = localStream.getVideoTracks();
  var audioTracks = localStream.getAudioTracks();
  if (videoTracks.length > 0) {
    trace('Using video device: ' + videoTracks[0].label);
  }
  if (audioTracks.length > 0) {
    trace('Using audio device: ' + audioTracks[0].label);
  }
  var servers = null;
  // Add client1 to global scope so it's accessible from the browser console
  window.client1 = client1 = new RTCPeerConnection(servers);
  trace('Created local peer connection object client1');
  client1.onicecandidate = function(e) {
    onIceCandidate(client1, e);
  };
  // Add client2 to global scope so it's accessible from the browser console
  window.client2 = client2 = new RTCPeerConnection(servers);
  trace('Created remote peer connection object client2');
  client2.onicecandidate = function(e) {
    onIceCandidate(client2, e);
  };
  client1.oniceconnectionstatechange = function(e) {
    onIceStateChange(client1, e);
  };
  client2.oniceconnectionstatechange = function(e) {
    onIceStateChange(client2, e);
  };
  client2.onaddstream = gotRemoteStream;

  client1.addStream(localStream);
  trace('Added local stream to client1');

  trace('client1 createOffer start');
  client1.createOffer(
    offerOptions
  ).then(
    onCreateOfferSuccess,
    onCreateSessionDescriptionError
  );
}

function onIceCandidate(client, event) {
  if (event.candidate) {
    getOtherclient(client).addIceCandidate(
      new RTCIceCandidate(event.candidate)
    ).then(
      function() {
        onAddIceCandidateSuccess(client);
      },
      function(err) {
        onAddIceCandidateError(client, err);
      }
    );
    trace(getName(client) + ' ICE candidate: \n' + event.candidate.candidate);
  }
}

function onAddIceCandidateSuccess(client) {
  trace(getName(client) + ' addIceCandidate success');
}

function onAddIceCandidateError(client, error) {
  trace(getName(client) + ' failed to add ICE Candidate: ' + error.toString());
}

function onIceStateChange(client, event) {
  if (client) {
    trace(getName(client) + ' ICE state: ' + client.iceConnectionState);
    console.log('ICE state change event: ', event);
  }
}

function gotRemoteStream(e) {
  // Add remoteStream to global scope so it's accessible from the browser console
  window.remoteStream = remoteVideo.srcObject = e.stream;
  trace('client2 received remote stream');
}

function onCreateOfferSuccess(desc) {
  trace('Offer from client1\n' + desc.sdp);
  trace('client1 setLocalDescription start');
  client1.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(client1);
    },
    onSetSessionDescriptionError
  );
  trace('client2 setRemoteDescription start');
  client2.setRemoteDescription(desc).then(
    function() {
      onSetRemoteSuccess(client2);
    },
    onSetSessionDescriptionError
  );
  trace('client2 createAnswer start');
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  client2.createAnswer().then(
    onCreateAnswerSuccess,
    onCreateSessionDescriptionError
  );
}

function onSetLocalSuccess(client) {
  trace(getName(client) + ' setLocalDescription complete');
}

function onSetRemoteSuccess(client) {
  trace(getName(client) + ' setRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
  trace('Failed to set session description: ' + error.toString());
}

function onCreateAnswerSuccess(desc) {
  trace('Answer from client2:\n' + desc.sdp);
  trace('client2 setLocalDescription start');
  client2.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(client2);
    },
    onSetSessionDescriptionError
  );
  trace('client1 setRemoteDescription start');
  client1.setRemoteDescription(desc).then(
    function() {
      onSetRemoteSuccess(client1);
    },
    onSetSessionDescriptionError
  );
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}


function trace(text) {
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    var now = (window.performance.now() / 1000).toFixed(3);
    console.log(now + ': ' + text);
  } else {
    console.log(text);
  }
}

function hangup() {
  trace('Ending call');
  client1.close();
  client2.close();
  client1 = null;
  client2 = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
}

var ee284localConnect;
var ee284remoteConnect;
var sendingChannel;
var receivingChannel;
var clientConstraint;
var dataConstraint;
var dataChannelSend = document.querySelector('textarea#dataChannelSend');
var dataChannelReceive = document.querySelector('textarea#dataChannelReceive');
var startButton1 = document.querySelector('button#startButton1');
var sendButton1 = document.querySelector('button#sendButton');
var closeButton1 = document.querySelector('button#closeButton');

startButton1.onclick = createConnection;
sendButton.onclick = sendData;
closeButton.onclick = closeDataChannels;

function createConnection() {
  dataChannelSend.placeholder = '';
  var servers = null;
  clientConstraint = null;
  dataConstraint = null;
  trace('Using SCTP based data channels');
  // For SCTP, reliable and ordered delivery is true by default.
  // Add ee284localConnect to global scope to make it visible
  // from the browser console.
  window.ee284localConnect = ee284localConnect =
      new RTCPeerConnection(servers, clientConstraint);
  trace('Created local peer connection object ee284localConnect');

  sendingChannel = ee284localConnect.createDataChannel('sendDataChannel',
      dataConstraint);
  trace('Created send data channel');

  ee284localConnect.onicecandidate = iceCallback1;
  sendingChannel.onopen = onsendingChannelStateChange;
  sendingChannel.onclose = onsendingChannelStateChange;

  // Add ee284remoteConnect to global scope to make it visible
  // from the browser console.
  window.ee284remoteConnect = ee284remoteConnect =
      new RTCPeerConnection(servers, clientConstraint);
  trace('Created remote peer connection object ee284remoteConnect');

  ee284remoteConnect.onicecandidate = iceCallback2;
  ee284remoteConnect.ondatachannel = receivingChannelCallback;

  ee284localConnect.createOffer().then(
    gotDescription1,
    onCreateSessionDescriptionError
  );
  startButton1.disabled = true;
  closeButton1.disabled = false;
}

function iceCallback1(event) {
  trace('local ice callback');
  if (event.candidate) {
    ee284remoteConnect.addIceCandidate(
      event.candidate
    ).then(
      onAddIceCandidateSuccess,
      onAddIceCandidateError
    );
    trace('Local ICE candidate: \n' + event.candidate.candidate);
  }
}

function iceCallback2(event) {
  trace('remote ice callback');
  if (event.candidate) {
    ee284localConnect.addIceCandidate(
      event.candidate
    ).then(
      onAddIceCandidateSuccess,
      onAddIceCandidateError
    );
    trace('Remote ICE candidate: \n ' + event.candidate.candidate);
  }
}

function onsendingChannelStateChange() {
  var readyState = sendingChannel.readyState;
  trace('Send channel state is: ' + readyState);
  if (readyState === 'open') {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    sendButton1.disabled = false;
    closeButton1.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton1.disabled = true;
    closeButton1.disabled = true;
  }
}


function receivingChannelCallback(event) {
  trace('Receive Channel Callback');
  receivingChannel = event.channel;
  receivingChannel.onmessage = onReceiveMessageCallback;
  receivingChannel.onopen = onreceivingChannelStateChange;
  receivingChannel.onclose = onreceivingChannelStateChange;
}

function gotDescription1(desc) {
  ee284localConnect.setLocalDescription(desc);
  trace('Offer from ee284localConnect \n' + desc.sdp);
  ee284remoteConnect.setRemoteDescription(desc);
  ee284remoteConnect.createAnswer().then(
    gotDescription2,
    onCreateSessionDescriptionError
  );
}


function gotDescription2(desc) {
  ee284remoteConnect.setLocalDescription(desc);
  trace('Answer from ee284remoteConnect \n' + desc.sdp);
  ee284localConnect.setRemoteDescription(desc);
}

function onReceiveMessageCallback(event) {
  trace('Received Message');
  dataChannelReceive.value = event.data;
}



function onreceivingChannelStateChange() {
  var readyState = receivingChannel.readyState;
  trace('Receive channel state is: ' + readyState);
}


function sendData() {
  var data = dataChannelSend.value;
  sendingChannel.send(data);
  trace('Sent Data: ' + data);
}

function closeDataChannels() {
  trace('Closing data channels');
  sendingChannel.close();
  trace('Closed data channel with label: ' + sendingChannel.label);
  receivingChannel.close();
  trace('Closed data channel with label: ' + receivingChannel.label);
  ee284localConnect.close();
  ee284remoteConnect.close();
  ee284localConnect = null;
  ee284remoteConnect = null;
  trace('Closed peer connections');
  startButton1.disabled = false;
  sendButton1.disabled = true;
  closeButton1.disabled = true;
  dataChannelSend.value = '';
  dataChannelReceive.value = '';
  dataChannelSend.disabled = true;
  disableSendButton();
  enableStartButton();
}

function enableStartButton() {
  startButton.disabled = false;
}

function disableSendButton() {
  sendButton.disabled = true;
}













