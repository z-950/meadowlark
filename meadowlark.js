const express = require('express');
const app = express();
const fortune = require('./lib/fortune.js');
// 设置 handlebars 视图引擎
const handlebars = require('express-handlebars')
    .create({ defaultLayout:'main' });
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
// 禁止返回头中的powered-by
app.disable('x-powered-by');
// 设置静态地址
app.use(express.static(__dirname + '/public'));
// 设置端口
app.set('port', process.env.PORT || 3000);
// 测试
app.use(function(req, res, next){
    res.locals.showTests = app.get('env') !== 'production' &&
        req.query.test === '1';
    next();
});
// 路由
app.get('/', function(req, res) {
    res.render('home');
});
app.get('/about', function(req, res){
    res.render('about', {
        fortune: fortune.getFortune(),
        pageTestScript: '/qa/tests-about.js'
    });
});
app.get('/tours/hood-river', function(req, res){
    res.render('tours/hood-river');
});
app.get('/tours/request-group-rate', function(req, res){
    res.render('tours/request-group-rate');
});
// 404 catch-all 处理器（中间件）
app.use(function(req, res, next){
    res.status(404);
    res.render('404');
});
// 500 错误处理器（中间件）
app.use(function(err, req, res, next){
    console.error(err.stack);
    res.status(500);
    res.render('500');
});

app.listen(app.get('port'), function(){
    console.log( 'Express started on http://localhost:' + app.get('port') + '; press Ctrl-C to terminate.' );
});
