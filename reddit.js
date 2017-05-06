var request = require('request')
var reddit_creds = require('./secrets/reddit_credentials')
var FeedParser = require('feedparser')
 

// Retrieve OAUTH Token (tokens work for 1 hour each)
// TODO: add retry logic
function getToken(cb) {
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
            cb(err, null)            
        }

        token_info = JSON.parse(body)
        cb(null, token_info.token_type + ' ' + token_info.access_token)
    })
}

/**
 * API DOCS: https://www.reddit.com/dev/api#GET_subreddits_new
 * 
 * endpoint: endpoint listed on reddit api website, ex: /api/v1/me
 * http_method: get/post
 * data: json data to send to the api endpoint 
 * cb(err, response)
 */
// TODO: fix user agent
// TODO: support post requests
// TODO: add retry logic
function makeAPICall(endpoint, http_method, data, cb) {
    getToken(function (err, token) {
        if (err) return cb(err)

        request.get({
            url: "https://oauth.reddit.com/" + endpoint, // API Endpoint
            headers: {
                'Authorization': token,
                'User-Agent': 'a robot'
            }
        }, function(err, res, body) {
            if (!err && res.statusCode == 200) {
                cb(null, body)
            }
        })
    })
}


// main way to subscribe to a subreddit 
// basically a giant event emitter...


/*
config_options = {
    subreddit: string
    comment_threshold: integer


}
*/

// event emitter
// on....
/**
 * newComment
 * newPost
 * 
 * newTopMonth
 * newTop24
 * newTopYear
 * 
 * newHot (with page limits ex: only look at 2 pages)
 * 
 */
var subredditTracker = function(config_options) {

}



// callback will get called every time something is published to the RSS feed
function subscribeRSS(endpoint, cb) {
    // its possible to just call sleep every time we get a post but idk if this is good form 
    var req = request(endpoint)
    var feedparser = new FeedParser();

    req.on('error', function (error) {
        console.log('error')
    // handle any request errors
    });

    req.on('response', function (res) {
    var stream = this; // `this` is `req`, which is a stream

    if (res.statusCode !== 200) {
        this.emit('error', new Error('Bad status code'));
    }
    else {
        stream.pipe(feedparser);
    }
    });

    feedparser.on('error', function (error) {
    // always handle errors
        console.log('error')
    });

    feedparser.on('readable', function () {
    // This is where the action is!
    var stream = this; // `this` is `feedparser`, which is a stream
    var meta = this.meta; // **NOTE** the "meta" is always available in the context of the feedparser instance
    var item;

    while (item = stream.read()) {
        console.log(item.title + '\t\t\t' + item.pubdate);
    }
    });
}



subscribeRSS('https://reddit.com/r/wallstreetbets.rss', function(err, data) {

})