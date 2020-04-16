const _ = require('lodash')._
const usermodel = require("../model/userinfo");
const resdisUtils = require("../utils/redisUtil");
const config = require("../configs/config");
let _GAME_TYPE = "live";
let ACTIVITY_START_TS = config.event.ACTIVITY_START_TS || 0;
let ACTIVITY_END_TS = config.event.ACTIVITY_END_TS || 0;

const sendGameMsg = function (addr, order_id, trxAmount, currency) {
    let _now = _.now();
    if (_now < ACTIVITY_START_TS || _now > ACTIVITY_END_TS) return;

    if (currency !== "TRX" && currency !== "USDT") {
        return;
    }

    if (currency === "TRX" && trxAmount < 100) {
        return [trxAmount, 0, false];
    }

    if (currency === "USDT" && trxAmount < 10) {
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
        let msg = {
            addr: addr,
            order_id: order_id,
            box_num: 1,
            game_type: _GAME_TYPE
        };
        resdisUtils.redis.publish("game_message", JSON.stringify(msg));
    }
    return [trxAmount, persent, hit];
}

const getAdditionRate = function () {
    try {
        const now = Date.now()
        const start = config.addition.START_TS
        const end = config.addition.END_TS
        const rate = config.addition.RATE
        console.log(start, end, now)
        console.log(rate)
        if (now >= start && now <= end) {
            return Number(rate)
        } else {
            return 1
        }
    } catch (error) {
        return 1;
    }
}

class Service {

    static success(data) {
        return {
            code: 200,
            message: "success",
            data: data,
        }
    }

    static error(messgae) {
        return {
            code: 400,
            message: messgae,
            data: {}
        }
    }

    static async identify(params) {
        console.log("identify params is ", params)
        const {tokenError, tokenInfo} = usermodel.checkToken(params.token)
        if (tokenError) {
            return this.error("token parse error , please check with your token!")
        } else {
            const p = {
                addr: tokenInfo.user,
            }
            const balanceInfo = await usermodel.getAllBalance(p)
            return this.success(balanceInfo)
        }
    }

    static async buy(params) {
        console.log("buy params is ", params)
        try {
            if (!['TRX', 'USDT'].includes(params.currency)) {
                return this.error("currency value is error !")
            }
            //
            const dictFields = [params.kind, params.status, params.expirationType]
            const dictFieldsSign = dictFields.every(e => [1, 2].includes(Number(e)))
            console.log(dictFields)
            if (!dictFieldsSign) {
                return this.error("kind/status/expiration_type value is invaild !")
            }
            const beforebalance = await usermodel.getBalance({addr: params.user, currency: params.currency})
            if (Number(params.sum) > Number(beforebalance.balance)) {
                return this.error("balance not enough!")
            }
            let amount = Number(params.sum) * 1e6
            const rate = getAdditionRate()
            console.log("debug ----> ", rate)
            const adAmount = rate * amount
            const sqlParam = {
                'transaction_id': params.id,
                'addr': params.user,
                'asset': params.asset,
                'kind': Number(params.kind),
                'amount': amount,
                'win': 0,
                'adAmount': adAmount,
                'currency': params.currency,
                'quote_open': Number(params.quoteOpen),
                'quote_close': Number(params.quoteClose),
                'created_at': Number(params.createdAt),
                'profitability': Number(params.profitability),
                'expiration_date': Number(params.expirationDate),
                'expiration_type': Number(params.expirationType)
            }
            await usermodel.buy(sqlParam)
            const balanceInfo = await usermodel.getBalance(sqlParam)
            sendGameMsg(sqlParam.addr, Date.now(), sqlParam.amount, sqlParam.currency);
            return this.success(balanceInfo)
        } catch (e) {
            return this.error(e.toString())
        }
    }

    static async close(params) {
        console.log("close params is ", params)
        try {
            if (!['TRX', 'USDT'].includes(params.currency)) {
                return this.error("currency value is error !")
            }
            const p = {
                win: Number(params.income) * 1e6,
                transaction_id: params.id,
                addr: params.user,
                currency: params.currency
            }
            await usermodel.close(p)
            const balanceInfo = await usermodel.getBalance(p)
            return this.success(balanceInfo)
        } catch (e) {
            return this.error(e.toString())
        }
    }

    static async refund(params) {
        try {
            if (!['TRX', 'USDT'].includes(params.currency)) {
                return this.error("currency value is error !")
            }
            const p = {
                amount: Number(params.sum),
                transaction_id: params.id,
                addr: params.user,
                currency: params.currency
            }
            await usermodel.refund(p)
            const balanceInfo = await usermodel.getBalance(p)
            return this.success(balanceInfo)
        } catch (e) {
            return this.error(e.toString())
        }
    }

}


module.exports = Service