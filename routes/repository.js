var express = require('express');
var https = require("https");
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
    var owner = req.query['owner'],
        repo = req.query['repo'];
    var repos;
    var options = {
        headers: {
            'User-Agent': 'github-questifier'
        },
        host: 'api.github.com',
        path: '/repos/' + owner + '/' + repo + '/git/trees/master?recursive=1'
    };
    var request = https.get(options, function(resp) {
        var data = "";
        resp.setEncoding('utf8');
        resp.on('data', function(chunk) {
            data += chunk;
        });
        resp.on('end', function() {
            repos = JSON.parse(data);
            console.log(repos);
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end('Test')
            next();
        });
    });
    request.end();
    request.on('error', function(e) {
        console.log(e);
        next();
    });
});

module.exports = router;