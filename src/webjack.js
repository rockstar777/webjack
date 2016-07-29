'use strict';

WebJack.Connection = Class.extend({

  init: function(args) {

    var connection = this;

	var audioCtx = typeof args.audioCtx === 'undefined' ? new AudioContext() : args.audioCtx;
	var firmata = typeof args.firmata === 'undefined' ? false : args.firmata;

	var opts = {
		baud : 1225,
		freqLow : 2450,
		freqHigh : 4900,
		sampleRate : audioCtx.sampleRate,
		firmata : firmata
	};

	var encoder = new WebJack.Encoder(opts);
	var decoder;
    var rxCallback;

	function onAudioProcess(event) {
	  var buffer = event.inputBuffer;
	  var samplesIn = buffer.getChannelData(0);
	  console.log("-- audioprocess data (" + samplesIn.length + " samples) --");

	  if (!decoder){
	  	opts.onReceive = rxCallback;
	  	decoder = new WebJack.Decoder(opts);
	  }
	  decoder.decode(samplesIn);
	}

	function successCallback(stream) {
	  var audioTracks = stream.getAudioTracks();
	  console.log('Using audio device: ' + audioTracks[0].label);
	  console.log("-- samplerate (" + opts.sampleRate + ") --");
	  if (!stream.active) {
	    console.log('Stream not active');
	  }
	  audioSource = audioCtx.createMediaStreamSource(stream);
	  decoderNode = audioCtx.createScriptProcessor(8192, 1, 1); // buffersize, input channels, output channels
	  audioSource.connect(decoderNode);
	  decoderNode.addEventListener("audioprocess", onAudioProcess);
	  decoderNode.connect(audioCtx.destination); // Chrome does not fire events without destination 
	}

	function errorCallback(error) {
	  console.log('navigator.getUserMedia error: ', error);
	}

	navigator = args.navigator || navigator;
	navigator.mediaDevices.getUserMedia(
		{
		  audio: true,
		  video: false
		}
	).then(
	  successCallback,
	  errorCallback
	);


    connection.args = args; // connection.args.baud_rate, etc


    // an object containing two histories -- 
    // sent commands and received commands
    connection.history = {

      // oldest first:
      sent: [],

      // oldest first:
      received: []

    }


    // Sends request for a standard data packet
    connection.get = function(data) {
    	
    }

    var queue = [];
    var locked = false;

    // Sends data to device
    connection.send = function(data) {
    	
    	function playAudioBuffer(buffer) {
			var bufferNode = audioCtx.createBufferSource();
			bufferNode.buffer = buffer;
			bufferNode.connect(audioCtx.destination);
			locked = true;
			bufferNode.start(0);
			bufferNode.onended = function() {
				locked = false;
				if (queue.length)
					playAudioBuffer(queue.shift());
			}
		}


    	var samples = encoder.modulate(data);
    	var dataBuffer = audioCtx.createBuffer(1, samples.length, opts.sampleRate);
    	dataBuffer.copyToChannel(samples, 0);

    	if (locked)
    		queue.push(dataBuffer);
    	else
    		playAudioBuffer(dataBuffer);

		connection.history.sent.push(data);
    }


    // Listens for data packets and runs 
    // passed function listener() on results
    connection.listen = function(listener) {
    	rxCallback = function(data){
			listener(data);
    		connection.history.received.push(data);
    	};
    }    


    // Returns valid JSON object if possible, 
    // or <false> if not.
    connection.validateJSON = function(data) {

    }


  } 

});