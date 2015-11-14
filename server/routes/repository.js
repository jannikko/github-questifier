var express = require('express');
var https = require("https");
var router = express.Router();
var async = require('async');
var url = require('url');
var qs = require('qs');
var config = require('../config');
var parser = require('./parser');

var valid_hostname = 'github.com'
var valid_filename_extensions = ['.js'];
var gh_url_regex = /^\/[\w\d]+\/[\w\d]+$/;

/* GET users listing. */
router.get('/', function(req, res, next) {
    var github_url = req.query.url;
    var repo_id;
    if (github_url) {
        validate_url(github_url, function(path) {
            repo_id = path;
        });
    }
    if (!repo_id) {
        res.end('Not a valid url');
        next();
        return;
    }
    var filtered_files,
        list_of_files = [],
        repository = {
            'repository': repo_id,
            'files': []
        };

    var parameters = {
            recursive: 1,
            client_id: config.gh_clientId,
            client_secret: config.gh_secret
        },
        host = 'api.github.com',
        path = '/repos/' + repo_id + '/git/trees/master?' + qs.stringify(parameters);

    async.series([
            function(series_callback) {
                request_api(host, path, function(files_obj) {
                    var files = files_obj.tree;
                    filtered_files = files.filter(is_valid_file);
                    series_callback();
                }, parameters);
            },

            function(series_callback) {
                async.each(filtered_files, function(file, each_callback) {
                    var content_url = url.parse(file.url);
                    parameters = {
                        client_id: config.gh_clientId,
                        client_secret: config.gh_secret
                    };

                    host = content_url.host;
                    path = content_url.path + '?' + qs.stringify(parameters);

                    request_api(host, path, function(contents_obj) {
                        if (contents_obj.encoding == 'base64') {
                            repository.files.push({
                                'link': 'https://github.com/' + repo_id + '/blob/master/' + file.path,
                                'content': new Buffer(contents_obj.content, 'base64').toString('utf8')
                            });
                        }
                        each_callback();
                    });
                }, function(err) {
                    if (err) {
                        console.log('A file failed to process');
                    }
                    series_callback();
                });
            }
        ],
        function(err, results) {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            var quests = parser.parse(repository);
            res.end(JSON.stringify(quests));
            next();
        });
});

function validate_url(gh_url, callback) {
    gh_url = url.parse(gh_url);
    if (gh_url.hostname === valid_hostname && gh_url.path) {
        if (gh_url_regex.test(gh_url.path)) {
            callback(gh_url.path.slice(1, gh_url.path.length));
        }
    }
}

function is_valid_file(file) {
    for (var i = valid_filename_extensions.length - 1; i >= 0; i--) {
        if (file.path.endsWith(valid_filename_extensions[i]) && file.type == 'blob') {
            return true;
        }
    }
    return false;
}

function request_api(host, path, callback) {
    var options = {
        headers: {
            'User-Agent': 'github-questifier'
        },
        host: host,
        path: path
    };
    var request = https.get(options, function(resp) {
        var data = "";
        resp.setEncoding('utf8');
        resp.on('data', function(chunk) {
            data += chunk;
        });
        resp.on('end', function() {
            callback(JSON.parse(data));
        });
    });
    request.end();
    request.on('error', function(e) {
        console.log(e);
    });
}

module.exports = router;