import { Payments } from '../src/payments';
import { RedisClient } from 'redis';
import { ConfigReader } from '@vigcoin/conf-reader';
import { Logger } from '@vigcoin/logger';
import { PoolRequest } from '@vigcoin/pool-request';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Router, Request, Response, Application } from 'express';
import * as express from 'express';
import * as bodyParser from 'body-parser';

const app: Application = express();
const app1: Application = express();

const file = path.resolve(__dirname, './config.json');

const reader = new ConfigReader(file);

const readConfig = reader.get({
  coreDevDonation: {
    aaa: 'sss',
  },
  devDonation: {
    aaa: 'sss',
  },
  extraFeaturesDevDonation: {},
});

const config = readConfig.config;
const redis = new RedisClient({});
const logger = new Logger(config.logger);
const pr = new PoolRequest(config.daemon, config.wallet, config.api);
const payments = new Payments(redis, reader, logger, pr);

let workers, workersPayments, paid;


app.use(bodyParser());
app1.use(bodyParser());

app.all('/', (req, res) => {
  let height = req.body.params.height;
  if (height === 11) {
    res.status(500).end();
    return;
  }
  if (height === 2) {
    res.json({
      block_header: {
        hash: 11,
        depth: 100,
        reward: 1,
      },
    });
    return;
  }

  if (height === 2) {
    res.json({
      block_header: {
        hash: 13,
        depth: 10,
        reward: 1,
      },
    });
    return;
  }
  if (height === 1) {
    res.json({
      block_header: {
        hash: '12',
        depth: 100,
        reward: 1,
      },
    });
  } else {
    res.json({});
  }
});

app1.all('/', (req, res) => {
  res.end('end');
});

let server, server1;

test('run daemon server', done => {
  server = app.listen(config.daemon.port, () => {
    done();
  });
});

test('run wallet server', done => {
  server1 = app.listen(config.wallet.port, () => {
    done();
  });
});

test('should get workers', async () => {
  workers = await payments.getWorkerBalances();
});

test('should adjust data', async () => {
  const hset = promisify(redis.hset).bind(redis);
  await hset([config.coin, 'workers', 'aaa'].join(':'), '1', 1);
  await hset([config.coin, 'workers', 'bbb'].join(':'), '2', 1);
  await hset([config.coin, 'workers', 'ccc'].join(':'), '2', 1);
  await hset([config.coin, 'workers', 'ddd'].join(':'), '2', 1);
  await hset([config.coin, 'workers', 'eee'].join(':'), '2', 1);
  await hset([config.coin, 'workers', 'fff'].join(':'), '2', 1);
  await hset([config.coin, 'workers', 'ggg'].join(':'), '2', 1);
  await hset([config.coin, 'workers', 'hhh'].join(':'), '2', 1);
  await hset([config.coin, 'workers', 'aaa'].join(':'), 'balance', '10000000000');
  await hset([config.coin, 'workers', 'bbb'].join(':'), 'balance', '60000000000');
  await hset([config.coin, 'workers', 'ccc'].join(':'), 'balance', '15000000000');
  await hset([config.coin, 'workers', 'ddd'].join(':'), 'balance', '8000000000');
  await hset([config.coin, 'workers', 'eee'].join(':'), 'balance', '18000000000');
  await hset([config.coin, 'workers', 'fff'].join(':'), 'balance', '28000000000');
  await hset([config.coin, 'workers', 'ggg'].join(':'), 'balance', '38000000000');
  await hset([config.coin, 'workers', 'hhh'].join(':'), 'balance', '10000000000000000000');
});

test('should get workers', async () => {
  workers = await payments.getWorkerBalances();
});

test('should get workers', async () => {
  workersPayments = await payments.getPayments(workers);
  paid = await payments.payWorkers(workersPayments);
});

test('Should run', done => {
  payments.run().then(() => {
    setTimeout(() => {
      done();
    }, 1000);
  });
});

test('Should flush all', done => {
  redis.flushall((err, succeeded) => {
    expect(!err).toBeTruthy();
    expect(succeeded).toBeTruthy();
    done();
  });
});

test('Should close all', () => {
  payments.stopTimer();
  redis.quit();
  server.close();
  server1.close();
});

test('should get payments', async () => {
  paid = await payments.payWorkers(workersPayments);
});

