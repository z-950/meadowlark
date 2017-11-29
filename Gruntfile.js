module.exports = function(grunt) {
    // 加载插件
    [
        'grunt-cafe-mocha',
        'grunt-contrib-jshint',
        'grunt-exec',
        'grunt-contrib-stylus',
    ].forEach(function(task){
        grunt.loadNpmTasks(task);
    });
    // 配置插件
    grunt.initConfig({
        cafemocha: {
            all: { src: 'qa/tests-*.js', options: { ui: 'tdd' }, }
        },
        jshint: {
            app: ['meadowlark.js', 'public/js/**/*.js',
                'lib/**/*.js'],
            qa: ['Gruntfile.js', 'public/qa/**/*.js', 'qa/**/*.js'],
            options : '.jshintrc',
        },
        exec: {
            linkchecker:
            { cmd: 'linkchecker http://localhost:3000' }
        },
        stylus: {
            compile: {
                files: {
                    'public/css/main.css': 'stylus/main.styl',
                }
            }
        },
    });
    // 注册任务
    grunt.registerTask('default', ['cafemocha','jshint','exec','stylus']);
    
};