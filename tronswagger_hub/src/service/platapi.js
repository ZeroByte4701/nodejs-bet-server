const userinfo = require('../model/userinfo')
const db = require('../utils/dbUtil')
const log4js = require('../configs/log4js_config')
const logger = log4js.getLogger('print')
const _ = require('lodash')._
const {swaghub}  = require('../configs/config')
const common = require('../utils/common')
const redisUtils = require('../utils/redisUtil')
const axios = require('axios')
const config = require('../configs/config');

const HmCrypto = require('hm-crypto-nodejs')


const digestType = 'RSA-SHA256';
const publicKey  = swaghub.swagPublick
const privateKey = swaghub.privetKey

// init with default keypair and digest type
const hmCrypto = HmCrypto(digestType, privateKey, publicKey);
let LocalCurrency = "TRX"

function sendMsg2Client(ctx, result) {
    console.log("response_data is ",result)
    ctx.body = result
}

function getToken(token) {
    try {
        let token1 = Buffer.from(token, 'base64').toString('ascii')
        if (token1.split('|').length == 2) {
            console.log(token1)
            token1 = token1.split('|')[0]
        }
        return token1
    } catch (error) {
        return token
    }
}

function toCpAmount(currency, amount) {
    if(currency == 'BNB') {
        return amount / 1000
    } else {
        return amount 
    }
}

function fromCpAmount(currency, amount) {
    if(currency == 'BNB') {
        return amount * 1000
    } else {
        return amount 
    }
}

let _GAME_TYPE = "live";
let ACTIVITY_START_TS = config.event.ACTIVITY_START_TS || 0;
let ACTIVITY_END_TS = config.event.ACTIVITY_END_TS || 0;
function sendGameMsg(addr, order_id, trxAmount, currency) {
    let _now = _.now();
    if (_now < ACTIVITY_START_TS || _now > ACTIVITY_END_TS) return;

    if(currency !== 'TRX' && currency !== 'USDT'){
        return;
    }

    if(currency === 'TRX' && trxAmount < 100){
        return [trxAmount, 0, false];
    }

    if(currency === 'USDT' && trxAmount < 10){
        return [trxAmount, 0, false];
    }

    //箱子爆率=投注额^0.527163*0.3%
    //箱子爆率=投注额^0.495424251*0.3%
    let persent = Math.floor(Math.pow(trxAmount, 0.495424251) * 30);
    if (persent > 9000) persent = 9000;
    let _r = _.random(0, 10000);
    let hit = false;
    if (_r <= persent) {
        hit = true;
    }
    if (hit === true) {
        let msg = { addr: addr, order_id: order_id, box_num: 1, game_type: _GAME_TYPE };
        // loggerDefault.info("sendGameMsg", msg);
        redisUtils.redis.publish("game_message", JSON.stringify(msg));
        // appEvent.emit('activity_info', msg); //**  */
    }
    return [trxAmount, persent, hit];
}

async function balance(ctx) {
    let params = ctx.request.body
    let headers = ctx.request.headers

    const localSignature = hmCrypto.sign(JSON.stringify(params))
    const remoteSignature = headers['X-Hub88-Signature'] || headers['x-hub88-signature']

    let isTrue = hmCrypto.isValid(JSON.stringify(params), remoteSignature)
    if (!isTrue) {
        console.log(localSignature, remoteSignature)
        return sendMsg2Client(ctx, {status: 'RS_ERROR_INVALID_TOKEN'})
    }
    let token = getToken(params.token)
    let account = await userinfo.getAccountBySessionId(token)
    console.log(account)
    if (_.isEmpty(account)) return sendMsg2Client(ctx, {status: 'RS_ERROR_UNKNOWN'})

    if (account[0].currency == 'USDT') {
        account[0].currency = 'TRX'
    }

    let balance = await userinfo.getUserBalanceByCurrency(account[0].uid, account[0].currency)

    console.log({
        status: 'RS_OK',
        user: account[0].nickName || account[0].email,
        request_uuid: params.request_uuid,
        currency: account[0].currency,
        balance: toCpAmount(account[0].currency, balance)
    })
    return sendMsg2Client(ctx, {
        status: 'RS_OK',
        user: account[0].nickName || account[0].email,
        request_uuid: params.request_uuid,
        currency: account[0].currency,
        balance: toCpAmount(account[0].currency, balance)
    })
}

