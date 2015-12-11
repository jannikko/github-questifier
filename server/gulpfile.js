var gulp = require('gulp');
var pegjs = require('gulp-peg');
var path = require('path');
var fs = require('fs');
var _ = require('underscore');


gulp.task('compile-grammar', function() {
  return gulp.src('parser/grammar/*.pegjs')
    .pipe(pegjs())
    .pipe(gulp.dest('parser/compiled'));
});

gulp.task('create-config', ['compile-grammar'], function() {
  fs.readdir('./parser/compiled/', function(err, data) {
    var files = data.map(function(file) {
      var obj = {};
      obj[path.basename(file, '.js')] = file;
      return obj;
    }).reduce(function(prev, current){
      return _.extend(prev, current);
    });
    fs.writeFile('./parser/config.js', "module.exports.supported_languages = " + JSON.stringify(files) + ";", function(err) {
      if (err) return console.log(err);
    });
  });
});

gulp.task('default', ['compile-grammar', 'create-config']);
