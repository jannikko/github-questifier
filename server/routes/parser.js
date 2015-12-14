var _ = require('underscore');
var config = require('../config');

var supported_languages = config.supported_languages;
var logger = config.logger;

// load grammars specified in the config.js file
var parsers = {};
for (var language in supported_languages) {
  // make sure the property was not inherited
  if (supported_languages.hasOwnProperty(language)) {
    try {
      // load the compiled parser files
      parsers[language] = require('../parser/compiled/' + supported_languages[language]);
    } catch (e) {
      logger.warn('Could not find compiled parser specified in configuration for language: ' + language);
    }
  }
}

module.exports.parse = function(repository) {
  // TODO This is just for testing purposes

  // get the fies from the repository object
  var files = repository.files,
    parsedRepository = {
      'repository': repository.repository,
      'files': []
    };

  // iterate over the supplied files (link, content, extension)
  files.forEach(function(file) {
    var content = file.content,
      file_obj, parsed_content;

    // if the file extension is supported, parse the content
    if (file.extension in parsers) {
      parsed_content = parsers[file.extension].parse(content);
    }

    // if the parser found one or more TODOs
    if (parsed_content && parsed_content.length > 0) {
      file_obj = {
        'path': file.link,
        'quests': []
      };

      // iterate over the TODOs
      parsed_content.forEach(function(quest) {
        // append the line to the URL, where the quest was found
        quest.line = file.link + '#L' + quest.line;

        // push the "quest" to the file_obj
        file_obj.quests.push(quest);
      });

      // push the file_obj to the files list
      parsedRepository.files.push(file_obj);
    }
  });

  return parsedRepository;
};
