'use strict';
var express = require('express');
var https = require("https");
var router = express.Router();
var async = require('async');
var url = require('url');
var qs = require('qs');
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

/* GET users listing. */
/* TODO improve logging, refactor, error messages as JSON*/
router.get('/', function(req, res, next) {
    var github_url = req.query.url;

    logger.info('Got URL "' + github_url + '" from client.');

    var repo_id = get_repo_id(github_url);
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
    async.series([
            function async_request_tree(series_callback) {
                request_tree(repo_id, function(err, result) {
                    if (!err) {
                        let files = result.tree;
                        filtered_files = files.filter(validate_file);
                        series_callback();
                        return;
                    }
                    series_callback(err);
                });
            },
            function async_request_content(series_callback) {
                logger.info('Requesting ' + filtered_files.length + ' files from Github API.');
                async.each(filtered_files, function(file, each_callback) {
                    request_file(file, function(err, result) {
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
                        logger.warn('A file failed to process: ' + err);
                        series_callback(new Error('A file failed to process'));
                    }
                    series_callback();
                });
            }
        ],
        function parse_content(err, results) {
            if (err) {
                end_with_error(res, next, err);
                return;
            } else {
                let quests = parser.parse(repository);
                res.writeHead(200, {
                    'Content-Type': 'application/json'
                });
                res.end(JSON.stringify(quests));
                next();
            }
        });
});

function request_tree(repo_id, callback) {
    let parameters = {
            recursive: 1,
            client_id: config.gh_clientId,
            client_secret: config.gh_secret
        },
        host = 'api.github.com',
        path = '/repos/' + repo_id + '/git/trees/master?' + qs.stringify(parameters);

    request_api(host, path, callback);
}

function request_file(file, callback) {
    let content_url = url.parse(file.url);
    let parameters = {
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
    return undefined;
}

function validate_file(file) {
    for (let i = valid_filename_extensions.length - 1; i >= 0; i--) {
        if (file.path.endsWith(valid_filename_extensions[i]) && file.type === 'blob') {
            return true;
        }
    }
    return false;
}

function request_api(host, path, callback) {
    let options = {
        headers: {
            'User-Agent': 'github-questifier'
        },
        host: host,
        path: path
    };
    let request = https.get(options, function(resp) {
        let data = "";
        resp.setEncoding('utf8');
        resp.on('data', function(chunk) {
            data += chunk;
        });
        resp.on('end', function() {
            try {
                data = JSON.parse(data);
            } catch (e) {
                logger.error('Unable to parse JSON from API: ' + e);
                callback(new Error('Incomplete response from API'), undefined);
                return;
            }
            if (resp.statusCode === 200) {
                callback(undefined, data);
            } else {
                logger.error('Response from API: ' + resp.statusCode + ' - ' + data.message);
                callback(new Error('Bad response from API'), undefined);
            }
        });
    });
    request.end();
    request.on('error', function(e) {
        logger.error('Could not connect to API: ' + e);
        callback(new Error('Could not connect to API'), undefined);
    });
}

module.exports = router;