const log4js = require('log4js')
const config = require('./config');

// log4js.configure({
//     replaceConsole: false,
//     appenders: {
//         stdout: {//控制台输出
//             type: 'stdout'
//         },
//         run: {//运行日志
//             type: 'dateFile',
//             filename: config.app.logPath + '/runlog/',
//             pattern: 'run-yyyy-MM-dd.log',
//             alwaysIncludePattern: true
//         },
//         req: {//请求日志
//             type: 'dateFile',
//             filename: config.app.logPath + '/reqlog/',
//             pattern: 'req-yyyy-MM-dd.log',
//             alwaysIncludePattern: true
//         },
//         err: {//错误日志
//             type: 'dateFile',
//             filename: config.app.logPath + '/errlog/',
//             pattern: 'err-yyyy-MM-dd.log',
//             alwaysIncludePattern: true
//         }
//     },
//     categories: {
//         //FATAL>ERROR>WARN>INFO>DEBUG>OFF
//         default: { appenders: ['stdout', 'run'], level: 'debug' },
//         http: { appenders: ['stdout', 'req'], level: 'info' },
//         error: { appenders: ['stdout', 'err'], level: 'error' },
//         print: { appenders: ['stdout', 'run'], level: 'info' }
//     }
// })


const getLogger = function (name) {//name取categories项
    const logger =  log4js.getLogger(name || 'default')
    logger.level = 'debug';
    return logger
}

module.exports = getLogger
