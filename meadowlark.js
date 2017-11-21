const http = require('http')
const express = require('express');
const app = express();
// 复合表单处理（文件上传）
const formidable = require('formidable');
// 密钥
const credentials = require('./credentials.js');
// 文件数据
const fortune = require('./lib/fortune.js');
// 发送邮件  ./credentials.js数据不足，关闭以防止报错
// const emailService = require('./lib/email.js')(credentials);
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
// 发送邮件
// emailService.send('joecustomer@gmail.com', 'Hood River tours on sale today!','Get \'em while they\'re hot!');
// 设置端口
app.set('port', process.env.PORT || 3000);
// 禁止返回头中的powered-by
app.disable('x-powered-by');
app.use(function(req, res, next){
    // 为这个请求创建一个域
    var domain = require('domain').create();
    // 处理这个域中的错误
    domain.on('error', function(err) {
        console.error('DOMAIN ERROR CAUGHT\n', err.stack);
        try {
            // 在 5 秒内进行故障保护关机
            setTimeout(function(){
                console.error('Failsafe shutdown.');
                process.exit(1);
            }, 5000);
            // 从集群中断开
            var worker = require('cluster').worker;
            if(worker) worker.disconnect();
            // 停止接收新请求
            server.close();
            try {
                // 尝试使用 Express 错误路由
                next(err);
            } catch(err) {
                // 如果 Express 错误路由失效， 尝试返回普通文本响应
                console.error('Express error mechanism failed.\n', err.stack);
                res.statusCode = 500;
                res.setHeader('content-type', 'text/plain');
                res.end('Server error.');
            }
        } catch(err){
            console.error('Unable to send 500 response.\n', err.stack);
        }
    });
    // 向域中添加请求和响应对象
    domain.add(req);
    domain.add(res);
    // 执行该域中剩余的请求链
    domain.run(next);
})
// 设置静态地址
app.use(express.static(__dirname + '/public'));
// 添加中间件
app.use(require('body-parser')());
    // 添加cookie相关(内存存储)
app.use(require('cookie-parser')(credentials.cookieSecret));
    // cookie相关？配置内容？
app.use(require('express-session')({
    resave: false,
    saveUninitialized: false,
    secret: credentials.cookieSecret,
}));
    // 测试
app.use(function(req, res, next){
    res.locals.showTests = app.get('env') !== 'production' &&
        req.query.test === '1';
    next();
});
    // flash消息
app.use(function(req, res, next){
    // 如果有即显消息， 把它传到上下文中， 然后清除它
    res.locals.flash = req.session.flash;
    delete req.session.flash;
    next();
});
    // 显示线程工作情况，需要调用next()才有后续响应
// app.use(function(req,res,next){
//     var cluster = require('cluster');
//     if(cluster.isWorker) {
//         console.log('Worker %d received request',cluster.worker.id);
//     }
// });
    // 日志模块
switch(app.get('env')){
    case 'development':
    // 紧凑的、 彩色的开发日志，输出到控制台
        app.use(require('morgan')('dev'));
        break;
    case 'production':
    // 模块 'express-logger' 支持按日志循环
        app.use(require('express-logger')({
            path: __dirname + '/log/requests.log'
        }));
        break;
}
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
app.get('/thank-you', function(req,res){
    res.render('thank-you');
});
app.get('/tours/hood-river', function(req, res){
    res.render('tours/hood-river');
});
app.get('/tours/oregon-coast', function(req, res){
    res.render('tours/oregon-coast');
});
app.get('/tours/request-group-rate', function(req, res){
    res.render('tours/request-group-rate');
});
    // 非未捕获异常
app.get('/fail', function(req, res){
    throw new Error('Nope!');
});
    // 未捕获异常
app.get('/epic-fail', function(req, res){
    process.nextTick(function(){
        throw new Error('Kaboom!');
    });
});
app.get('/newsletter', function(req, res){
    res.render('newsletter');
});
// for now, we're mocking NewsletterSignup:
function NewsletterSignup(){
}
NewsletterSignup.prototype.save = function(cb){
	cb();
};
// 邮箱正则验证
const VALID_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
app.post('/newsletter', function(req, res){
    var name = req.body.name || '', email = req.body.email || '';
    // 输入验证
    if(!email.match(VALID_EMAIL_REGEX)) {
        if(req.xhr) return res.json({ error: 'Invalid name email address.' });
        req.session.flash = {
            type: 'danger',
            intro: 'Validation error!',
            message: 'The email address you entered was not valid.',
        };
        return res.redirect(303, '/newsletter/archive');
    }
    new NewsletterSignup({ name: name, email: email }).save(function(err){
        if(err) {
            if(req.xhr) return res.json({ error: 'Database error.' });
            req.session.flash = {
                type: 'danger',
                intro: 'Database error!',
                message: 'There was a database error; please try again later.',
            }
            return res.redirect(303, '/newsletter/archive');
        }
        if(req.xhr) return res.json({ success: true });
        req.session.flash = {
            type: 'success',
            intro: 'Thank you!',
            message: 'You have now been signed up for the newsletter.',
        };
        return res.redirect(303, '/newsletter/archive');
    });
});
app.get('/newsletter/archive', function(req, res){
	res.render('newsletter/archive');
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

function startServer() {
    http.createServer(app).listen(app.get('port'), function(){
        console.log( 'Express started in ' + app.get('env') +
        ' mode on http://localhost:' + app.get('port') +
        '; press Ctrl-C to terminate.' );
    });
}
if(require.main === module){
    // 应用程序直接运行； 启动应用服务器
    startServer();
} else {
    // 应用程序作为一个模块通过 "require" 引入 : 导出函数
    // 创建服务器
    module.exports = startServer;
}