var Browser = require('zombie'),
    assert = require('chai').assert;
var browser;
suite('Cross-Page Tests', function(){
    setup(function(){
        browser = new Browser();
    });
    // 避免超时
    this.timeout(10000);
    test('requesting a group rate quote from the hood river tour pageshould populate the referrer field',function(done){
        var referer = 'http://localhost:3000/tours/hood-river';
        browser.visit(referer, function(){
            browser.click('.requestGroupRate', function(){
                // browser.resources['0'].request.headers._headers[0][1]获取referer
                assert(browser.resources['0'].request.headers._headers[0][1] === referer);
                done();
            });
        });
    });
    // 页面未完成
    // test('requesting a group rate from the oregon coast tour page should populate the referrer field',function(done){
    //     var referer = 'http://localhost:3000/tours/oregon-coast';
    //     browser.visit(referer, function(){
    //         browser.click('.requestGroupRate', function(){
    //             assert(browser.resources['0'].request.headers._headers[0][1] === referer);
    //             done();
    //         });
    //     });
    // });
    test('visiting the "request group rate" page dirctly should result in an empty referrer field', function(done){
        browser.visit('http://localhost:3000/tours/request-group-rate',
            function(){
                // browser.resources['0'].request.headers._headers[0][0]无referer时是accept
                assert(browser.resources['0'].request.headers._headers[0][0] !== 'referer');
                done();
        });
    });
});