async function win(ctx) {
    let params = ctx.request.body
    let headers = ctx.request.headers
    console.log(`${new Date().toJSON()}-->request_win: `,params)

    const localSignature = hmCrypto.sign(JSON.stringify(params))
    const remoteSignature = headers['X-Hub88-Signature'] || headers['x-hub88-signature']

    let isTrue = hmCrypto.isValid(JSON.stringify(params), remoteSignature)
    if (!isTrue) {
        console.log(localSignature, remoteSignature)
        return sendMsg2Client(ctx, {status: 'RS_ERROR_INVALID_TOKEN'})
    }

    let transactionId = params.transaction_uuid
    let supplier_user = params.supplier_user
    let round = params.round
    let is_free = params.is_free
    let game_id = params.game_id
    let currency = params.currency
    let bet = params.bet
    let amount = params.amount * 10
    let betTxId = params.reference_transaction_uuid
    
    amount = fromCpAmount(currency, amount)
    let token = getToken(params.token)
    let account = await userinfo.getAccountBySessionId(token)
    if (_.isEmpty(account)) return sendMsg2Client(ctx, {status: 'RS_ERROR_UNKNOWN'})

    let transaction = await userinfo.getTransactionById(betTxId)

    if (_.isEmpty(transaction)) return sendMsg2Client(ctx, {status: 'RS_ERROR_TRANSACTION_DOES_NOT_EXIST'})

    const statusTmp  = Number(transaction[0].status)
    if (statusTmp !== 2) {
        return sendMsg2Client(ctx, {status: 'RS_ERROR_TRANSACTION_ROLLED_BACK'})
    }

    if (transaction[0].win > 0) {
        return sendMsg2Client(ctx, {status: 'RS_OK', request_uuid: params.request_uuid, currency: currency, user: account.nickName || account.email})
    }

    console.log(`${account[0].email} win ${amount} @ ${betTxId}, winTransaction: ${transactionId} `)
    let conn = null
    try {
        conn = await db.getConnection()
        if (conn == null) {
            return sendMsg2Client(ctx, 101, 'unknown failed')
        }
        conn.beginTransaction()
        let res = await userinfo.userWin(account[0].uid, currency, transactionId, transaction[0].transactionId, amount, conn)
        conn.commit()
    } catch (error) {
        logger.info(error)
        if (conn) conn.rollback()
        if (conn) conn.release()
        if (error.code === 'ER_DUP_ENTRY'){
            let newBalance = await userinfo.getUserBalanceByCurrency(account[0].uid, currency)
            return sendMsg2Client(ctx, {
                user: account[0].nickName || account[0].email,
                status: "RS_OK",
                request_uuid: params.request_uuid,
                currency: currency,
                balance: toCpAmount(currency, newBalance)
            })
        }
        return sendMsg2Client(ctx, {status: 'RS_ERROR_TRANSACTION_ROLLED_BACK'})
    } finally {
        if (conn) conn.release()
    }

    let newBalance = await userinfo.getUserBalanceByCurrency(account[0].uid, currency)
    return sendMsg2Client(ctx, {
        user: account[0].nickName || account[0].email,
        status: "RS_OK",
        request_uuid: params.request_uuid,
        currency: currency,
        balance: toCpAmount(currency, newBalance)
    })

}

async function getAdditionByGameId(GameID) {
    try {
        let multi = await redisUtils.hget('tronlive:hub88:addition', '' + GameID)
        console.log('tronlive:hub88:addition', multi)
        if(!multi) return 1
        return Number(multi)
    } catch (error) {
        return 1
    }
}

