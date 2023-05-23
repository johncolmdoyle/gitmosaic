/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/



const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand,  } = require('@aws-sdk/lib-dynamodb');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
const bodyParser = require('body-parser')
const express = require('express')
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const Jimp = require('jimp');
const AWS = require('aws-sdk');

AWS.config.update({ region: 'us-east-1' }); // Replace 'YOUR_REGION' with your desired AWS region
const sqs = new AWS.SQS();

const ddbClient = new DynamoDBClient({ region: process.env.TABLE_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

let tableName = "image";
if (process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
}

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "id";
const imageS3Bucket="gitmosaic-user-profiles";
const partitionKeyType = "S";
const sortKeyName = "index";
const sortKeyType = "N";
const hasSortKey = sortKeyName !== "";
const path = "/image";
const UNAUTH = 'UNAUTH';
const hashKeyPath = '/:' + partitionKeyName;
const sortKeyPath = hasSortKey ? '/:' + sortKeyName : '';

// declare a new express app
const app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});

app.post(path, async function(req, res) {
  const message = req.body; // Assuming the request body contains the message to be sent

  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: 'https://sqs.us-east-1.amazonaws.com/774395970952/imageSplit'
  };

  try {
    await sqs.sendMessage(params).promise();
    console.log('Message sent to the queue successfully');
    res.sendStatus(200);
  } catch (error) {
    console.error('Error sending message to the queue:', error);
    res.sendStatus(500);
  }
});

app.listen(3000, function() {
  console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
