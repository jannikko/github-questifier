var express = require('express');
var router = express.Router();
var examplejson = require('../example.json');

router.get('/', function(req, res, next) {
	var files = examplejson.files;
	var parsedFiles = {
       	'files': []
   	};

   	// @todo: register line numbers of parsed comments

	for(var f = files.length - 1; f >= 0; f--) {
		var fileComments = {
    		'path': files[f].path,
    		commentLines: []
    	};
		var lines = files[f].content.split("\n");

		for (var l = 0; l < lines.length; l++) {
			var line = lines[l];
			if (line.indexOf("/*") > -1) {
				if (line.indexOf("*/") > -1) {
					blockComment += line.slice(2, line.length - 2).trim();
				} else {
					blockComment += line.slice(2, line.length).trim();
					while(lines[++l].indexOf("*/") < 0) {
						blockComment += " " + lines[l].slice(0, lines[l].length).trim();
					}
					blockComment += " " + lines[l].slice(0, lines[l].length - 2).trim();
				}
				fileComments.commentLines.push(blockComment);
				blockComment = "";
			} else if(line.indexOf("//") > -1) {
				fileComments.commentLines.push(line.slice(line.indexOf("//") + 2, line.length).trim());
			}
		}
		parsedFiles.files.push(fileComments);
	}
    res.send(parsedFiles);
});

module.exports = router;