async function bet(ctx) {
    let params = ctx.request.body
    let headers = ctx.request.headers

    console.log(`${new Date().toJSON()}-->request_bet: `,params)

    const localSignature = hmCrypto.sign(JSON.stringify(params))
    const remoteSignature = headers['X-Hub88-Signature'] || headers['x-hub88-signature']

    let isTrue = hmCrypto.isValid(JSON.stringify(params), remoteSignature)
    if (!isTrue) {
        console.log(localSignature, remoteSignature)
        return sendMsg2Client(ctx, {status: 'RS_ERROR_INVALID_TOKEN'})
    }

    let transactionId = params.transaction_uuid
    let round = params.round
    let is_free = params.is_free
    let game_id = params.game_id
    let currency = params.currency
    let bet = params.bet || ''
    let amount = params.amount * 10

    amount = fromCpAmount(currency, amount)
    if (bet.length > 30) bet = bet.slice(0,30)

    let token = getToken(params.token)
    let account = await userinfo.getAccountBySessionId(token)
    if (_.isEmpty(account)) return sendMsg2Client(ctx, {status: 'RS_ERROR_UNKNOWN'})

    let balance = await userinfo.getUserBalanceByCurrency(account[0].uid, currency)
    if (balance < fromCpAmount(currency, params.amount)) {
        return sendMsg2Client(ctx, {status: 'RS_ERROR_NOT_ENOUGH_MONEY'})
    }

    console.log(`${account[0].email} bet ${amount} @ ${transactionId} `)

    let conn = null
    try {
        conn = await db.getConnection()
        if (conn == null) {
            return sendMsg2Client(ctx, 101, 'unknown failed')
        }
        conn.beginTransaction()

        let multi = await getAdditionByGameId(game_id)
        let addAmount = amount * multi
        let res = await userinfo.userBet(transactionId, account[0].uid, account[0].email, round, is_free, game_id, currency, bet, amount, addAmount,conn)
        
        // 触发活动
        // console.log("amount", amount)
        sendGameMsg(account[0].email, new Date().getTime(), amount/ 1000000, currency);
        
        conn.commit()
    } catch (error) {
        logger.info(error)
        if (conn) conn.rollback()
        if (conn) conn.release()
        if (error.code === 'ER_DUP_ENTRY'){
            let newBalance = await userinfo.getUserBalanceByCurrency(account[0].uid, currency)
            return sendMsg2Client(ctx, {
                user: account[0].nickName || account[0].email,
                status: "RS_OK",
                request_uuid: params.request_uuid,
                currency: currency,
                balance: toCpAmount(currency, newBalance)
            })
        }
        return  sendMsg2Client(ctx, {status: 'RS_ERROR_NOT_ENOUGH_MONEY'})
    } finally {
        if (conn) conn.release()
    }

    let newBalance = await userinfo.getUserBalanceByCurrency(account[0].uid, currency)
    // console.log({
    //     user: account[0].nickName || account[0].email,
    //     status: "RS_OK",
    //     request_uuid: params.request_uuid,
    //     currency: currency,
    //     balance: newBalance
    // })
    return sendMsg2Client(ctx, {
        user: account[0].nickName || account[0].email,
        status: "RS_OK",
        request_uuid: params.request_uuid,
        currency: currency,
        balance: toCpAmount(currency, newBalance)
    })
}

