const https = require('https')
const express = require('express')
const compression = require('compression')
var cors = require('cors')
const port = process.env.PORT || 8443;
var fs = require('fs');
var privateKey  = fs.readFileSync('./selfsigned.key', 'utf8');
var certificate = fs.readFileSync('./selfsigned.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};

console.log(`==========> ${(new Date()).toISOString()} : STARTING ON PORT ${port}`);

const app = express()
function logger (req, res, next) {
    console.log(`${(new Date()).toISOString()} : REQUEST ${req.url}`);
    next()
}

// your express configuration here
app.use(compression())
app.use(logger)
app.use('/geo',cors(), express.static(__dirname + '/data'));
app.use('/site',express.static(__dirname + '/site'));
app.use('/hello',cors(), (req, res, next) => {
    res.send("<html><body><h1>Hello world !</h1></body></html>")
    res.end()
});


https.createServer(credentials, app).listen(port)
console.log(`==========>  ${(new Date()).toISOString()}: SERVER running!`);
