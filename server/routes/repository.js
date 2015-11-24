var express = require('express');
var https = require("https");
var router = express.Router();
var async = require('async');
var url = require('url');
var qs = require('querystring');
var winston = require('winston');
var config = require('../config');
var parser = require('./parser');

var logger = new(winston.Logger)({
    transports: [
        new(winston.transports.Console)({
            'timestamp': true,
            'colorize': true
        }),
        new(winston.transports.File)({
            filename: 'server_log.log'
        })
    ]
});
var valid_hostname = 'github.com';
var valid_filename_extensions = ['.js'];
var gh_url_regex = /^(https:\/\/)?github.com\/([\w\d-]+\/[\w\d-._]+)/;

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

/* GET users listing. */
/* TODO improve logging, refactor, error messages as JSON*/
router.get('/', function(req, res, next) {
    var github_url = req.query.url;

    logger.info('Got URL "' + github_url + '" from client.');

    var repo_id = get_repo_id(github_url);
    if (!repo_id) {
        logger.info('Invalid URL: "' + github_url + '"');
        end_with_error(res, next, new Error('Invalid URL'));
        return;
    }
    var filtered_files,
        list_of_files = [],
        repository = {
            'repository': repo_id,
            'files': []
        };
    async.series([
            function async_request_tree(series_callback) {
                request_tree(repo_id, function(err, result) {
                    if (!err) {
                        var files = result.tree;
                        filtered_files = files.filter(validate_file);
                        series_callback();
                        return;
                    }
                    series_callback(err);
                });
            },
            function async_request_content(series_callback) {
                logger.info('Requesting ' + filtered_files.length + ' files from Github API.');
                async.map(filtered_files, map_to_content.bind({'repo_id': repo_id}), function(err, results) {
                    if (!err) {
                        repository.files = results;
                        series_callback();
                    }else{
                        logger.warn('A file failed to process: ' + err);
                        series_callback(new Error('A file failed to process'));
                    }
                });
            }
        ],
        function parse_content(err, results) {
            if (err) {
                end_with_error(res, next, err);
                return;
            } else {
                var quests = parser.parse(repository);
                res.writeHead(200, {
                    'Content-Type': 'application/json'
                });
                res.end(JSON.stringify(quests));
                next();
            }
        });
});

function map_to_content(file, callback) {
    var repo_id = this.repo_id;
    request_file(file, function(err, result) {
        if (!err && result.encoding == 'base64') {
            callback(null, {
                'link': 'https://github.com/' + repo_id + '/blob/master/' + file.path,
                'content': new Buffer(result.content, 'base64').toString('utf8')
            });
        } else {
            callback(err, null);
        }
    });
}

function request_tree(repo_id, callback) {
    var parameters = {
            recursive: 1,
            client_id: config.gh_clientId,
            client_secret: config.gh_secret
        },
        host = 'api.github.com',
        path = '/repos/' + repo_id + '/git/trees/master?' + qs.stringify(parameters);

    request_api(host, path, callback);
}

function request_file(file, callback) {
    var content_url = url.parse(file.url);
    var parameters = {
            client_id: config.gh_clientId,
            client_secret: config.gh_secret
        },
        host = content_url.host,
        path = content_url.path + '?' + qs.stringify(parameters);
    
    request_api(host, path, callback);
}

function end_with_error(res, next, err) {
    res.writeHead(404, {
        'Content-Type': 'application/json'
    });
    res.end(JSON.stringify({
        message: err.message,
    }));
    next();
}

function get_repo_id(gh_url) {
    if (gh_url && gh_url_regex.test(gh_url)) {
        return gh_url_regex.exec(gh_url)[2];
    }
    return null;
}

function validate_file(file) {
    for (var i = valid_filename_extensions.length - 1; i >= 0; i--) {
        if (file.path.endsWith(valid_filename_extensions[i]) && file.type === 'blob') {
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
            try {
                data = JSON.parse(data);
            } catch (e) {
                logger.error('Unable to parse JSON from API: ' + e);
                callback(new Error('Incompvare response from API'), null);
                return;
            }
            if (resp.statusCode === 200) {
                callback(null, data);
            } else {
                logger.error('Response from API: ' + resp.statusCode + ' - ' + data.message);
                callback(new Error('Bad response from API'), null);
            }
        });
    });
    request.end();
    request.on('error', function(e) {
        logger.error('Could not connect to API: ' + e);
        callback(new Error('Could not connect to API'), null);
    });
}

module.exports = router;