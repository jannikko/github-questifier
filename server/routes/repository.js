var express = require('express');
var https = require("https");
var router = express.Router();
var async = require('async');
var url = require('url');
var qs = require('querystring');
var _ = require('underscore');
var config = require('../config');
var parser = require('./parser');

// get supported file extensions from config (only the keys)
var supported_languages = _.keys(config.supported_languages);

var logger = config.logger;
var ApiError = config.ApiError;

// regex to verify url from user input
var gh_url_regex = /^(https:\/\/)?(www.)?github.com\/([\w\d-]+\/[\w\d-._]+)/;

// define endsWith function for ES6 incompatible environments
if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

/* GET users listing. */
/* TODO improve logging, passport authentication*/
router.get('/', function(req, res, next) {
    // set this header to avoid cross-origin problem
    res.setHeader('Access-Control-Allow-Origin', '*');
    // get url parameter
    var github_url = req.query.url;

    logger.info('Got URL "' + github_url + '" from client.');

    // verify url input
    var repo_id = get_repo_id(github_url);
    if (!repo_id) {
        // if the url didnt match the regex end with error
        logger.info('Invalid URL: "' + github_url + '"');
        end_with_error(res, next, new ApiError(400, 'Bad Request', 'Invalid URL'));
        return;
    }
    var filtered_files,
        list_of_files = [],
        repository = {
            'repository': repo_id,
            'files': []
        };
    // execute series of API requests
    async.series([
            function async_request_tree(series_callback) {
                // requests file structure from GITHUB API
                request_tree(repo_id, function(err, result) {
                    if (!err) {
                        var files = result.tree;
                        // filter out files with invalid file extensions
                        filtered_files = files.filter(validate_file);
                        // callback to signal that request is finished
                        series_callback();
                        return;
                    }
                    // callback with err to signal that something went wrong
                    series_callback(err);
                });
            },
            function async_request_content(series_callback) {
                logger.info('Requesting ' + filtered_files.length + ' files from Github API.');
                // request content for each file and create an object with link, content and file extension
                async.map(filtered_files, map_to_content.bind({'repo_id': repo_id}), function(err, results) {
                    if (!err) {
                        // on success map returns an array of the objects
                        repository.files = results;
                        series_callback();
                    }else{
                        logger.warn('A file failed to process: ' + err);
                        series_callback(new ApiError(500, 'Internal Server Error', 'A file failed to process'));
                    }
                });
            }
        ],
        function parse_content(err, results) {
            if (err) {
                end_with_error(res, next, err);
                return;
            } else {
                // parse the content of all files and send them to the user
                var quests = parser.parse(repository);
                res.writeHead(200, {
                    'Content-Type': 'application/json'
                });
                res.end(JSON.stringify(quests));
                next();
            }
        });
});

// returns a substring of the filepath, only containing the file extension
function get_file_extension(filepath){
  return filepath.substr(filepath.lastIndexOf('.')+1);
}

// requests the contents of a file and returns an object with link, content and file extension
function map_to_content(file, callback) {
    var repo_id = this.repo_id;
    request_file(file, function(err, result) {
        if (!err && result.encoding == 'base64') {
            callback(null, {
                'link': 'https://github.com/' + repo_id + '/blob/master/' + file.path,
                'content': new Buffer(result.content, 'base64').toString('utf8'),
                'extension' : get_file_extension(file.path)
            });
        } else {
            callback(err, null);
        }
    });
}

// requests the tree file structure of a GitHub repository
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

// requests the content of a single file
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

// send an ApiError response to the client
function end_with_error(res, next, err) {
    res.writeHead(err.status, {
        'Content-Type': 'application/json'
    });
    res.end(JSON.stringify(err));
    next();
}

// applies the gh_url_regex to the supplied url and extracts "username/repository"
function get_repo_id(gh_url) {
    if (gh_url && gh_url_regex.test(gh_url)) {
        return gh_url_regex.exec(gh_url)[3];
    }
    return null;
}

// filter that checks if the supplied file does have a supported file extension
function validate_file(file) {
    for (var i = supported_languages.length - 1; i >= 0; i--) {
        if (get_file_extension(file.path) == supported_languages[i] && file.type === 'blob') {
            return true;
        }
    }
    return false;
}

// generic function for a GET request to an API
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
                callback(new ApiError(500, 'Internal Server Error','Unable to parse JSON from API'), null);
                return;
            }
            if (resp.statusCode === 200) {
                callback(null, data);
            } else {
                logger.error('Response from API: ' + resp.statusCode + ' - ' + data.message);
                callback(new ApiError(404, 'Not Found', 'Bad response from API'), null);
            }
        });
    });
    request.end();
    request.on('error', function(e) {
        logger.error('Could not connect to API: ' + e);
        callback(new ApiError(503, 'Service Unavailable','Could not connect to API'), null);
    });
}

module.exports = router;
