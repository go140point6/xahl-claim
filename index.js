require('dotenv').config();
require('log-timestamp');
const { XrplClient } = require('xrpl-client');
const lib = require('xrpl-accountlib');
const fs = require('fs');
const { parse } = require('csv-parse');

addressesToCollect = []
const use_testnet = process.env.USE_TESTNET === 'true' ? true : false
let xahaud, seed, networkID

const createArray = new Promise((resolve, reject) => {
    fs.createReadStream("data/addresses.csv")
    .pipe(parse({ delimiter: ",", from_line: 1 }))
    .on("data", function (row) {
        addressesToCollect.push(row[0]) 
    })
    .on("end", function() {
        resolve(addressesToCollect)
    })
    .on("error", function(err) {
        reject(err)
    })
})

async function networkSetup() {
  if (use_testnet) {
    xahaud = process.env.WS_TESTNET
    seed = process.env.SEED_TESTNET
    networkID = process.env.TS_NETWORK_ID
  } else {
    xahaud = process.env.WS_MAINNET
    seed = process.env.SEED_MAINNET
    networkID = process.env.MN_NETWORK_ID
  }
}

async function main() {
  await networkSetup()
  const client = new XrplClient(xahaud)

  const liveDefinitions = await client.send({ "command": "server_definitions" })
  const definitions = new lib.XrplDefinitions(liveDefinitions)

  let rewardDelay = await client.send({
    command: 'ledger_entry',
    hook_state: {
      account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
      key: '0000000000000000000000000000000000000000000000000000000000005244', // RD
      namespace_id: '0000000000000000000000000000000000000000000000000000000000000000'
    }
  })

  rewardDelay = hookStateXLFtoBigNumber(rewardDelay.node['HookStateData'])

  const reg_key_acct = lib.derive.familySeed(seed)

  for (const account of addressesToCollect) {
    console.log(account)
    const { account_data } = await client.send({ command: "account_info", account })
    console.log(account_data)
    const { ledger } = await client.send({ command: 'ledger', ledger_index: 'validated' })

    const RewardTime = account_data?.RewardTime || 0
    const remainingSec = rewardDelay - (ledger.close_time - RewardTime)
    const claimable = remainingSec <= 0
    const now = new Date()
    const claimableDate = new Date(now.getTime() + remainingSec * 1000)
    const claimableTime = calcrewardDelayHuman(remainingSec)
  
    if (claimable) {
      console.log(`Ready, attempting claim...`)
  
      const { account_data: { Sequence: sequence } } = await client.send({ command: "account_info", account: account })
      let claimTx = {
        Account: account,
        TransactionType: 'ClaimReward',
        Issuer: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        NetworkID: networkID,
        Sequence: sequence,
        Fee: "0",
        SigningPubKey: "",
      }
    
      const encoded = lib.binary.encode(claimTx, definitions)

      let networkInfo = await lib.utils.txNetworkAndAccountValues(xahaud, account)
      claimTx = { ...claimTx, ...networkInfo.txValues }
      let { response: { engine_result: claimTxResult } } = await lib.signAndSubmit(claimTx, xahaud, reg_key_acct)

      if ( claimTxResult !== "tesSUCCESS" && claimTxResult !== "tesQUEUED" ) {
        console.log("Claim failed")
      } else {
        console.log("Claim succeeded")
      }
    } else {
      console.log("Not ready to claim.")
    }
  }

  client.close()
}

createArray.then(() => {
    main()
}).catch((err) => {
    console.error(err)
})

// claim reward functions .............................................
function get_exponent(xfl) {
    if (xfl < 0n)
      throw new Error("Invalid XFL");
    if (xfl == 0n)
      return 0n;
    return ((xfl >> 54n) & 0xFFn) - 97n;
  }
  
  function get_mantissa(xfl) {
    if (xfl < 0n)
      throw new Error("Invalid XFL");
    if (xfl == 0n)
      return 0n;
    return xfl - ((xfl >> 54n) << 54n);
  }
  
  function is_negative(xfl) {
    if (xfl < 0n)
      throw new Error("Invalid XFL");
    if (xfl == 0n)
      return false;
    return ((xfl >> 62n) & 1n) == 0n;
  }
  
  function to_string(xfl) {
    if (xfl < 0n)
      throw new Error("Invalid XFL");
    if (xfl == 0n)
      return "<zero>";
    return (is_negative(xfl) ? "-" : "+") +
      get_mantissa(xfl).toString() + "E" + get_exponent(xfl).toString();
  }
  
  function xflToFloat(xfl) {
    return parseFloat(to_string(xfl));
  }
  
  function changeEndianness(str){
    const result = [];
    let len = str.length - 2;
    while (len >= 0) {
      result.push(str.substr(len, 2));
      len -= 2;
    }
    return result.join('');
  }
  
  function hookStateXLFtoBigNumber(stateData) {
    const data = changeEndianness(stateData);
    const bi = BigInt('0x' + data);
    return xflToFloat(bi);
  }
  
  function calcrewardRateHuman(rewardRate) {
    if (!rewardRate) return "0 %";
    if (rewardRate < 0 || rewardRate > 1) return "Invalid rate";
    return (Math.round((((1 + rewardRate) ** 12) - 1) * 10000) / 100) + " %";
  }
  
  function calcrewardDelayHuman(rewardDelay) {
    if (rewardDelay / 3600 < 1) return Math.ceil(rewardDelay / 60) + " mins";
    if (rewardDelay / (3600 * 24) < 1) return Math.ceil(rewardDelay / 3600) + " hours";
    return Math.ceil(rewardDelay / (3600 * 24)) + ' days';
  }

