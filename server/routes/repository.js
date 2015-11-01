var express = require('express');
var https = require("https");
var router = express.Router();
var atob = require('atob');
var async = require('async');
var url = require('url');

var valid_filename_extensions = ['.js'];

/* GET users listing. */
router.get('/', function(req, res, next) {
    var owner = req.query.owner,
        repo = req.query.repo,
        repo_id = owner + '/' + repo;
    var filtered_files;
    var list_of_files = {
        'repository': repo_id,
        'files': []
    };
    var host = 'api.github.com',
        path = '/repos/' + repo_id + '/git/trees/master?recursive=1';

    async.series([
            function(series_callback) {
                request_api(host, path, function(files_obj) {
                    var files = files_obj.tree;
                    filtered_files = files.filter(is_valid_file);
                    series_callback();
                });
            },

            function(series_callback) {
                async.each(filtered_files, function(file, each_callback) {
                    var content_url = url.parse(file.url);
                    host = content_url.host;
                    path = content_url.path;
                    request_api(host, path, function(contents_obj) {
                        list_of_files.files.push({
                            'path': file.path,
                            'content': atob(contents_obj.content)
                        });
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