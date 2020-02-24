const {raw, newUtcTime, getCustomDay, getTimeFormat} = require("../utils/dbutils")

const getDice = async function (startDate, endDate) {
    const sql = `
        SELECT
            distinct addr
        FROM
            tron_bet_admin.dice_user_order
        WHERE
            ts >= ?
            AND ts < ?
    `
    const params = [
        newUtcTime(startDate).getTime(),
        newUtcTime(endDate).getTime()
    ]
    const t = await raw(sql, params)
    const addr = t.map(e => e.addr || '')
    return addr
}

const getMoon = async function (startDate, endDate) {
    const sql = `
            SELECT
            distinct addr
        FROM
            tron_bet_admin.moon_user_order
        WHERE
            ts >= ?
            AND ts < ?
            And crashAt is not null 
    `
    const params = [
        newUtcTime(startDate).getTime(),
        newUtcTime(endDate).getTime()
    ]
    const t = await raw(sql, params)
    const addr = t.map(e => e.addr || '')
    return addr
}

const getRing = async function (startDate, endDate) {
    const sql = `
        SELECT
            distinct addr
        FROM
            tron_bet_admin.wheel_user_order
        WHERE
            roll is not null
            AND ts >= ?
            AND ts < ?
    `
    const params = [
        newUtcTime(startDate).getTime(),
        newUtcTime(endDate).getTime()
    ]
    const t = await raw(sql, params)
    const addr = t.map(e => e.addr || '')
    return addr
}

const getDuel = async function (startDate, endDate) {
    const sql = `
    SELECT
        player1,
        player2,
        player3,
        player4
    FROM
        tron_bet_admin.wheel_solo_order
    WHERE
        endTs >= ?
        AND endTs < ?
    `
    const params = [
        newUtcTime(startDate).getTime(),
        newUtcTime(endDate).getTime()
    ]
    const t = await raw(sql, params)
    let dict = {}
    t.forEach(k => {
        const keys = [k.player1, k.player2, k.player3, k.player4]
        keys.forEach(ele => {
            if (ele !== '' && ele !== null && dict[ele] !== 1) {
                dict[ele] = 1
            }
        })
    })
    const arr = Object.keys(dict)
    return arr
}

const getEM = async function (startDate, endDate) {
    const sql = `
        select
            distinct addr
        from
            tron_live.live_action_log_v2
        where
            ts >= ?
            AND ts < ?
            and action = 'bet'
            and txstatus = 1 
    `
    const params = [
        newUtcTime(startDate).getTime(),
        newUtcTime(endDate).getTime()
    ]
    const t = await raw(sql, params)
    const addr = t.map(e => e.addr || '')
    return addr
}

const getHub88 = async function (startDate, endDate) {
    const sql = `
        SELECT
            distinct email  as addr
        FROM
            tron_live.swagger_transaction_log
        WHERE
            ts >= ?
            AND ts < ?
            AND status = 1
    `
    const params = [
        newUtcTime(startDate).getTime(),
        newUtcTime(endDate).getTime()
    ]
    const t = await raw(sql, params)
    const addr = t.map(e => e.addr || '')
    return addr
}

const getSport = async function (startDate, endDate) {
    const sql = `
        SELECT
            distinct addr
        FROM
            tron_live.sports_transaction_log
        WHERE
            ts >= ?
            AND ts < ?
    `
    const params = [
        newUtcTime(startDate).getTime(),
        newUtcTime(endDate).getTime()
    ]
    const t = await raw(sql, params)
    const addr = t.map(e => e.addr || '')
    return addr
}

const getPoker = async function (startDate, endDate) {
    const sql = `
        select
            distinct addr
        from
            tronbet_poker_log.poker_revenue_log
        where
            optime >= ?
            AND  optime < ?
    `
    const params = [
        newUtcTime(startDate).getTime() / 1000,
        newUtcTime(endDate).getTime() / 1000
    ]
    const t = await raw(sql, params)
    const addr = t.map(e => e.addr || '')
    return addr
}

class DailyDAU {

    static async getData(startDate, endDate) {
        const typeDict = {
            "dice": getDice,
            "moon": getMoon,
            "ring": getRing,
            "duel": getDuel,
            "em": getEM,
            "hub88": getHub88,
            "sport": getSport,
            "poker": getPoker,
        }
        const keys = Object.keys(typeDict)
        let a = []
        for (let e of keys) {
            const tmp = await typeDict[e](startDate, endDate)
            a = a.concat(tmp)
        }
        const na = Array.from(new Set(a))
        return na.length
    }

}


module.exports = DailyDAU