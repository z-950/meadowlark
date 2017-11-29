const http = require('http')
const express = require('express');
const fs = require('fs')
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoStore = require('connect-mongo')(session);
const mongoose = require('mongoose');
// 复合表单处理（文件上传）
const formidable = require('formidable');
// 密钥
const credentials = require('./credentials.js');
// 文件数据
const fortune = require('./lib/fortune.js');
const Vacation = require('./models/vacation.js');
const VacationInSeasonListener = require('./models/vacationInSeasonListener.js');
const Attraction = require('./models/attraction.js');
// mongodb（关闭浏览器后浏览器cookie被删除，即客户端session消失，但服务器session依旧储存，超过有效时间才会被删除）
const opts = {
    useMongoClient: true,
    socketTimeoutMS: 0,
    keepAlive: true,
    reconnectTries: 30
};
mongoose.connect(credentials.mongo.development.connectionString, opts);
app.use(session({
    resave: true,
    saveUninitialized: false,
    secret: credentials.cookieSecret,
    store: new mongoStore({
        url:credentials.mongo.development.connectionString,
        ttl: 24 * 60 * 60 // = 1 days. Default，有效时间
    })
}));
// 添加or更新数据
Vacation.find(function(err, vacations){
    if(vacations.length) return;
    new Vacation({
        name: 'Hood River Day Trip',
        slug: 'hood-river-day-trip',
        category: 'Day Trip',
        sku: 'HR199',
        description: 'Spend a day sailing on the Columbia and ' +
        'enjoying craft beers in Hood River!',
        priceInCents: 9995,
        tags: ['day trip', 'hood river', 'sailing', 'windsurfing', 'breweries'],
        inSeason: true,
        maximumGuests: 16,
        available: true,
        packagesSold: 0,
    }).save();
    new Vacation({
        name: 'Oregon Coast Getaway',
        slug: 'oregon-coast-getaway',
        category: 'Weekend Getaway',
        sku: 'OC39',
        description: 'Enjoy the ocean air and quaint coastal towns!',
        priceInCents: 269995,
        tags: ['weekend getaway', 'oregon coast', 'beachcombing'],
        inSeason: false,
        maximumGuests: 8,
        available: true,
        packagesSold: 0,
    }).save();
    new Vacation({
        name: 'Rock Climbing in Bend',
        slug: 'rock-climbing-in-bend',
        category: 'Adventure',
        sku: 'B99',
        description: 'Experience the thrill of climbing in the high desert.',
        priceInCents: 289995,
        tags: ['weekend getaway', 'bend', 'high desert', 'rock climbing'],
        inSeason: true,
        requiresWaiver: true,
        maximumGuests: 4,
        available: false,
        packagesSold: 0,
        notes: 'The tour guide is currently recovering from a skiing accident.',
    }).save();
});
// 发送邮件  ./credentials.js数据不足，关闭以防止报错
// const emailService = require('./lib/email.js')(credentials);
// emailService.send('joecustomer@gmail.com', 'Hood River tours on sale today!','Get \'em while they\'re hot!');
// 设置 handlebars 视图引擎
const handlebars = require('express-handlebars').create({
    defaultLayout:'main',
    helpers: {
        section: function(name, options){
            if(!this._sections) this._sections = {};
            this._sections[name] = options.fn(this);
            return null;
        },
        static: function(name) {
            return require('./lib/static.js').map(name);
        }
    }
});
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
// 设置端口
app.set('port', process.env.PORT || 3000);
// 禁止返回头中的powered-by
app.disable('x-powered-by');
// 集群
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
app.use(bodyParser.json());// for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));// for parsing application/x-www-form-urlencoded
    // 添加cookie相关(内存存储)
