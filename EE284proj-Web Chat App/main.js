(function(){
    var PHONE = window.PHONE = function(config) {  
    var pubnub        = PUBNUB(config);
    var pubkey        = config.publish_key;   
    var subkey        = config.subscribe_key;
    var sessionid     = PUBNUB.uuid();
    var mystream      = null;
    var myvideo       = document.createElement('video');
    var myconnection  = false;
    var conversations = {};
    var oneway        = config.oneway
    var broadcast     = config.broadcast ;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // STUN Server List Configuration (public STUN list)
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var rtcconfig = { 
	    
	    iceServers : [{ url: "stun:stun.l.google.com:19302"}] 
	    };

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    //  Events occuring in PHONE
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    var messagecb    = function(){};
    var readycb      = function(){};
    var unablecb     = function(){};
    var debugcb      = function(){};
    var connectcb    = function(){};
    var disconnectcb = function(){};
    var reconnectcb  = function(){};
    var callstatuscb = function(){};
    var receivercb   = function(){};
    

    PHONE.message    = function(cb) { messagecb    = cb };
    PHONE.ready      = function(cb) { readycb      = cb };
    PHONE.unable     = function(cb) { unablecb     = cb };
    PHONE.callstatus = function(cb) { callstatuscb = cb };
    PHONE.debug      = function(cb) { debugcb      = cb };
    PHONE.connect    = function(cb) { connectcb    = cb };
    PHONE.disconnect = function(cb) { disconnectcb = cb };
    PHONE.reconnect  = function(cb) { reconnectcb  = cb };
    PHONE.receive    = function(cb) { receivercb   = cb };
    

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // To Add or Get Conversation we creates a new PC or we return the existing PC
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function get_conversation(number, isAnswer) {
        var talk = conversations[number] || (function(number){
            var talk = {
                number  : number,     
                pc      : new RTCPeerConnection(rtcconfig),
                closed  : false,
                connect : function(){},
                end     : function(){}
            };

            // Setting up the Event Methods
            talk.pc.onaddstream    = onaddstream;
            talk.pc.onicecandidate = onicecandidate;
            talk.pc.number         = number;
                   
            // To Send Messages
            talk.send = function(message) {
                transmit( number, { usermsg : message } );
            };
            
            talk.ended     = function(cb) {talk.end     = cb; return talk};
            talk.connected = function(cb) {talk.connect = cb; return talk};
            talk.message   = function(cb) {talk.usermsg = cb; return talk};
          
            if (!isAnswer || !oneway) talk.pc.addStream(mystream);   

            
            conversations[number] = talk;
            return talk;
        })(number);

        
        return talk;
    }

   
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // To get the Phone Number
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    PHONE.number = function() {
        return config.number;
    };

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // To create a new PeerConnection(making a call)
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    PHONE.dial = function(number) {
        
        var talk = get_conversation(number);
        var pc   = talk.pc;

        // Sending call SDP Offer
        pc.createOffer( function(offer) {
            transmit( number, { hangup : true } );
            transmit( number, offer, 2 );
            pc.setLocalDescription( offer, debugcb, debugcb );
        }, debugcb );

        // To return the session reference
        return talk;
    };

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // To expose pubnub object and local stream
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    PHONE.mystream = mystream;
    PHONE.pubnub   = pubnub;
    PHONE.oneway   = oneway;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // To display a stream (video)
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function display_stream(stream) {
        var video   = myvideo;
        video.src    = URL.createObjectURL(stream);
        video.volume = 0.0;
        video.play();
        PHONE.video = video;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // To add the stream
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function onaddstream(obj) {
        var vid    = document.createElement('video');
        var stream = obj.stream;
        var number = (obj.srcElement || obj.target).number;
        var talk   = get_conversation(number);

        vid.setAttribute( 'autoplay', 'autoplay' );
        vid.setAttribute( 'data-number', number );
        vid.src = URL.createObjectURL(stream);

        talk.video = vid;
        talk.connect(talk);
    }
    
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // To discover the On ICE Route Candidate
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function onicecandidate(event) {
        if (!event.candidate) return;
        transmit( this.number, event.candidate );
    };

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Listening to New Incoming Calls
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function subscribe() {
	    console.log("Subscribed to " + config.number);
        pubnub.subscribe({
            restore    : true,
            channel    : config.number,
            message    : receive,
            disconnect : disconnectcb,
            reconnect  : reconnectcb,
            connect    : function() { onready(true) }
        });
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Being Ready to Receive Calls
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function onready() {
        myconnection = true;
        connectcb();
        readycb();
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Preparing the local Media Camera and Mic for the call
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function getusermedia() { 
        
        navigator.getUserMedia( { audio : true, video : true }, function(stream) {
            if (!stream) return unablecb(stream);
            mystream = stream;
            phone.mystream = stream;
            display_stream(stream);
            onready();
            subscribe();
        }, function(info) {
            debugcb(info);
            return unablecb(info);
        } );
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // To send SDP Call Offers/Answers and ICE Candidates to Peer
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function transmit( phone, packet, times, time ) {
        if (!packet) return;
        var number  = config.number;
        var message = { packet : packet, id : sessionid, number : number };
        debugcb(message);
        pubnub.publish({ channel : phone, message : message });

        // Recurse if Requested for
        if (!times) return;
        time = time || 1;
        if (time++ >= times) return;
        setTimeout( function(){
            transmit( phone, packet, times, time );
        }, 150 );
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Processing of SDP Offers & ICE Candidates
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function receive(message) {
        //  To Watch the Debugging of Callback of Data
        debugcb(message);

        // Getting Call Reference
        var talk = get_conversation(message.number, true);
        
        // Ignore if Closed
        if (talk.closed) return;

        // User Message
        if (message.packet.usermsg) {
            messagecb( talk, message.packet.usermsg );
            return talk.usermsg( talk, message.packet.usermsg );
        }

       
        // To determine stream + receive here, If Peer Calling Inbound (Incoming) 
        if ( message.packet.sdp && !talk.received ) {
            talk.received = true;
            receivercb(talk);
        }

        // Updating Peer Connection with SDP Offer or ICE Routes
        if (message.packet.sdp) add_sdp_offer(message);
        else                    add_ice_route(message);
    }


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Adding SDP Offer/Answers
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function add_sdp_offer(message) {
        // Getting the Call Reference
        var talk = get_conversation(message.number, message.packet.type=='answer');
        var pc   = talk.pc;
        var type = message.packet.type == 'offer' ? 'offer' : 'answer';

        // Deduplicating the SDP Offerings/Answers
        if (type in talk) return;
        talk[type]  = true;
        talk.dialed = true;

       
        // Addding SDP Offer/Answer
        pc.setRemoteDescription(
            new RTCSessionDescription(message.packet), function() {
             
                // Calling Online and being Ready
                if (pc.remoteDescription.type != 'offer') return;

                // Creating Answer to Call
                pc.createAnswer( function(answer) {
                    pc.setLocalDescription( answer, debugcb, debugcb );
                    transmit( message.number, answer, 2 );
                }, debugcb );
            }, debugcb
        );
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Adding ICE Candidate Routes
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function add_ice_route(message) {
        //  if Non-good ICE Packet then Leave
        if (!message.packet)           return;
        if (!message.packet.candidate) return;

        // Getting Call Reference
        var talk = get_conversation(message.number);
        var pc   = talk.pc;

        // Adding ICE Candidate Routes
        pc.addIceCandidate(
            new RTCIceCandidate(message.packet),
            debugcb,
            debugcb
        );
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Main - Requesting Camera and Mic
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    getusermedia()

    return PHONE;
};
})();