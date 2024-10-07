require('dotenv').config();
require('log-timestamp');
const { XrplClient } = require('xrpl-client');
const lib = require('xrpl-accountlib');
const fs = require('fs');
const cron = require('node-cron');
const cronSchedule = process.env.CRON_SCHED;
const { parse } = require('csv-parse');
const { get_exponent, get_mantissa, is_negative, to_string, xflToFloat, changeEndianness, hookStateXLFtoBigNumber, calcrewardRateHuman, calcrewardDelayHuman } = require('./shared/helpers');

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
  console.log(`Starting balance adjustment check using ${xahaud}...`)
  const balanceAdjCheck = cron.schedule(cronSchedule, async () => {
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
      const { account_data } = await client.send({ command: "account_info", account })
      const { ledger } = await client.send({ command: 'ledger', ledger_index: 'validated' })
      let claimable = false

      if ( account_data?.RewardLgrFirst === undefined ) {
        console.log(`${account} doesn't appear to be registered for balance adjustment, perhaps you are on the wrong network (TESTNET vs MAINNET)?`)
        continue
      } else {
        const RewardTime = account_data?.RewardTime || 0
        const remainingSec = rewardDelay - (ledger.close_time - RewardTime)
        claimable = remainingSec <= 0
        const now = new Date()
        const claimableDate = new Date(now.getTime() + remainingSec * 1000)
        const claimableTime = calcrewardDelayHuman(remainingSec)  
      }

      if (claimable) {
        console.log(`${account} is ready to claim, attempting...`)
    
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
          console.log(`Claim failed on ${account} for some reason.`)
        } else {
          console.log(`Claim succeeded on ${account}.`)
        }
      } else {
        console.log(`The account ${account} is not ready to claim, trying again later...`)
      }
    }

    client.close()
  })
}

createArray.then(() => {
    main()
}).catch((err) => {
    console.error(err)
})
