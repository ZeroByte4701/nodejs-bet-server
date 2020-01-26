const fs = require("fs");
const path = require("path");

let prdCfg = {};
try {
  prdCfg = require("/data/tronbet_config/config");
} catch (error) {
  console.log("using app config");
}

let config = {
  env: "dev",
  debug: false,
  app: {
    http_port: prdCfg.port.tronbet_event01,
    logPath: path.resolve(__dirname, "../../logs"),
    log: true, //开启日志,
    startTs: 1577174400000,//2019-12-24 16:00:00;
    endTs: 1577836800000,//2020-01-01 08:00:00;
    interval: 86400000,
    randomSalt: "hi,can-you-hear-me?"
  },
  mysqlConfig: {
    db_host: prdCfg.mysql.host,
    db_port: prdCfg.mysql.port,
    db_name: "tron_bet_event",
    db_user: prdCfg.mysql.user,
    db_pwd: prdCfg.mysql.pwd,
    connectionLimit: 10
  },
  redisConfig: {
    host: "127.0.0.1",
    port: 6379,
    db: 1,
    pwd: ""
  },
  tronConfig: {
    // 发奖的私钥
    // privateKey: prdCfg.operatorDice_pk,
    privateKey: prdCfg.event_pk,
    // 发奖的私钥 对应的公钥
    // payPKHex: "TYmLSP22fzNNHozSXN6ANQF97zp8rhRP7K",
    payPKHex: prdCfg.event_pk_hex,

    masterFullNode: prdCfg.master_full,
    masterSolidityNode: prdCfg.master_solidity,
    masterEventNode: prdCfg.master_event,

    slaveFullNode: prdCfg.slave_full,
    slaveSolidityNode: prdCfg.slave_solidity,
    slaveEventNode: prdCfg.slave_event
  },
  boxConf: {
    goodsRate: [
      10000,
      20000,
      30000,
      33000,
      36000,
      36900,
      37800,
      38076,
      38352,
      38628
    ],
    // suitPrices: { 3: 9, 5: 10, 7: 60, 10: 300 },
    suitPrices: { 3: 6, 5: 10, 7: 50, 10: 300 },

    suitScore: { 3: 4, 5: 16, 7: 100, 10: 1000 },
    
    // goodPrices: [2.7, 2.7, 2.7, 10, 10, 43, 43, 132, 132, 132],
    goodPrices: [1, 1, 1, 2, 2, 5, 5, 10, 10, 10],

    lottery: { 3: 0, 5: 1, 7: 3, 10: 12 },
    lotteryRate: [
      50000,
      50000,
      400000,
      20000,
      200000,
      10000,
      20000,
      20000,
      20000
    ]
    // lotteryRate: [
    //   40000,
    //   40000,
    //   400000,
    //   20000,
    //   200000,
    //   10000,
    //   20925,
    //   20925,
    //   20925
    // ]
  },
  // 日排行奖励配置
  rewards: [
    88888,
    36666,
    18888,
    6666,
    3888,
    1888,
    888,
    888,
    888,
    888,
    888,
    888,
    888,
    888,
    888,
    666,
    666,
    666,
    666,
    666,
    388,
    388,
    388,
    388,
    388,
    388,
    388,
    388,
    388,
    388,
    166,
    166,
    166,
    166,
    166,
    166,
    166,
    166,
    166,
    166,
    88,
    88,
    88,
    88,
    88,
    88,
    88,
    88,
    88,
    88
  ]
  // rewards: [
  //   160000,
  //   80000,
  //   40000,
  //   20000,
  //   10000,
  //   7000,
  //   5000,
  //   4000,
  //   3000,
  //   2000,
  //   1000,
  //   1000,
  //   1000,
  //   1000,
  //   1000,
  //   800,
  //   800,
  //   800,
  //   800,
  //   800,
  //   600,
  //   600,
  //   600,
  //   600,
  //   600,
  //   500,
  //   500,
  //   500,
  //   500,
  //   500,
  //   400,
  //   400,
  //   400,
  //   400,
  //   400,
  //   300,
  //   300,
  //   300,
  //   300,
  //   300,
  //   100,
  //   100,
  //   100,
  //   100,
  //   100,
  //   100,
  //   100,
  //   100,
  //   100,
  //   100
  // ]

};

if (
  process.env.NODE_ENV === "production" &&
  fs.existsSync(__dirname + "/config.js")
) {
  //生产环境
  console.log(">>>Use production config!");
} else if (
  process.env.NODE_ENV === "test" &&
  fs.existsSync(__dirname + "/config_test.js")
) {
  //测试环境
  console.log(">>>Use test config!");
  config = Object.assign(config, require("./config_test.js"));
} else if (
  process.env.NODE_ENV === "development" &&
  fs.existsSync(__dirname + "/config_dev.js")
) {
  //开发环境
  config = Object.assign(config, require("./config_dev.js"));
} else {
  config = Object.assign(config, require("./config_dev.js"));
}

module.exports = config;
