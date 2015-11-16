var express = require('express');
var https = require("https");
var router = express.Router();
var async = require('async');
var url = require('url');
var qs = require('qs');
var config = require('../config');
var parser = require('./parser');

var valid_hostname = 'github.com';
var valid_filename_extensions = ['.js'];
var gh_url_regex = /^\/[\w\d-]+\/[\w\d-.]+$/;

/* GET users listing. */
router.get('/', function(req, res, next) {
    'use strict';
    var github_url = req.query.url;
    var repo_id;
    if (github_url) {
        validate_url(github_url, function(path) {
            repo_id = path;
        });
    }
    if (!repo_id) {
        end_with_error(res, next, new Error('Invalid URL'));
        return;
    }
    var filtered_files,
        list_of_files = [],
        repository = {
            'repository': repo_id,
            'files': []
        };
    let parameters = {
            recursive: 1,
            client_id: config.gh_clientId,
            client_secret: config.gh_secret
        },
        host = 'api.github.com',
        path = '/repos/' + repo_id + '/git/trees/master?' + qs.stringify(parameters);

    async.series([
            function(series_callback) {
                request_api(host, path, function(err, result) {
                    if (!err) {
                        let files = result.tree;
                        filtered_files = files.filter(validate_file);
                        series_callback();
                        return;
                    }
                    series_callback(err);
                });
            },

            function(series_callback) {
                async.each(filtered_files, function(file, each_callback) {
                    
                    let content_url = url.parse(file.url);
                    let parameters = {
                        client_id: config.gh_clientId,
                        client_secret: config.gh_secret
                    },
                    host = content_url.host,
                    path = content_url.path + '?' + qs.stringify(parameters);

                    request_api(host, path, function(err, result) {
                        if (!err && result.encoding == 'base64') {
                            repository.files.push({
                                'link': 'https://github.com/' + repo_id + '/blob/master/' + file.path,
                                'content': new Buffer(result.content, 'base64').toString('utf8')
                            });
                        }
                        each_callback();
                    });
                }, function(err) {
                    if (err) {
                        console.log('A file failed to process');
                        series_callback(new Error('A file failed to process'));
                    }
                    series_callback();
                });
            }
        ],
        function(err, results) {
            if (err) {
                end_with_error(res, next, err);
                return;
            } else {
                res.writeHead(200, {
                    'Content-Type': 'application/json'
                });
                let quests = parser.parse(repository);
                res.end(JSON.stringify(quests));
                next();
            }
        });
});

function end_with_error(res, next, err) {
    res.writeHead(404, {
        'Content-Type': 'application/json'
    });
    res.end(JSON.stringify({
        message: err.message,
    }));
    next();
}

function validate_url(gh_url, callback) {
    gh_url = url.parse(gh_url);
    if (gh_url.hostname === valid_hostname && gh_url.path) {
        if (gh_url_regex.test(gh_url.path)) {
            callback(gh_url.path.slice(1, gh_url.path.length));
        }
    }
}

function validate_file(file) {
    'use strict';
    for (let i = valid_filename_extensions.length - 1; i >= 0; i--) {
        if (file.path.endsWith(valid_filename_extensions[i]) && file.type == 'blob') {
            return true;
        }
    }
    return false;
}

function request_api(host, path, callback) {
    'use strict';
    let options = {
        headers: {
            'User-Agent': 'github-questifier'
        },
        host: host,
        path: path
    };
    let request = https.get(options, function(resp) {
        if (resp.statusCode !== 200) {
            //log error here
            callback(new Error('Bad response from API'), undefined);
        } else {
            let data = "";
            resp.setEncoding('utf8');
            resp.on('data', function(chunk) {
                data += chunk;
            });
            resp.on('end', function() {
                try {
                    callback(undefined, JSON.parse(data));
                } catch (e) {
                    //log error here
                    callback(new Error('Incomplete response from API'), undefined);
                }
            });
        }
    });
    request.end();
    request.on('error', function(e) {
        //log error here
        callback(new Error('Could not connect to API'), undefined);
        console.log(e);
    });
}

module.exports = router;