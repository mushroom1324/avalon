module.exports  = {
    genRandomUser : function (req) {
        let x = 0;
        x = Math.floor(Math.random() * req);
        console.log('random variable is ' + x);
        return x;
    },

}