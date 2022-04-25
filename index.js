#!/usr/bin/env node

const Request = require('request-promise');
const dotenv = require('dotenv');
dotenv.config();
const token = process.env['TELEGRAM_TOKEN'];
const chat_id = process.env['TELEGRAM_CHAT_ID'];
const api_key = process.env['BINANCE_API_KEY'];
const secret_key = process.env['BINANCE_SECRET_KEY'];
const NODE_ENV = process.env.NODE_ENV || "development";
const port = process.env.PORT || 3000;
const timeZone = process.env.TIME_ZONE_STRING || 'Asia/Kolkata';
if (NODE_ENV === "development") {
    console.log("NODE_ENV development")
} else {
    console.log("NODE_ENV production")
}
//Indian time string
const event = new Date().toLocaleString('en-IN', {
    timeZone: timeZone,
    timeZoneName: 'short'
});
//only for heroku port error
const express = require('express');
const app = express();
app.all('/', (req, res) => res.send('Bot is Running'));
app.listen(port, () => console.log(`${event} - Server started on ${port} port`));
//BinanceWS
const binanceApi = require('binance');
const binanceWS = new binanceApi.BinanceWS(false);
try {
    binanceRest = new binanceApi.BinanceRest({
        key: api_key,
        secret: secret_key,
        recvWindow: 10000
    })
    binanceWS.onUserData(binanceRest, data => {
        console.log(`${event} - Session Message: `, data);
        process_data(data);
    }, 60000).then(() => {
        console.log(`${event} - Monitoring Spot User Order Data for binance.com`);
        sendMessage(`<b>Binance Spot Order Monitor Started</b>\nthis message shows that you or heroku(if your are using) restart the bot.`)
    })
} catch (err) {
    console.error(`${event} - ${err}`)
    sendMessage(err.toString())
}

function fixFloat(floatNum, Precision = 8) {
    const num = Number.parseFloat(floatNum).toFixed(Precision);
    const str = num.toString();
    return str.replace(/(\.\d+?)0+\b/g, "$1") //fix 20.000 to 20.0 or 0.0000000120 to 0.000000012
}

function process_data(data) {
    let {
        e: eventType,
    } = data;
    let txt;
    if (eventType === 'executionReport') {
        let {
            x: executionType,
            s: symbol,
            p: price,
            q: quantity,
            S: side,
            o: orderType,
            i: orderId,
            X: orderStatus,
            l: lastTradeQuantity,
            z: Cumulative_filled_quantity,
            L:Last_price,
            r:Order_reject_reason
        } = data;
        let str4 = Trim(symbol, 4)
        let str3 = Trim(symbol, 3)
        let sy;
        if (["USDT", "BUSD", "TUSD", "USDC", "BIDR", "IDRT", "BVND"].includes(str4)) {
            sy = str4
        }
        if (["BNB", "BTC", "XRP", "TRX", "ETH", "AUD", "BRL", "EUR", "GBP", "RUB", "TRY", "PAX", "DAI", "UAH", "NGN", "VAI"].includes(str3)) {
            sy = str3
        }
        let total=``;
        if (orderType === "MARKET") {
            price = Last_price
        }else{
            total = `\n<b>Total:</b>  ${fixFloat(Number(price) * Number(quantity))} ${sy}`
        }
       
        if (executionType === 'TRADE') {
            if (orderType === 'LIMIT' && side === 'SELL'){
            if (orderStatus === 'PARTIALLY_FILLED') {
                txt = `⌛ ⌛ ⌛\n<b>Spot ${orderType} ${side} Order PARTIALLY FILLED</b>\n<b>Symbol:</b>  #${symbol}\n<b>Price:</b>  ${Last_price}\n<b>Last Filled:</b>  ${fixFloat(lastTradeQuantity)}\n<b>Total Filled:</b>  ${fixFloat(Cumulative_filled_quantity)}\n<b>Remaining:</b>  ${fixFloat(Number(quantity) - Number(Cumulative_filled_quantity))}\n<b>Order ID:</b>  #ID${orderId}`
            } else if (orderStatus === 'FILLED') {
                txt = `💰 💰 💰\n<b>Spot ${orderType} ${side} Order FULLY FILLED</b>\n<b>Symbol:</b>  #${symbol}\n<b>Price:</b>  ${Last_price}\n<b>Filled:</b>  ${fixFloat(Cumulative_filled_quantity)}${total}\n<b>Order ID:</b>  #ID${orderId}`
            }
        } else if (['REPLACED', 'EXPIRED', 'PENDING_CANCEL'].includes(orderStatus)) {
            txt = `🔴 🟡 🔵\n<b>Spot ${orderType} ${side} Order ${orderStatus}</b>\n<b>Symbol:</b>  #${symbol}\n<b>Price:</b>  ${price}\n<b>Quantity:</b>  ${fixFloat(quantity)}${total}\n<b>Order ID:</b>  #ID${orderId}`
        } else {
            txt = `⚠️ ⚠️⚠️\n<b>Undefined</b>\nExecution Type:  ${executionType}\nOrder Status ${orderStatus}\nFull Details:\n${data}`}
        }
        sendMessage(txt)
    }
}

//sending telegram message
function sendMessage(text) {
    let params = {
        chat_id: chat_id,
        text: text,
        parse_mode: 'html'
    };
    let options = {
        uri: 'https://api.telegram.org/bot' + token + '/' + 'sendMessage',
        qs: params,
        simple: false,
        resolveWithFullResponse: true,
        forever: true
    };
    return Request(options).then(resp => {
        if (resp.statusCode !== 200) {
            throw new Error(resp.statusCode + ':\n' + resp.body);
        }
        let updates = JSON.parse(resp.body);
        if (updates.ok) {
            console.log("Message send via Telegram")
            return updates;
        } else {
            console.log(`something went wrong while sending message to telegram see detailed error below.`)
            console.error(updates)
            return null;
        }
    }).catch(error => {
        throw error;
    });
}

function Trim(input, last_n_chr) {
    if (!input || !input.length) {
        return;
    }
    let l = input.length - last_n_chr
    return input.slice(l);
}
