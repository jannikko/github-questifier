var express = require('express');
var https = require("https");
var router = express.Router();
var async = require('async');
var url = require('url');
var config = require('../config');
var querystring = require('querystring');

var valid_filename_extensions = ['.js'];

/* GET users listing. */
router.get('/', function(req, res, next) {
        var repo_id = req.query.owner + '/' + req.query.repo,
        filtered_files,
        list_of_files = {
            'repository': repo_id,
            'files': []
        },
        parameters = {
            recursive: 1,
            client_id: config.gh_clientId,
            client_secret: config.gh_secret
        },
        host = 'api.github.com',
        path = '/repos/' + repo_id + '/git/trees/master';

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
                    host = content_url.host;
                    path = content_url.path;
                    parameters = {
                        client_id: config.gh_clientId,
                        client_secret: config.gh_secret
                    };
                    request_api(host, path, function(contents_obj) {
                        if (contents_obj.encoding == 'base64') {
                            list_of_files.files.push({
                                'path': file.path,
                                'content': new Buffer(contents_obj.content, 'base64').toString('utf8')
                            });
                        }
                        each_callback();
                    }, parameters);
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
            res.end(JSON.stringify(list_of_files));
            next();
        });
});

function is_valid_file(file) {
    for (var i = valid_filename_extensions.length - 1; i >= 0; i--) {
        if (file.path.endsWith(valid_filename_extensions[i]) && file.type == 'blob') {
            return true;
        }
    }
    return false;
}

function request_api(host, path, callback, data) {
    if (data) {
        path += '?' + querystring.stringify(data);
    }
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