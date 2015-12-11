var _ = require('underscore');
var config = require('../config');
var parser_config = require('../parser/config');

var logger = config.logger;
var supported_languages = parser_config.supported_languages;

var parsers = {};

for (var language in supported_languages) {
  if (supported_languages.hasOwnProperty(language)) {
    try {
      parsers[language] = require('../parser/compiled/' + supported_languages[language]);
    } catch (e) {
      logger.warn('Could not find compiled parser specified in configuration for language: ' + language);
    }
  }
}

module.exports.parse = function(repository) {

  // TODO This is just for testing purposes

  var files = repository.files,
    parsedRepository = {
      'repository': repository.repository,
      'files': []
    };

  files.forEach(function(file) {
    var content = file.content,
      file_obj, parsed_content;

    if (file.extension in parsers) {
      parsed_content = parsers[file.extension].parse(content);
    }

    if (parsed_content && parsed_content.length > 0) {
      file_obj = {
        'path': file.link,
        'quests': []
      };
      parsed_content.forEach(function(quest) {
        quest.line = file.link + '#L' + quest.line;
        file_obj.quests.push(quest);
      });
      parsedRepository.files.push(file_obj);
    }
  });
  return parsedRepository;
};
