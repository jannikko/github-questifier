var winston = require('winston');

var config = {};

config.supported_languages = {
  "c": "js.js",
  "js": "js.js",
  "cpp": "js.js",
  "h": "js.js"
};


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

config.logger = logger;

function ApiError(status, name, message) {
    this.status = status;
    this.name = name;
    this.message = (message || "");
}
ApiError.prototype = Error.prototype;

config.ApiError = ApiError;


config.gh_clientId = process.env.GH_CLIENT_ID;
config.gh_secret = process.env.GH_SECRET;

if(!config.gh_clientId && !config.gh_secret){
  logger.error("Github API credentials 'GH_CLIENT_ID' and 'GH_SECRET' should be set as environment variables");
}


module.exports = config;
