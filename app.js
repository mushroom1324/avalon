const express = require('express');
const router = express.Router();
const app = express();
const mongoose = require('mongoose');
const expressEjsLayout = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
require("./config/passport")(passport);
const path = require('path');
const { on } = require('./models/user');
const server = require('http').createServer(app);
const gamelogic = require('./public/js/gamelogic');
global.io = require('socket.io')(server);

app.use(express.static(__dirname + '/public'));

//mongoose
mongoose.connect('mongodb://localhost/test',{useNewUrlParser: true, useUnifiedTopology : true})
.then(() => console.log('connected,,'))
.catch((err)=> console.log(err));
//EJS
app.set('view engine','ejs');
app.use(expressEjsLayout);
//BodyParser
app.use(express.urlencoded({extended : false}));

//express session
app.use(session({
    secret : 'secret',
    resave : true,
    saveUninitialized : true
   }));
   app.use(passport.initialize());
   app.use(passport.session());
   //use flash
   app.use(flash());
   app.use((req,res,next)=> {
     res.locals.success_msg = req.flash('success_msg');
     res.locals.error_msg = req.flash('error_msg');
     res.locals.error  = req.flash('error');
   next();
   })

//Routes
app.use('/',require('./routes/index'));
app.use('/users',require('./routes/users'));
var connectCounter = 0;
var assignCounter = 0;
var players = [];
var onlineUsers = [];
var round = 1;

var expLeader = '';

io.on('connection', function(socket) {
  connectCounter++;
  console.log(connectCounter);
  if(connectCounter >= 2 ) {
    io.emit('enableStart');
  }

  // 접속한 클라이언트의 정보가 수신되면
  socket.on('login', function(data) {
    console.log('Client logged-in:\n name:' + data.name + '\n userid: ' + data.userid);

    // socket에 클라이언트 정보를 저장한다
    socket.name = data.name;
    socket.userid = data.userid;
    onlineUsers.push(data.name);
    // 접속된 모든 클라이언트에게 메시지를 전송한다
    io.emit('login', data.name, onlineUsers, connectCounter);
  });

  // 클라이언트로부터의 메시지가 수신되면
  socket.on('chat', function(data) {
    console.log('Message from %s: %s', socket.name, data.msg);

    var msg = {
      from: {
        name: socket.name,
        userid: socket.userid
      },
      msg: data.msg
    };

    // 메시지를 전송한 클라이언트를 제외한 모든 클라이언트에게 메시지를 전송한다
    // socket.broadcast.emit('chat', msg);

    // 메시지를 전송한 클라이언트에게만 메시지를 전송한다
    // socket.emit('s2c chat', msg);

    // 접속된 모든 클라이언트에게 메시지를 전송한다
    io.emit('chat', msg);

    // 특정 클라이언트에게만 메시지를 전송한다
    // io.to(id).emit('s2c chat', data);
  });

  // force client disconnect from server
  socket.on('forceDisconnect', function() {
    socket.disconnect();
  })

  socket.on('disconnect', function() {
    console.log('user disconnected: ' + socket.name);
    connectCounter--;
    console.log(connectCounter);
    onlineUsers.splice(onlineUsers.indexOf(socket.name),1);
    io.emit('logout', socket.name, onlineUsers, connectCounter);
  });

  //게임로직
  socket.on('start', (roles) => {
    io.emit('gamestart', roles);
  });

  socket.on('assignRoles', (id, roles, userName) => {
    var userData = {
      id,
      userName
    }
    players.push(userData);
    if(players.length == connectCounter) {
      players.forEach(function () {
          roles[assignCounter].id = players[assignCounter].id;
          io.to(players[assignCounter].id).emit('assignRolesToClient', roles[assignCounter]);
          console.log(roles[assignCounter]);
          console.log('assign counter: ' + assignCounter);
          assignCounter++;
      });
      setTimeout(function() {
        expLeader = players[gamelogic.genRandomUser(connectCounter)].userName;
        console.log('exp leader is : ' + expLeader);
        io.emit('expedition-selection', expLeader, players, round);
      }, 1000);

    }

  });


  socket.on('expedition-leader', (name) => {
    // TODO : 선택한 원정대원을 받고, 투표를 진행한다.
    io.emit('expedition-vote', name);
    // TODO : 시간제한이 끝나면 무투표 처리된다.
    
  });

  socket.on('expedition-vote-submit', () => {
    // TODO : 투표를 종합하여 결과를 알려준다.
    // TODO : 찬성이 많으면 원정대원들에게 성공 실패 카드를 준다.
    io.to().emit('expedition')
    // TODO : 부결되면 다음 유저가 원정대장이 된다.
  })

  socket.on('expedition-result', () => {
    // TODO : 실패 카드가 하나라도 있으면 실패, 모두 성공하면 성공 처리한다.
    // TODO : 다음 라운드를 진행한다.
    round++;
  });

});



server.listen(3000, function() {
  console.log('Socket IO server listening on port 3000');
});

