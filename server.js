const fs = require('fs');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const SSL_PATH = process.env.SSL_PATH;

const server = SSL_PATH ? require('https').createServer({
								cert: fs.readFileSync(SSL_PATH+'/cert.pem'),
								ca: fs.readFileSync(SSL_PATH+'/chain.pem'),
								key: fs.readFileSync(SSL_PATH+'/privkey.pem')
							},app)
						: require('http').createServer(app);
const {Lobby} = require('./scripts/lobby_back.js');

const socketio = require('socket.io');


app.use(express.static(__dirname + "/public/"));

app.get('/admin/*', (req,res)=>{
    res.sendFile(__dirname + '/admin.html');
});

app.get('/', (req,res)=>{
    res.sendFile(__dirname + '/lobby.html');
});

app.get('/game/*', (req,res)=>{
    res.sendFile(__dirname + '/game.html');
});

function startServer(callback=null){
	
}

server.listen(PORT, ()=>{
	console.log(`listening on :${PORT}`);
	const io = socketio(server);
	const lobby = new Lobby(io);
});