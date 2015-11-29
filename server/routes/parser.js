module.exports.parse = function(repository) {
    var valid_inline_syntax = ['//'],
        valid_block_start_syntax = ['/*'],
        valid_block_end_syntax = ['*/'],
        files = repository.files,
        parsedRepository = {
        'repository':  repository.repository,
        'files': []
    };

    // TODO: make parser compatible to Hdm's node version
    // TODO: faciliate deletion of block comment end syntax ('*/) by replacing end_index_subtract 

    var push_quests_to_file = function (quests) {
        file.quests = file.quests.concat(quests);
    };

    for (var f = 0; f < files.length; f++) {
        var lines = files[f].content.split("\n"),
            file = {
                'path': files[f].link,
                'quests': []
            };

        for (var l = 1; l < lines.length + 1; l++) {
            var line_content = lines[l-1];

            if (line_content.indexOf(valid_block_start_syntax) > -1) {
                if (line_content.indexOf(valid_block_start_syntax) < line_content.indexOf(valid_inline_syntax)) {    
                    if (line_content.indexOf(valid_block_end_syntax) > -1) {
                        todo_line_parser(file.path, l, line_content, 2, push_quests_to_file);
                    } else {
                        todo_line_parser(file.path, l, lines[l], 0, push_quests_to_file);
                        while (lines[++l].indexOf(valid_block_end_syntax) < 0) {
                            todo_line_parser(file.path, l, lines[l], 0, push_quests_to_file);
                        }
                        todo_line_parser(file.path, l, lines[l], 2, push_quests_to_file);
                    }
                }
            } else if (line_content.indexOf(valid_inline_syntax) > -1) {
                todo_line_parser(file.path, l, line_content, 0, push_quests_to_file);
            }
        }
        if (file.quests.length > 0){
            parsedRepository.files.push(file);
        }
    }
    return parsedRepository;
}

function todo_line_parser(filepath, line_number, line_content, end_index_subtract, callback) {
    var text,
        regex = /todo/gi,
        indices = [],
        quests = [];

    while (result = regex.exec(line_content)) {
        indices.push(result.index);
    }

    for (var i = 0; i < indices.length; i++) {
        if (i == indices.length - 1){
            text = line_content.slice(indices[i] + 4, line_content.length - end_index_subtract).trim();
        } else {
            text = line_content.slice(indices[i] + 4, indices[i+1]-1).trim();
        }
        quests.push({
            'text': text,
            'line': filepath + '#L' + line_number
        });
        console.log(indices);
    }
    if (quests.length > 0) {
        callback(quests);
    }
}