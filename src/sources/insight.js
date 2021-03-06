var request = require('request');

exports.Insight = function(root) {

    // Default to bitpay version of insight[ they are the creators and host the
    // source code.
    if (typeof root === "undefined") {
        root = "https://insight.bitpay.com";
    }
    // remove trailing slashes from root
    root = root.replace(/\/+$/g, "");

    this.address = function(addr, handler) {
        var url = root + "/api/addr/" + addr + "?noTxList=1&noCache=1";
        request.get({
            url: url,
            json: true,
        }, function(err, response, data) {
            if (err) {
                handler(err);
            }
            if (response.statusCode != 200) {
                handler("insight statusCode: " + response.statusCode);
            }
            var result = {
                address: addr,
                balance: data.balanceSat + data.unconfirmedBalanceSat,
                balance_confirmed: data.balanceSat,
                balance_unconfirmed: data.unconfirmedBalanceSat,
                total_received_gross: data.totalReceivedSat,
                total_sent_gross: data.totalSentSat,
                tx_count: data.txApperances,
            };
            handler(null, result);
        });
    }

    this.utxos = function(addr, handler) {
        var url = "https://insight.bitpay.com/api/addr/" + addr + "/utxo?noCache=1";
        request.get({
            url: url,
            json: true,
        }, function(err, response, data) {
            if (err) {
                handler(err);
            }
            if (response.statusCode != 200) {
                handler("insight statusCode: " + response.statusCode);
            }
            var utxos = [];
            for (var i=0; i<data.length; i++) {
                var dataUtxo = data[i];
                var utxo = {
                    txid: dataUtxo.txid,
                    tx_output: dataUtxo.vout,
                    amount: dataUtxo.amount * 1e8,
                    confirmations: dataUtxo.confirmations,
                };
                utxos.push(utxo);
            }
            // Sort oldest utxo first
            // TODO consider multiple utxos with same confirmations, and how it
            // affects sorting and thus correlation when aggregating.
            utxos.sort(function(a,b) {
                return a.confirmations < b.confirmations;
            });
            handler(null, utxos);
        });
    }

    this.txs = function(addr, handler) {
        var url = root + "/api/txs/?address=" + addr;
        request.get({
            url: url,
            json: true,
        }, function(err, response, data) {
            if (err) {
                handler(err);
            }
            if (response.statusCode != 200) {
                handler("insight statusCode: " + response.statusCode);
            }
            var txHashes = data.txs.map(function(t) { return t.txid; });
            var oldestFirst = txHashes.reverse();
            handler(null, oldestFirst);
        });
    }

    this.tx = function(txid, handler) {
        var url = root + "/api/tx/" + txid;
        request.get({
            url: url,
            json: true,
        }, function(err, response, data) {
            if (err) {
                handler(err);
            }
            if (response.statusCode != 200) {
                handler("insight statusCode: " + response.statusCode);
            }
            var result = {
                block_time: data.time,
                lock_time: data.locktime,
                txid: data.txid,
                fee: toSatoshis(data.fees),
                inputs: [],
                outputs: [],
            }
            // inputs
            result.inputs = data.vin.map(function(input) {
                return {
                    address: input.addr,
                    txid: input.txid,
                    amount: input.valueSat,
                    tx_output: input.vout,
                }
            });
            // outputs
            result.outputs = data.vout.map(function(output) {
                return {
                    address: output.scriptPubKey.addresses[0],
                    amount: toSatoshis(output.value),
                }
            });
            handler(null, result);
        });
    }

    function toSatoshis(btcStr) {
        var btc = parseFloat(btcStr);
        var satoshis = Math.round(btc * 1e8);
        var positive = Math.abs(satoshis);
        return positive;
    }

}
