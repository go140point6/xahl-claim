# xahl-claim

Note: This script is mostly derived from [@gadget78](https://github.com/gadget78/Evernode-Deploy-Monitor) with lots of help from [@tequdev](https://github.com/tequdev/xahau-reward-claim). I just lifted the parts I wanted and refactored it the way I like to structure my projects. I would very likely never have figured out how to make this work without both making their repos available.

Script which automates XAH Ledger's balance claim adjustment.
- Works for TESTNET and MAINNET.
- Input is simple single column .csv of addresses (see addresses.csv for working example, replace with your addresses).
- Script only works with ONE secret, so the recommended procedure is to create account and set that account as the regular key on ALL addresses (see below).

## warning
- DO NOT use your main wallet family secret, create a specific wallet address as the regular key.
- DO NOT leak this key!
- The author is NOT responsible for what you do with this software! 
- If your key leaks, you WILL lose your funds!

## install

```
git clone https://github.com/go140point6/xahl-claim
cd xahl-claim
npm install
```

Optional, but highly recommended when ready for production use:
```
sudo npm install -g pm2
pm2 startup # Note the output, copy and paste what it gives you and run it
pm2 start index.js --name xahl-balance-adj
pm2 save
```

## run it to test

By default the repo will come configured with a working set of testnet addresses, including a regular key and secret, and ready to run on TESTNET:
```
cp .env-template .env
```
In your newly created .env, change the cron schedule from every hour to every minute:
```
CRON_SCHED='*/1 * * * *'
```
Now run it:
```
node index.js
```
Note: on testnet, balance adjustment "matures" every 2 minutes, unlike mainnet which is every 30 days. Watch it as long as you want and then ctrl-c to exit.

## run it in production

1. Change the value of USE_TESTNET in the .env to "false".
2. Replace the testnet addresses with your real ones, remembering that you need a single regkey secret to use.
3. Change the cron schedule to something more realistic, .env-template has recommendations.
4. Use process manager to run the script in the background, and restart automatically on reboot/crash. See above.

## using pm2
```
pm2 status # see your various processes running and their corresponding process number
pm2 restart [process number] # restart your node app
pm2 delete [process number or all] # delete the app(s) being managed by pm2
pm2 save # save any changes to what is being monitored by pm2
```