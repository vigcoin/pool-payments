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

app.use(bodyParser());
app1.use(bodyParser());

app.all('/', (req, res) => {
  // console.log('inside body parser');
  // console.log(req.body);
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
  console.log('inside body parser 1');
  // console.log(req.body);
  res.end('end');
});

let server, server1;

test('run daemon server', done => {
  server = app.listen(config.daemon.port, () => {
    // console.log('server running');
    done();
  });
});

test('run wallet server', done => {
  server1 = app.listen(config.wallet.port, () => {
    // console.log('server 1 running');

    done();
  });
});

test('Should close all', () => {
  payments.stopTimer();
  redis.quit();
  server.close();
  server1.close();
});

