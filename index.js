// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
const bodyParser = require('body-parser');
var port = process.env.PORT || 3000;

var chatNewId = 0;

var opendChat = {};


app.use(bodyParser.json());

server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

app.post('/', function (req, res) {
  const b = req.body;
  switch (b.do) {
    case "createChat":
      res.send(createChat(b.name, b.public));
      break;
    case "deleteChat":
      res.send(deleteChat(b.id));
      break;
    case "getopenchats":
      res.json(getPublicChats());
      break;
    case "exits":
      res.send(chatExitUsers(b.id));
      break
    default:
      res.sendStatus(404);
      break;
  }
});

function getPublicChats(){
  const a = [];

  for(i in opendChat){
    i = opendChat[i];
    if(i.public){
      const e = Object.assign({}, i);
      e.history = undefined;
      delete e.history;
      a.push(e);
    }
  }

  return a;
}

function chatExitUsers(id){
  const c = opendChat[id];
  if(c != undefined){
    return {exits: true, numUsers: c.numUsers};
  }
  return {exits: false};
}

function createChat(name, public) {
  const mixId = Buffer.from("icode" + Math.round(Math.random() * 1000) + chatNewId).toString('base64');
  opendChat[mixId] = {
    numUsers: 0,
    name: name,
    created: Date.now(),
    id: mixId,
    history: [],
    public: public == true || public == "true"
  }
  chatNewId++;
  return {code: mixId};
}

function deleteChat(id) {
  console.log(opendChat[id]);
  if (opendChat[id] != undefined && (opendChat[id].numUsers == 0 || !opendChat[id].public)) {
    opendChat[id] = undefined;
    delete opendChat[id];
    return true;
  }
  return false;
}



io.on('connection', (socket) => {

  var addedUser = false;

  function myChat() {
    return opendChat[socket.chatId];
  }

  function isChat(i = socket.chatId) {
    return opendChat[i] != undefined;
  }

  function sendChat(type, data, broadcast = false) {
    if (isChat()) {
      if (broadcast)
      socket.broadcast.to(socket.chatId).emit(type, data);
      else
      io.to(socket.chatId).emit(type, data);
    }
  }

  // when the client emits 'new message', this listens and executes

  function addHistory(data){
    const h = myChat().history;
    if(h.length > 100){
      h.shift();
    }
    h.push(data);
  }

  function autoData(){
    return {
      username: socket.username,
      numUsers: myChat().numUsers
    }
  }

  function sendData(type, data){
    if (!isChat()) return;
    if(data == undefined){
      data = autoData();
    }
    data.time = Date.now();
    sendChat(type,data, true);
    data.type = type;
    addHistory(data);
  }

  socket.on('new message', (data) => {
    sendData('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', ({ username, chatId }, fn) => {

    if (addedUser || !isChat(chatId)) return;

    socket.join(chatId);

    socket.broadcast.join(chatId);

    socket.chatId = chatId;

    // we store the username in the socket session for this client
    socket.username = username;
    addedUser = true;

    const numUsers = ++myChat().numUsers;

    sendChat('login', { numUsers: numUsers, lastChat:  autoData().history});
    // echo globally (all clients) that a person has connected

    sendData('user joined');

    fn(myChat().history);
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    sendChat('typing', {
      username: socket.username
    }, true);
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    sendChat('stop typing', {
      username: socket.username
    }, true);
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser && isChat()) {
      --myChat().numUsers;
      // echo globally that this client has left
      sendData('user left');
    }
  });
});
