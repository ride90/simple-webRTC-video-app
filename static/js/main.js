var initiator;
var pc;
var ws = new WebSocket(location.href.replace('http', 'ws').replace('node', 'wbsckt'));
var PeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
var IceCandidate = window.RTCIceCandidate || window.RTCIceCandidate;
var SessionDescription = window.RTCSessionDescription || window.RTCSessionDescription;
navigator.getUserMedia = navigator.getUserMedia || navigator.mediaDevices.getUserMedia || navigator.webkitGetUserMedia;

function socketCallback(event) {
    if (event.data == "magic_overload") {
        alert("Sorry, but this node is overloaded!");
    }
    if (event.data == "owner") {
        initiator = false;
        initialize();
    }
    if (event.data == "guest") {
        initiator = true;
        initialize();
    }
}
// add handler
ws.onmessage = socketCallback;

function initialize() {
    var constraints = {
        audio: false,
        video: true
    };
    navigator.getUserMedia(constraints, success, fail);
}

function success(stream) {
    pc = new PeerConnection(null);

    if (stream) {
        pc.addStream(stream);
        $('#local').attachStream(stream);
    }

    pc.onaddstream = function(event) {
        $('#remote').attachStream(event.stream);
        logStreaming(true);
    };
    pc.onicecandidate = function(event) {
        if (event.candidate) {
            ws.send(JSON.stringify(event.candidate));
        }
    };
    ws.onmessage = function (event) {
        var signal = JSON.parse(event.data);
        if (signal.sdp) {
            if (initiator) {
                receiveAnswer(signal);
            } else {
                receiveOffer(signal);
            }
        } else if (signal.candidate) {
            pc.addIceCandidate(new IceCandidate(signal));
        }
    };

    if (initiator) {
        createOffer();
    } else {
        log('Waiting for guest connection...');
    }
    logStreaming(false);
}

function fail() {
    $('#traceback').text(Array.prototype.join.call(arguments, ' '));
    $('#traceback').attr('class', 'bg-danger');
    console.error.apply(console, arguments);
}

function createOffer() {
    log('Creating offer. Please wait.');
    pc.createOffer(function(offer) {
        log('Success offer');
        pc.setLocalDescription(offer, function() {
            log('Sending to remote...');
            ws.send(JSON.stringify(offer));
        }, fail);
    }, fail);
}

function receiveOffer(offer) {
    log('Received offer.');
    pc.setRemoteDescription(new SessionDescription(offer), function() {
        log('Creating response');
        pc.createAnswer(function(answer) {
            log('Created response');
            pc.setLocalDescription(answer, function() {
                log('Sent response');
                ws.send(JSON.stringify(answer));
            }, fail);
        }, fail);
    }, fail);
}

function receiveAnswer(answer) {
    log('received answer');
    pc.setRemoteDescription(new SessionDescription(answer));
}

function log() {
    $('#traceback').text(Array.prototype.join.call(arguments, ' '));
    console.log.apply(console, arguments);
}

function logStreaming(streaming) {
    $('#streaming').text(streaming ? '[streaming]' : '[..]');
}

jQuery.fn.attachStream = function(stream) {
    this.each(function() {
        this.src = URL.createObjectURL(stream);
        this.play();
    });
};
