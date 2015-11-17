module.exports.parse = function(repository) {
    var valid_inline_syntax = ['//'],
        valid_block_start_syntax = ['/*'],
        valid_block_end_syntax = ['*/'],
        files = repository.files,
        parsedRepository = {
        'repository':  repository.repository,
        'files': []
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
                if (line_content.indexOf(valid_block_end_syntax) > -1) {
                    todo_line_parser(l, line_content, 2, 2);
                } else {
                    todo_line_parser(l, lines[l], 2, 0);
                    while (lines[++l].indexOf(valid_block_end_syntax) < 0) {
                        todo_line_parser(l, lines[l], 0, 0);
                    }
                    todo_line_parser(l, lines[l], 0, 2);
                }
            } else if (line_content.indexOf(valid_inline_syntax) > -1) {
                todo_line_parser(l, line_content, 2, 0);
            }
        }
        parsedRepository.files.push(file);
    }
    return parsedRepository;

    function todo_line_parser(line_number, line_content, start_index_addend, end_index_subtract) {
        var text,
            regex = /@todo/gi,
            indices = [];

        while (result = regex.exec(line_content)) {
            indices.push(result.index);
        }

        for (var i = 0; i < indices.length; i++) {
            if (i == indices.length - 1){
                text = line_content.slice(indices[i] + 5 + start_index_addend, line_content.length - end_index_subtract).trim();
            } else {
                text = line_content.slice(indices[i] + 5 + start_index_addend, indices[i+1]-1).trim();
                console.log("else");
            }
            file.quests.push({
                'text': text,
                'line': file.path + '#L' + line_number
            });
        }
    }
}