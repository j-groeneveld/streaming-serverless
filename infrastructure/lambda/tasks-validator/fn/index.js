/*

Handles the following event types: INSERT, MODIFY and REMOVE for Tasks table
DynamoDB Stream.

*/
const env = process.env;
const fnName = env.AWS_LAMBDA_FUNCTION_NAME;
console.log(`Loading function ${fnName}...`);

const isLocal = !!env.LOCALSTACK_HOSTNAME;
const AWS = require('aws-sdk');

const config = new AWS.Config({
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  region: env.AWS_REGION,
});

const sns = new AWS.SNS({ endpoint: `http://${env.LOCALSTACK_HOSTNAME}:4575` });

const h = require('./helpers.js');
const hv = require('./helpersValidator.js');

exports.lambda_handler = (event, context, callback) => {
  console.log(`event: ${JSON.stringify(event)}`);
  console.log(`env: ${JSON.stringify(env)}`);
  const promises = event.Records.map(record => {
    return eval(hv.parseValidatorFunction(record.eventName))(record.dynamodb)
      .then(params => {
        return hv.handleParams(sns, params, 'notifications');
      })
      .then(res => {
        console.log(`${fnName} succeeded: ${JSON.stringify(res)}`);
        return true;
      })
      .catch(err => {
        console.log(
          `${fnName} failed on record: ${JSON.stringify(
            record
          )} \n with error: ${err.stack || err}`
        );
        return false;
      });
  });

  Promise.all(promises.map(p => p.catch(e => e)))
    .then(res => {
      callback(
        null,
        `Processed ${
          res.length
        } records with the following output: ${JSON.stringify(res)}`
      );
    })
    .catch(err =>
      callback(null, `${fnName} failed at the root level: ${err.stack || err}`)
    );
};

/*
##########################
### HANDLE EVENT TYPES ###
##########################
*/

function validateInsert(record) {
  return new Promise((resolve, reject) => {
    const newTask = h.parseDynamoObj(record.NewImage);

    // TODO completed is being sent through stream as S not BOOL
    newTask.completed = newTask.completed === 'true';

    resolve({ Message: 'insert' });
  });
}

function validateModify(record) {
  return new Promise((resolve, reject) => {
    const newTask = h.parseDynamoObj(record.NewImage);
    const oldTask = h.parseDynamoObj(record.OldImage);

    // TODO completed is being sent through stream as S not BOOL
    newTask.completed = newTask.completed === 'true';
    oldTask.completed = oldTask.completed === 'true';

    resolve({ Message: 'modify' });
  });
}

function validateRemove(record) {
  return new Promise((resolve, reject) => {
    resolve({ Message: 'remove' });
  });
}