app.use(require('cookie-parser')(credentials.cookieSecret));
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
// 跨域资源共享
app.use('/api', require('cors')());
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
app.get('/set-currency/:currency', function(req,res){
    req.session.currency = req.params.currency;
    return res.redirect(303, '/vacations');
});
function convertFromUSD(value, currency){
    switch(currency){
        case 'USD': return value * 1;
        case 'GBP': return value * 0.6;
        case 'BTC': return value * 0.0023707918444761;
        default: return NaN;
    }
}
app.get('/vacations', function(req, res){
    Vacation.find({ available: true }, function(err, vacations){
        var currency = req.session.currency || 'USD';
        var context = {
            currency: currency,
            vacations: vacations.map(function(vacation){
                return {
                    sku: vacation.sku,
                    name: vacation.name,
                    description: vacation.description,
                    qty: vacation.qty,
                    price: convertFromUSD(vacation.priceInCents/100, currency),
                    inSeason: vacation.inSeason,
                }
            })
        };
        switch(currency){
            case 'USD': context.currencyUSD = 'selected'; break;
            case 'GBP': context.currencyGBP = 'selected'; break;
            case 'BTC': context.currencyBTC = 'selected'; break;
        }
        res.render('vacations', context);
    });
})
app.get('/notify-me-when-in-season', function(req, res){
    res.render('notify-me-when-in-season', { sku: req.query.sku });
});
app.post('/notify-me-when-in-season', function(req, res){
    VacationInSeasonListener.update(
        { email: req.body.email },
        { $push: { skus: req.body.sku } },
        { upsert: true },
        function(err){
            if(err) {
                console.error(err.stack);
                req.session.flash = {
                    type: 'danger',
                    intro: 'Ooops!',
                    message: 'There was an error processing your request.',
                };
                return res.redirect(303, '/vacations');
            } 
            req.session.flash = {
                type: 'success',
                intro: 'Thank you!',
                message: 'You will be notified when this vacation is in season.',
            };
            return res.redirect(303, '/vacations');
        }
    );
});
    // 可捕获异常，测试
app.get('/fail', function(req, res){
    throw new Error('Nope!');
});
    // 未捕获异常，测试
app.get('/epic-fail', function(req, res){
    // 等同于setTimeout，但更高效
    process.nextTick(function(){
        throw new Error('Kaboom!');
    });
});
    // 邮件
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
    // 确保存在目录 data
const dataDir = __dirname + '/data';
const vacationPhotoDir = dataDir + '/vacation-photo';
fs.existsSync(dataDir) || fs.mkdirSync(dataDir);
fs.existsSync(vacationPhotoDir) || fs.mkdirSync(vacationPhotoDir);
function saveContestEntry(contestName, email, year, month, photoPath){
    // TODO……这个稍后再做
}
app.post('/contest/vacation-photo/:year/:month', function(req, res){
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files){
        if(err) return res.redirect(303, '/error');
        if(err) {
            res.session.flash = {
                type: 'danger',
                intro: 'Oops!',
                message: 'There was an error processing your submission. ' +
                'Pelase try again.',
            };
            return res.redirect(303, '/contest/vacation-photo');
        }
        const photo = files.photo;
        const dir = vacationPhotoDir + '/' + Date.now();
        const path = dir + '/' + photo.name;
        fs.mkdirSync(dir);
        fs.renameSync(photo.path, dir + '/' + photo.name);
        saveContestEntry('vacation-photo', fields.email,
            req.params.year, req.params.month, path);
        req.session.flash = {
            type: 'success',
            intro: 'Good luck!',
            message: 'You have been entered into the contest.',
        };
        return res.redirect(303, '/contest/vacation-photo/entries');
    });
});
    // REST api
app.get('/api/attractions', function(req, res){
    Attraction.find({ approved: true }, function(err, attractions){
        if(err) return res.send(500, 'Error occurred: database error.');
        res.json(attractions.map(function(a){
            return {
                name: a.name,
                id: a._id,
                description: a.description,
                location: a.location,
            }
        }));
    });
});
app.post('/api/attraction', function(req, res){
    const a = new Attraction({
        name: req.body.name,
        description: req.body.description,
        location: { lat: req.body.lat, lng: req.body.lng },
        history: {
            event: 'created',
            email: req.body.email,
            date: new Date(),
        },
        approved: false,
    });
    a.save(function(err, a){
        if(err) return res.send(500, 'Error occurred: database error.');
        res.json({ id: a._id });
    });
});
app.get('/api/attraction/:id', function(req,res){
    Attraction.findById(req.params.id, function(err, a){
        if(err) return res.send(500, 'Error occurred: database error.');
        res.json({
            name: a.name,
            id: a._id,
            description: a.description,
            location: a.location,
        });
    });
});
    // 自动化渲染视图
let autoViews = {};
app.use(function(req,res,next){
    var path = req.path.toLowerCase();
    // 检查缓存； 如果它在那里， 渲染这个视图
    if(autoViews[path]) return res.render(autoViews[path]);
    // 如果它不在缓存里， 那就看看有没有 .handlebars 文件能匹配
    if(fs.existsSync(__dirname + '/views' + path + '.handlebars')){
        autoViews[path] = path.replace(/^\//, '');
        return res.render(autoViews[path]);
    } 
    // 没发现视图； 转到 404 处理器
    next();
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