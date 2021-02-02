module.exports = {
    ensureAuthenticated : async function(req,res,next) {
    if(req.isAuthenticated()) {
    return next();
    }
    req.flash('error_msg' , '이용하시기 전에 로그인부터 해주세요.');
    res.redirect('/users/login');
    },

    checkState : async function(req, res, next) {
    console.log('checkState is running : ' + state);
    if(state) {
    return next();
    }
    req.flash('error_msg' , '잘못된 접근입니다.');
    res.redirect('/users/game_menu');
    }
}