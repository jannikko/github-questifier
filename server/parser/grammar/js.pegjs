{
var comments = [];
function save(data){
  comments.push({'text':data,'line': location().start.line});
}
}

start
  =  unit* {return comments;}

unit
  =  string
  /  multi_line_comment
  /  single_line_comment
  /  any_char

multi_line_comment
  =  "/*" spaces? todo c:[^*/]* "*/"
     {save(c.join("").replace(/\s+/g, ' ').trim())}


single_line_comment
  =  "//"spaces? todo s:[^\r\n]*
  {save(s.join("").trim())}

todo
= "@"?"TODO"":"?

identifier
  =  a:([a-z] / [A-Z] / "_") b:([a-z] / [A-Z] / [0-9] /"_")* {return a + b.join("");}

spaces
  =  [ \t\r\n]+ {return "";}

string
  =  "\"" ("\\" . / [^"])* "\""
  /  "'" ("\\" . / [^'])* "'"

any_char
  =  .
