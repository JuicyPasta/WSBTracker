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
        /* var parentCallback = arguments[arguments.length-1];
        var tempArgs = []
        for (var i = 0; i < arguments.length; i++) {
        }
        for (var i = 0; i < numRetries; i++) {
            func.apply(this, arguments)
        } */

        func.apply(this, arguments);
    }
}


/**
 * API DOCS: https://www.reddit.com/dev/api#GET_subreddits_new
 * 
 * endpoint: endpoint listed on reddit api website, ex: /api/v1/me
 * data: json data to send to the api endpoint 
 * cb(err, response)
 */
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
    _get_comments(subreddit, num_comments, 0, null, null, '', [], cb)
}

function get_comments_until_id(subreddit, num_comments, target_id, cb) {
    _get_comments(subreddit, num_comments, 0, target_id, null, '', [], cb)
}

// posted_after is epoch time in seconds
function get_comments_after_time(subreddit, num_comments, posted_after, cb) {
    _get_comments(subreddit, num_comments, 0, null, posted_after, '', [], cb)
}


// TODO: Wrap recursive function in backoff retries
function _get_comments(subreddit, count_left, count, target_id, posted_after, next_page_id, comments, cb) {
    if (count_left <= 0 && !target_id) {
        return cb(null, comments)
    } else if (count_left <= 0 && target_id) {
        return cb("Target comment name not found", comments)
    }

    request({
        url: 'http://reddit.com/r/' + subreddit + '/comments.json',
        qs: { count: count, after: next_page_id }
    }, 
    function(err, res, body_json) {
        if (err) return cb(err)

        var body_obj = JSON.parse(body_json)
        var comments_retrieved = body_obj.data.children
        var comments_retrieved_len = body_obj.data.children.length

        if (comments_retrieved_len <= 0) {
            return cb("Reached a page with no comments", comments)
        }

        if (comments_retrieved_len > count_left) {
            comments_retrieved_len = count_left
            comments_retrieved = comments_retrieved.slice(0, comments_retrieved_len)
        }

        // handles posted_after - only show posts that were posted after a specific time
        if (posted_after) {
            for (var i = 0; i < comments_retrieved_len; i++) {
                if (comments_retrieved[i].data.created_utc <= posted_after) {
                    // we only care about the comments before and we are done looking
                    comments_retrieved_len = i; 
                    comments_retrieved = comments_retrieved.slice(0, comments_retrieved_len)

                    // done searching but we want to handle the target_id case
                    count_left = -1;
                }
            }
        }

        // handles target_id - stops when we reach a specific comment
        if (target_id) {
            for (var i = 0; i < comments_retrieved_len; i++) {
                // found the comment we are looking up to
                if (comments_retrieved[i].data.id == target_id) {
                    // we only care about the comments before and we are done looking
                    comments_retrieved_len = i; 
                    comments_retrieved = comments_retrieved.slice(0, comments_retrieved_len)
                    return cb(null, comments.concat(comments_retrieved))
                }
            }
        }
 
        // recursive call
        _get_comments(
            subreddit, 
            count_left - comments_retrieved_len, 
            count + comments_retrieved_len, 
            target_id,
            posted_after,
            body_obj.data.after, 
            comments.concat(comments_retrieved), 
            cb)
    })
}


// BASIC COMMENT EMITTER
// ONLY EMITS SINGLE COMMENTS, RUNS FOREVVERRR


// adjust comment_dept and wait_interval to match what your hardware is capable of, 
// having a really low wait interval and high comment depth will not cause additional strain if you can handle the amount of comments a subreddit is producing
function comment_emitter(subreddit, comment_depth, wait_interval, seconds_back, cb) {
    var start_time = Date.now() / 1000 - seconds_back
    var most_recent_id_queue = [true]
    
    let interval = setInterval(() => {
        _get_comments(subreddit, comment_depth, 0, most_recent_comment_id, start_time, '', [], function(err, comments) {
            if (comments.length > 0) {
                most_recent_comment_id = comments[0].data.id
            }

            comments.map(function(comment) {
                cb(null, comment)
            })

        })
    }, wait_interval)
}

function default_comment_emitter(subreddit, cb) {
    comment_emitter(subreddit, 1000, 1000, 0, cb)
}

comment_emitter("all", 1000, 10, 0, function(err, comment) {
    console.log(comment.data.id)
})

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
    //console.log(err)
    //console.log(data.length) // SHOULD BE 914
})

get_comments_after_time("wallstreetbets", 1000, Date.now()/1000 - 100, function(err, comments) {
    console.log(err)
    console.log(comments.length)
    comments.map(function(data) {
        console.log(data.data.id)
    })
})

get_comments_until_id("wallstreetbets", 1000, "dh7vz0r", function(err, comments) {
    console.log(err)
    console.log(comments.length)
    comments.map(function(data) {
        console.log(data.data.id)
    })
})

*/



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