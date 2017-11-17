const express = require('express');
const app = express();
const fortune = require('./lib/fortune.js');
const formidable = require('formidable');
// 设置 handlebars 视图引擎
const handlebars = require('express-handlebars').create({
    defaultLayout:'main',
    helpers: {
        section: function(name, options){
            if(!this._sections) this._sections = {};
            this._sections[name] = options.fn(this);
            return null;
        }
    }
});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
// 禁止返回头中的powered-by
app.disable('x-powered-by');
// 设置静态地址
app.use(express.static(__dirname + '/public'));
// 添加中间件
app.use(require('body-parser')());
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
    // 处理post
app.get('/newsletter', function(req, res){
    // 我们会在后面学到 CSRF……目前， 只提供一个虚拟值
    res.render('newsletter', { csrf: 'CSRF token goes here' });
});
app.post('/process', function(req, res){
    if(req.xhr || req.accepts('json,html')==='json'){
        // 如果发生错误， 应该发送 { error: 'error description' }
        res.send({ success: true });
    } else {
        // 如果发生错误， 应该重定向到错误页面
        res.redirect(303, '/thank-you');
    }
});
app.get('/thank-you', function(req,res){
    res.render('thank-you');
});
    // 文件上传
app.get('/contest/vacation-photo',function(req,res){
    var now = new Date();
    res.render('contest/vacation-photo',{
        year: now.getFullYear(),month: now.getMonth()+1
    });
});
app.post('/contest/vacation-photo/:year/:month', function(req, res){
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files){
        if(err) return res.redirect(303, '/error');
        // 数据操作
        console.log('received fields:');
        console.log(fields);
        console.log('received files:');
        console.log(files);
        res.redirect(303, '/thank-you');
    });
});
    // 其他
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
