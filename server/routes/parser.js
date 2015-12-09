var parser = require("../parser/parser");

module.exports.parse = function(repository) {

// TODO Support for different languages

  var files = repository.files,
    parsedRepository = {
      'repository': repository.repository,
      'files': []
    };

  files.forEach(function(file) {
    var content = file.content,
      file_obj,
      parsed_content = parser.parse(content);
    if (parsed_content.length > 0) {
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
