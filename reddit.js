var request = require('request')
var reddit_creds = require('./secrets/reddit_credentials')
var FeedParser = require('feedparser')
 
const UserAgent = "WSBTracker/0.1"

// Retrieve OAUTH Token (tokens work for 1 hour each)
// TODO: add retry logic
function get_token(cb) {
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
            'User-Agent': UserAgent
        }
    }, function(err, res, body) {
        if (err) {
            cb(err, null)            
        }

        token_info = JSON.parse(body)
        cb(null, token_info.token_type + ' ' + token_info.access_token)
    })
}


// assumes the last argument is a callback
function retry_wrapper(numRetries, func) {
    return function()  {
        /*
        var parentCallback = arguments[arguments.length-1];

        var tempArgs = []
        for (var i = 0; i < arguments.length; i++) {

        }
        for (var i = 0; i < numRetries; i++) {

            func.apply(this, arguments)
        }
        */

        func.apply(this, arguments);
    }
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
var _post_api = function(endpoint, data, cb) {
    get_token(function (err, token) {
        if (err) return cb(err)

        request.post({
            url: "https://oauth.reddit.com/" + endpoint, // API Endpoint
            headers: {
                'Authorization': token,
                'User-Agent': UserAgent
            }, 
            form: data
        }, function(err, res, body) {
            if (!err && res.statusCode == 200) {
                cb(null, body)
            } else {
                cb (err)
            }
        })
    })
}

var _get_api = function(endpoint, data, cb) {
    get_token(function (err, token) {
        if (err) return cb(err)

        request.get({
            url: "https://oauth.reddit.com/" + endpoint, // API Endpoint
            headers: {
                'Authorization': token,
                'User-Agent': UserAgent
            },
            qs: data,
        }, function(err, res, body) {
            if (!err && res.statusCode == 200) {
                cb(null, body)
            }
        })
    })
}

var post_api = retry_wrapper(4, _post_api)
var get_api = retry_wrapper(4, _get_api)




function get_comments(subreddit, num_comments, cb) {
    _get_comments(subreddit, num_comments, 0, '', [], cb)
}


// TODO: Wrap recursive function in backoff retries
// TODO: possible change, dont store the comments in a huge array, instead trigger the callback as you go
function _get_comments(subreddit, count_left, count, after, comments, cb) {
    if (count_left <= 0) {
        return cb(null, comments)
    }

    request({
        url: 'http://reddit.com/r/' + subreddit + '/comments.json',
        qs: {
            count: count,
            after: after
        }
    }, 
    function(err, res, body) {
        if (err) return cb(err)
        var body_obj = JSON.parse(body)
        var comments_retrieved = body_obj.data.children
        var comments_retrieved_len = body_obj.data.children.length

        if (comments_retrieved_len <= 0) {
            return cb("No more comments to be retrieved", comments)
        }

        if (comments_retrieved_len > count_left) {
            comments_retrieved = comments_retrieved.slice(0, count_left)
            comments_retrieved_len = count_left
        }

        // recursive call
        _get_comments(
            subreddit, 
            count_left - comments_retrieved_len, 
            count + comments_retrieved_len, 
            body_obj.data.after, 
            comments.concat(comments_retrieved), 
            cb)
        
    })

}


// BASIC COMMENT EMITTER
// ONLY EMITS SINGLE COMMENTS, RUNS FOREVVERRR
function _comment_emitter(subreddit, comment_depth, pause, cb) {
    

}


// TESTS
/*
get_api("user/juicypasta/comments", {type:'links', limit: 1}, function(err, data) {
    //console.log(data)
    console.log(JSON.parse(data).data.children.length) // THIS SHOULD BE 1
})

post_api("api/search_reddit_names", {exact:true, query:'wallstreetbets'}, function(err, data) {
    console.log(data)
    //data.names.should.be("wallstreetbets")
}) 

get_comments('wallstreetbets', 914, function(err, data) {
    console.log(err)
    console.log(data.length) // SHOULD BE 914
})
*/





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


var seenQueue = []

