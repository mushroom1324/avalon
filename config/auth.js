module.exports = {
    ensureAuthenticated : function(req,res,next) {
    if(req.isAuthenticated()) {
    return next();
    }
    req.flash('error_msg' , '이용하시기 전에 로그인부터 해주세요.');
    res.redirect('/users/login');
    }
}