async function rollback(ctx) {
    let params = ctx.request.body
    let headers = ctx.request.headers
    console.log(`${new Date().toJSON()}-->request_rollback: `,params)

    const localSignature = hmCrypto.sign(JSON.stringify(params))
    const remoteSignature = headers['X-Hub88-Signature'] || headers['x-hub88-signature']

    let isTrue = hmCrypto.isValid(JSON.stringify(params), remoteSignature)
    if (!isTrue) {
        console.log(localSignature, remoteSignature)
        return sendMsg2Client(ctx, {status: 'RS_ERROR_INVALID_TOKEN'})
    }


    let token = getToken(params.token)
    let account = await userinfo.getAccountBySessionId(token)
    if (_.isEmpty(account)) return sendMsg2Client(ctx, {status: 'RS_ERROR_UNKNOWN'})

    let transactionId = params.transaction_uuid
    let betTxId = params.reference_transaction_uuid

    let transaction = await userinfo.getTransactionById(betTxId)

    if (_.isEmpty(transaction)) {
        if (account[0].currency == 'USDT') {
            account[0].currency = 'TRX'
        }
        let newBalance = await userinfo.getUserBalanceByCurrency(account[0].uid, account[0].currency)
        console.log({status: 'RS_OK_NO_TRANSACTION', request_uuid: params.request_uuid, currency: account[0].currency, user: account[0].nickName || account[0].email, balance: toCpAmount(account[0].currency, newBalance)})
        return sendMsg2Client(ctx, {status: 'RS_OK', request_uuid: params.request_uuid, currency: account[0].currency, user: account[0].nickName || account[0].email, balance: toCpAmount(account[0].currency, newBalance)})
    }

    let currency = transaction[0].currency
    let amount = transaction[0].amount

    // update 20200527  处理成2(刚pay)
    const statusTmp = transaction[0].status
    console.log("statusTmp___> ",statusTmp)
    if (Number(statusTmp) !== 2) {
        let newBalance = await userinfo.getUserBalanceByCurrency(account[0].uid, currency)
        console.log({status: 'RS_OK', request_uuid: params.request_uuid, currency: currency, user: account[0].nickName || account[0].email, balance:toCpAmount(currency, newBalance)})
        return sendMsg2Client(ctx, {status: 'RS_OK', request_uuid: params.request_uuid, currency: currency, user: account[0].nickName || account[0].email, balance: toCpAmount(currency, newBalance)})
    }

    if (transaction[0].win > 0) {
        return sendMsg2Client(ctx, {status: 'RS_ERROR_DUPLICATE_TRANSACTION'})
    }
    let conn = null
    try {
        conn = await db.getConnection()
        if (conn == null) {
            return sendMsg2Client(ctx, 101, 'unknown failed')
        }
        conn.beginTransaction()
        let res = await userinfo.userRollBack(account[0].uid, currency, transactionId, transaction[0].transactionId, amount, conn)
        conn.commit()
    } catch (error) {
        logger.info(error)
        if (conn) conn.rollback()
        if (conn) conn.release()
        let newBalance = await userinfo.getUserBalanceByCurrency(account[0].uid, currency)
        return sendMsg2Client(ctx, {
            user: account[0].nickName || account[0].email,
            status: "RS_OK",
            request_uuid: params.request_uuid,
            currency: currency,
            balance: toCpAmount(currency, newBalance)
        })

    } finally {
        if (conn) conn.release()
    }

    let newBalance = await userinfo.getUserBalanceByCurrency(account[0].uid, currency)
    return sendMsg2Client(ctx, {
        user: account[0].nickName || account[0].email,
        status: "RS_OK",
        request_uuid: params.request_uuid,
        currency: currency,
        balance: toCpAmount(currency, newBalance)
    })

}

async function getStartUrl(nickName, token, gameId) {
    let paramas = {
        user: nickName,
        token: token,
        sub_partner_id: null,
        platform: "GPL_DESKTOP",
        operator_id: swaghub.operator_id,
        meta: {
            rating: 10,
            oddsType: "decimal"
        },
        lobby_url: "https://amazing-casino.com/lobby",
        lang: "en",
        ip: "142.245.172.168",
        game_id: Number(gameId),
        deposit_url: "",
        currency: "BTC",
        country: "EE"
    }

    let computedSignature = hmCrypto.sign(JSON.stringify(paramas))
    try {
        let {data} = await axios({
            url: swaghub.host + '/operator/generic/v2/game/url',
            method: 'post',
            data: paramas,
            headers: { 'content-type': 'application/json', 'X-Hub88-Signature' : computedSignature},
        })
        console.log(data)
        return data
    } catch (error) {
        // console.log(error)
        return null
    }
}

async function getSwaggerGames(ctx) {
    let games = await redisUtils.hget('tronswaggergame', 'games')
    if (!games) {
        games = []
    } else {
        games = JSON.parse(games)
    }
    return await common.sendMsg2Client(ctx, 0, '', games)
}

async function getLanchUrl(ctx) {
    let paramas = ctx.request.body
    let game_id = paramas.game_id
    // let authToken = paramas.authToken
    // let userPreView = await redisUtils.get(authToken)
    // if (!userPreView) {
    //     return common.sendMsg2Client(ctx, 401, 'not authed account')
    // }

    // let email = paramas.email
    // console.log(paramas)

    // // let email = userPreView
    // let user = await userinfo.getAccountrByEmail(email)
    // if (!user) {
    //     return common.sendMsg2Client(ctx, 401, 'not authed account')
    // }
    // let thirdToken = user[0].sessionId + "|" + game_id
    // thirdToken = Buffer.from(thirdToken).toString('base64')
    // let startUlr = await getStartUrl(user[0].nickName || user[0].email, thirdToken, game_id)
    // if (!startUlr) return common.sendMsg2Client(ctx, 2022, 'failed')

    // return common.sendMsg2Client(ctx, 0, '', startUlr)
    return
}

module.exports = {
    balance,
    win,
    bet,
    rollback,
    getSwaggerGames,
    getLanchUrl
}