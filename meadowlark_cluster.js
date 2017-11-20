var cluster = require('cluster');
function startWorker() {
    var worker = cluster.fork();
    console.log('CLUSTER: Worker %d started', worker.id);
}
if(cluster.isMaster){
    require('os').cpus().forEach(function(){
        startWorker();
    });
    // 记录所有断开的工作线程。 如果工作线程断开了， 它应该退出
    // 因此我们可以等待 exit 事件然后繁衍一个新工作线程来代替它
    cluster.on('disconnect', function(worker){
        console.log('CLUSTER: Worker %d disconnected from the cluster.',
        worker.id);
    });
    // 当有工作线程死掉（退出） 时， 创建一个工作线程代替它
    cluster.on('exit', function(worker, code, signal){
        console.log('CLUSTER: Worker %d died with exit code %d (%s)',
        worker.id, code, signal);
        startWorker();
    });
} else {
    // 在这个工作线程上启动我们的应用服务器， 参见 meadowlark.js
    require('./meadowlark.js')();
}