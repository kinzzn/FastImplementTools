var express = require('express');
var path = require('path')
var app = express();
const request = require('request');
const querystring = require("querystring");
const serveStatic = require('serve-static');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(
    '/js',
    serveStatic(path.join(__dirname, 'js'))
)

const scopes = ['playlist-read-private', 'playlist-read-collaborative', 'playlist-modify-public', 'playlist-modify-private', 'user-follow-read']

require('dotenv').config();


app.get('/', function (req, res, next) {
    res.render('index', { title: 'Express' });
});

app.get('/home', (req, res) => {
    var code = req.query.code || null;

    if (!code) {
        res.redirect('/login');
        return;
    }

    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
            code: code,
            redirect_uri: process.env.REDIRECT_URL,
            grant_type: 'authorization_code'
        },
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + (new Buffer.from(process.env.SPOTIFY_API_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'))
        },
        json: true
    };

    request.post(authOptions, async function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var token = body.access_token;
            var refreshToken = body.refresh_token;
            res.render('list', { token, refreshToken, month: process.env.MONTH });
        } else {
            console.log(response.statusCode)
            console.log(error)
            res.send(response.statusCode)
        }
    });
})


function generateRandomString(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

app.get('/login', function (req, res) {
    var state = generateRandomString(16);

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: process.env.SPOTIFY_API_ID,
            scope: scopes.join(' '),
            redirect_uri: process.env.REDIRECT_URL,
            state: state
        }));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is listening at http://localhost:${port}`);
});