import { ConfigReader } from '@vigcoin/conf-reader';
import { Logger } from '@vigcoin/logger';
import { PoolRequest } from '@vigcoin/pool-request';
import { RedisClient } from 'redis';
import { promisify } from 'util';

export class Payments {
  private configReader: ConfigReader;
  private config: any;
  private donations: any;
  private logger: Logger;
  private req: PoolRequest;
  private redis: RedisClient;
  private timer: NodeJS.Timer;
  private logName = 'payments';
  constructor(
    redis: RedisClient,
    configReader: ConfigReader,
    logger: Logger,
    req: PoolRequest) {
    this.configReader = configReader;
    const reader = configReader.get();
    this.config = reader.config;
    this.donations = reader.donations;
    this.redis = redis;
    this.logger = logger;
    this.req = req;
    this.timer = setTimeout(() => { }, 0);
  }

  public stopTimer() {
    clearTimeout(this.timer);
  }

  public async run() {
    this.stopTimer();
    this.logger.append('info', this.logName, 'Started', []);

    let balances = await this.getWorkerBalances();
    let payments = await this.getPayments(balances);
    await this.payWorkers(payments);

    this.timer = setTimeout(async () => {
      await this.run();
    }, this.config.payments.interval * 1000);
  }

  public async getWorkerBalances() {

    const keys = promisify(this.redis.keys).bind(this.redis);
    const hget = promisify(this.redis.hget).bind(this.redis);
    const workers = await keys([this.config.coin, 'workers', '*'].join(':'));

    const balances: any = {};

    for (const work of workers) {
      const balance = await hget(work, 'balance');
      const parts = work.splite(':');
      const id = parts[parts.length - 1];
      balances[id] = parseInt(balance) || 0
    }

    return balances;
  }

  public getPayments(balances: any) {
    const payments: any = {};

    for (const worker in balances) {
      const balance = balances[worker];
      if (balance >= this.config.payments.minPayment) {
        const remainder = balance % this.config.payments.denomination;
        let payout = balance - remainder;
        if (payout < 0) continue;
        if (payout >= this.config.payments.maxPayment) {
          payout = this.config.payments.maxPayment;
        }
        payments[worker] = payout;
      }
    }
    return payments;
  }

  public async payWorkers(payments: any) {
    const hincrby = promisify(this.redis.hincrby).bind(this.redis);
    const zadd = promisify(this.redis.zadd).bind(this.redis);

    let addresses = 0;
    let commandAmount = 0;
    let timeOffset = 0;


    let rpc: any = {
      destinations: [],
      fee: this.config.payments.transferFee,
      mixin: this.config.payments.mixin,
      unlock_time: 0
    };

    let redis = [];
    let totalAmount = 0;

    for (const worker of Object.keys(payments)) {
      let amount = parseInt(payments[worker]);
      if (this.config.payments.maxTransactionAmount
        && amount + commandAmount > this.config.payments.maxTransactionAmount) {
        amount = this.config.payments.maxTransactionAmount - commandAmount;
      }
      rpc.destinations.push({ amount, address: worker });


      rpc.destinations.push({ amount: amount, address: worker });
      redis.push([[this.config.coin, 'workers', worker].join(':'), 'balance', -amount]);
      redis.push([[this.config.coin, 'workers', worker].join(':'), 'paid', amount]);
      totalAmount += amount;

      addresses++;
      commandAmount += amount;
      if (addresses >= this.config.payments.maxAddresses ||
        (this.config.payments.maxTransactionAmount &&
          commandAmount >= this.config.payments.maxTransactionAmount)
      ) {
        try {
          let transfer = await this.req.wallet('', 'transfter', rpc);

          for (let r of redis) {
            await hincrby.apply(this.redis, r);
          }
          const now = (timeOffset++) + Date.now() / 1000 | 0;
          const txHash = transfer.tx_hash;

          await zadd(this.config.coin + ':payments:all', now, [
            txHash,
            totalAmount,
            rpc.fee,
            rpc.mixin,
            Object.keys(rpc.destinations).length
          ].join(':'));

          for (const destination of rpc.destinations) {
            await zadd(this.config.coin + ':payments:' + destination.address, now, [
              txHash,
              destination.amount,
              rpc.fee,
              rpc.mixin
            ].join(':'));
          }
          this.logger.append('info', this.logName, 'Payments sent via wallet daemon %j', [transfer]);
        } catch (e) {
          this.logger.append('error', 'payments', 'Error with send_transaction RPC request to wallet daemon %j', [e]);
          this.logger.append('error', 'payments', 'Payments failed to send to %j', rpc.destinations);
        }


      }
      addresses = 0;
      commandAmount = 0;
    }
  }
}
