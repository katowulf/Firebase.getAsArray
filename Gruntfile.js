/* global module */

module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> Kato\n' +
      '* MIT LICENSE */\n\n',

    concat: {
      app: {
        options: { banner: '<%= banner %>' },
        src: [
          'src/firebase-as-array.js'
        ],
        dest: 'firebase-as-array.js'
      }
    },

    uglify: {
      options: {
        preserveComments: 'some'
      },
      app: {
        files: {
          'firebase-as-array.min.js': ['firebase-as-array.js']
        }
      }
    },

    watch: {
      build: {
        files: ['src/**/*.js', 'Gruntfile.js'],
        tasks: ['make'],
        options: {
          interrupt: true
        }
      },
      test: {
        files: ['src/**/*.js', 'Gruntfile.js', 'test/**'],
        tasks: ['test']
      }
    },

    // Configure a mochaTest task
    mochaTest: {
      test: {
        options: {
          growl: true,
          timeout: 5000,
          reporter: 'spec'
        },
        require: [
          "chai"
        ],
        log: true,
        src: ['test/*.js']
      }
    },

    notify: {
      watch: {
        options: {
          title: 'Grunt Watch',
          message: 'Build Finished'
        }
      }
    }

  });

  require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-notify');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.registerTask('make', ['concat', 'uglify']);
  grunt.registerTask('test', ['make', 'mochaTest']);

  grunt.registerTask('default', ['make', 'test']);
};
