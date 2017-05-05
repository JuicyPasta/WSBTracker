var request = require('request')
var reddit_creds = require('./secrets/reddit_credentials')
 
// Retrieve OAUTH Token
request.post({
    url:'https://www.reddit.com/api/v1/access_token',
    form:{
        "grant_type": "password",
        "username": reddit_creds.username,
        "password": reddit_creds.password
    },
    auth:{
        'user': reddit_creds.appId,
        'pass': reddit_creds.apiSecret
    },
    headers: {
        'User-Agent': 'a robot'
    }
}, function(err, res, body) {
    if (err) {
        throw err
    }
    body = JSON.parse(body)
    console.log("Retrieved Token: " + body.access_token)

    request.get({
        url: "https://oauth.reddit.com/api/v1/me", // API Endpoint
        headers: {
            'Authorization': body.token_type + ' ' + body.access_token,
            'User-Agent': 'a robot'
        }
    }, function(err, res, body) {
        console.log(body)
    })
})