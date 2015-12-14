var winston = require('winston');

var config = {};

// key: file extension that should be supported
// value: name of the compiled grammar in "./parser/grammar"
config.supported_languages = {
  "c": "js.js",
  "js": "js.js",
  "cpp": "js.js",
  "h": "js.js"
};

var logger = new(winston.Logger)({
    transports: [
      //log to console
        new(winston.transports.Console)({
            'timestamp': true,
            'colorize': true
        }),
        // log to file
        new(winston.transports.File)({
            filename: 'server_log.log'
        })
    ]
});
config.logger = logger;

// custom error that is sent to the client
function ApiError(status, name, message) {
    // check if function was called without 'new' keyword
    var self = this instanceof ApiError ? this : Object.create(ApiError.prototype);
    self.status = status;
    self.name = name;
    self.message = (message || "");
    return self;
}
ApiError.prototype = Error.prototype;
config.ApiError = ApiError;

// API ID and SECRET should to be set as environment variables
// to allow for a larger number of requests to the GitHub API
config.gh_clientId = process.env.GH_CLIENT_ID;
config.gh_secret = process.env.GH_SECRET;

if(!config.gh_clientId && !config.gh_secret){
  logger.warn("Github API credentials 'GH_CLIENT_ID' and 'GH_SECRET' should be set as environment variables");
}

module.exports = config;
