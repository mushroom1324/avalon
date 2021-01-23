//users.js in routes/users.js
const express = require('express');
const router = express.Router();
const User = require("../models/user");
const bcrypt = require('bcrypt');
const passport = require('passport');
const {ensureAuthenticated} = require("../config/auth.js");

//login handle
router.get('/login',(req,res)=>{
    res.render('login');
})
router.get('/register',(req,res)=>{
    res.render('register')
    })
//Register handle
router.post('/login',(req,res,next)=>{
    passport.authenticate('local', {
      successRedirect : '/dashboard',
      failureRedirect : '/users/login',
      failureFlash : true,
    })(req,res,next);
  })
  //register post handle
  router.post('/register',(req,res)=>{
    const {name,email, password, password2} = req.body;
    let errors = [];
    console.log(' Name ' + name+ ' email :' + email+ ' pass:' + password);
    if(!name || !email || !password || !password2) {
        errors.push({msg : "공백이 있는 것 같네요."})
    }
    //check if match
    if(password !== password2) {
        errors.push({msg : "비밀번호가 일치하지 않네요."});
    }
    
    //check if password is more than 6 characters
    if(password.length < 6 ) {
        errors.push({msg : '비밀번호를 최소 6자 이상으로 설정해 주세요.'})
    }
    if(errors.length > 0 ) {
    res.render('register', {
        errors : errors,
        name : name,
        email : email,
        password : password,
        password2 : password2})
     } else {
        //validation passed
       User.findOne({email : email}).exec((err,user)=>{
        console.log(user);   
        if(user) {
            errors.push({msg: '이미 있는 이메일이에요.'});
            res.render('register',{errors,name,email,password,password2})  
           } else {
            const newUser = new User({
                name : name,
                email : email,
                password : password
            });
    
            //hash password
            bcrypt.genSalt(10,(err,salt)=> 
            bcrypt.hash(newUser.password,salt,
                (err,hash)=> {
                    if(err) throw err;
                        //save pass to hash
                        newUser.password = hash;
                    //save user
                    newUser.save()
                    .then((value)=>{
                      console.log(value);
                      req.flash('success_msg','회원가입이 완료되었어요!');
                      res.redirect('/users/login');
                    })
                    .catch(value=> console.log(value));
                      
                }));
             }
       })
    }
    })
//logout
router.get('/logout',(req,res)=>{
  req.logout();
  req.flash('success_msg','로그아웃 했어요.');
  res.redirect('/users/login');
 })

 
router.get('/game_menu',ensureAuthenticated, (req,res)=>{
    res.render('game_menu',{
        user: req.user,
        layout: './layoutLogout'
        });
})

router.get('/dashboard',ensureAuthenticated, (req,res)=>{
    res.render('dashboard',{
        user: req.user,
        layout: './layoutLogout'
        });
})

router.get('/lobby',ensureAuthenticated, (req,res)=>{
    res.render('lobby',{
        user: req.user,
        layout: './layoutLogout'
        });
})

router.get('/ingame',ensureAuthenticated, (req,res)=>{
    res.render('ingame',{
        user: req.user,
        layout: ''
        });
})

module.exports  = router;