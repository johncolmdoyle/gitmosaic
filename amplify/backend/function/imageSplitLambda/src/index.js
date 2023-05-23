const AWS = require('aws-sdk');
const Jimp = require('jimp');
const request = require('request');
var http = require('http');

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    const { Records } = event;
    console.log(`Records: ${JSON.stringify(Records)}`);

    const imageRecords = Records.filter((record) => JSON.parse(record.body));

    for (const record of imageRecords) {
      console.log(`Record: ${JSON.stringify(record)}`)
      const { imageUrl } = record;

      const imageBuffer = await downloadImage(imageUrl);
      const imageParts = await splitImage(imageBuffer, 100);

      await Promise.all(imageParts.map((part, index) => {
        const s3Key = `image_${messageId}_${index + 1}.jpeg`;
        return uploadToS3(s3Key, part);
      }));

      const dynamoItems = imageParts.map((_, index) => ({
        messageId,
        imageIndex: index + 1,
        s3Key: `image_${messageId}_${index + 1}.jpeg`
      }));

      await saveToDynamoDB(dynamoItems);
    }

    return { statusCode: 200, body: 'Images processed successfully.' };
  } catch (error) {
    console.error('Error processing images:', error);
    return { statusCode: 500, body: 'Error processing images.' };
  }
};

const downloadImage = (imageUrl) => {
  return new Promise((resolve, reject) => {
    http.get("URL.jpg", function(res){
      var imageData = ''; 
  
      res.setEncoding('binary');
  
      res.on('data', function(chunk){
        imageData += chunk;
      });

      res.on('end', function(){
        resolve(imageData);
      });
    });
  });
};

const splitImage = (imageBuffer, numberOfParts) => {
  return new Promise((resolve, reject) => {
    Jimp.read(imageBuffer)
      .then((image) => {
        const { width, height } = image.bitmap;
        const partWidth = Math.floor(width / numberOfParts);
        const imageParts = [];

        for (let i = 0; i < numberOfParts; i++) {
          const startX = i * partWidth;
          const endX = (i === numberOfParts - 1) ? width : startX + partWidth;

          const imagePart = image.clone().crop(startX, 0, endX - startX, height).getBufferAsync(Jimp.MIME_JPEG);
          imageParts.push(imagePart);
        }

        Promise.all(imageParts)
          .then(resolve)
          .catch(reject);
      })
      .catch(reject);
  });
};

const uploadToS3 = (s3Key, imagePart) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: 'gitmosaic-user-profiles',
      Key: s3Key,
      Body: imagePart
    };

    s3.upload(params, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const saveToDynamoDB = (dynamoItems) => {
  return new Promise((resolve, reject) => {
    const params = {
      RequestItems: {
        'imageTable-dev': dynamoItems.map((item) => ({
          PutRequest: {
            Item: item
          }
        }))
      }
    };

    dynamodb.batchWrite(params, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};
