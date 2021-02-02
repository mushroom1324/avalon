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
const SEC = 3;
const MS = 3000;
const SYSMS = 5000;

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

global.state = 1;
var succ = 0, fail = 0;
var connectCounter = 0;
var players = [];
var playingUsers = [];
var round = 1;  
var voteCounter = 0;
var voteYes = 0;
var voteFailed = 0;
var expLeader = '';
var expLeaderIndex = 0;
var _expPlayers = [];
var expCounter = 0;
var expYes = 0;

function reset() {
  global.state = 1;
  succ = 0, fail = 0;
  players = [];
  playingUsers = [];
  round = 1;  
  voteCounter = 0;
  voteYes = 0;
  voteFailed = 0;
  expLeader = '';
  expLeaderIndex = 0;
  _expPlayers = [];
  expCounter = 0;
  expYes = 0;
  io.emit('reset');
}

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
    playingUsers.push(data.name);
    // 접속된 모든 클라이언트에게 메시지를 전송한다
    io.emit('login', data.name, playingUsers, connectCounter);
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

    io.emit('chat', msg);
  });

  // force client disconnect from server
  socket.on('forceDisconnect', function() {
    socket.disconnect();
  })

  socket.on('disconnect', function() {
    console.log('user disconnected: ' + socket.name);
    connectCounter--;
    console.log(connectCounter);
    playingUsers.splice(playingUsers.indexOf(socket.name),1);
    io.emit('logout', socket.name, playingUsers, connectCounter);
  });

  socket.on('checkUsers', () => {
    if(connectCounter >= 2) {
      io.emit('enableStart');
    }
  });

  //게임로직
  socket.on('start', (roles) => {
    global.state = 0;
    io.emit('gamestart', roles);
  });

  socket.on('assignRoles', (id, roles, userName) => {
    var userData = {
      id,
      userName
    }
    players.push(userData);
    if(players.length == connectCounter) {
      let assignCounter = 0;
      players.forEach(element => {
        roles[assignCounter].id = element.id;
        players[assignCounter].role = roles[assignCounter].name;
        io.to(element.id).emit('assignRolesToClient', roles[assignCounter]);
        assignCounter++;
      });
      
      //직업별 카드 생성
      console.log(players[0].role);
      io.emit('create-role-card', players);

      setTimeout(function() {
        expLeaderIndex = gamelogic.genRandomUser(connectCounter);
        expLeader = players[expLeaderIndex].userName;
        console.log('exp leader is : ' + expLeader);
        io.emit('expedition-selection', expLeader, players, round);
      }, SYSMS);

    }

  });


  socket.on('expedition-leader', (name) => {
    io.emit('expedition-selec-alert', name);
  });

  socket.on("expedition-selection-over", (expPlayers) => {
    expPlayers.forEach(element => {
      _expPlayers.push(element);
    });
    io.emit('expedition-vote', expPlayers);
  });


  socket.on('expedition-vote-result', (result) => {
    io.emit('expedition-vote-card', result);
    console.log('result : ' + result);
    console.log('PrevoteYes : ' + voteYes);
    if(result != 0) {
      voteYes++;
    }
    voteCounter++;

    if(voteCounter == connectCounter) {
      voteCounter = 0; // 초기화
      setTimeout(function() {
        if(voteYes > (connectCounter / 2)) {
          voteYes = 0; // 초기화
          io.emit('expedition-vote-alert', 1);
          setTimeout(() => {
            io.emit('expedition-vote-start-alert');
            _expPlayers.forEach(element => {
              players.forEach(_element => {
                if(_element.userName == element) {
                  io.to(_element.id).emit('expedition');
                }               
              });
            });
          }, SYSMS);
        } else {
          voteYes = 0; // 초기화
          voteCounter = 0; // 초기화
          voteFailed++;
          io.emit('expedition-vote-alert', 0, voteFailed);

          // 투표 5번 실패하면 패배하는 로직
          if(voteFailed >= 5) {
            io.emit('vote-fail-end');
            reset();
          } else if(voteFailed < 5) {
            setTimeout(() => {
              _expPlayers = [];
              expLeaderIndex++;
              if(expLeaderIndex>=connectCounter) {
                expLeaderIndex = 0;
              }
              expLeader = players[expLeaderIndex].userName;
              console.log('exp leader is : ' + expLeader);
              io.emit('expedition-selection', expLeader, players, round);
            }, SYSMS);
          }
        }
      }, SYSMS);
      
    }
    
  })

  socket.on('expedition-exp-result', (result) => {
    expCounter++;
    if(result == 1) {
      expYes++;
    }
    if(expCounter == _expPlayers.length) {
      setTimeout(() => {
        if(expYes == connectCounter) {
          io.emit('expedition-exp-alert', 1, round);
          succ++;

          if(succ == 3) {
            setTimeout(() => {
              io.emit('win');
              reset();
            }, SYSMS);
          }

        } else {
          io.emit('expedition-exp-alert', 0, round);
          fail++;

          if(fail == 3) {
            setTimeout(() => {
              io.emit('fail');
              reset();
            }, SYSMS);
          }

        }

        if(succ != 3 && fail != 3) {
          setTimeout(() => {
            expCounter = 0;
            expYes = 0;
            _expPlayers = [];
            round++;
            expLeaderIndex++;
            if(expLeaderIndex>=connectCounter) {
              expLeaderIndex = 0;
            }
            expLeader = players[expLeaderIndex].userName;
            console.log('exp leader is : ' + expLeader);
            io.emit('expedition-selection', expLeader, players, round);
          }, SYSMS);
        }
      }, SYSMS);
    }

  });

});



server.listen(3000, function() {
  console.log('Socket IO server listening on port 3000');
});

