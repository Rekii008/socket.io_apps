var socket = require('socket.io-client').connect('http://localhost:8080');

socket.on('connect', function(){
	console.log('connected to server..');

	socket.on('news', function(data){
		console.log('news event: %j', data);
	});

	socket.emit('my other event', {other:'xxxx'});
});

