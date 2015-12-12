var gulp = require('gulp');
var pegjs = require('gulp-peg');
var _ = require('underscore');


gulp.task('compile-grammar', function() {
  return gulp.src('parser/grammar/*.pegjs')
    .pipe(pegjs())
    .pipe(gulp.dest('parser/compiled'));
});

gulp.task('default', ['compile-grammar']);
