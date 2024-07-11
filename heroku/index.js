/**
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

const bodyParser = require('body-parser');
const express = require('express');
const xhub = require('express-x-hub');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'));

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

const token = process.env.TOKEN || 'token';
const received_updates = [];

app.get('/', function(req, res) {
  console.log(req);
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
});

app.get(['/facebook', '/instagram'], (req, res) => {
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

app.post('/facebook', async (req, res) => {
  console.log('Facebook request body:', req.body);

  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }

  console.log('request header X-Hub-Signature validated');
  received_updates.unshift(req.body);

  if (req.body.entry[0].changes[0].value.verb === 'add' && req.body.entry[0].changes[0].value.item === 'status') {
    res.sendStatus(200);
    const pageId = req.body.entry[0].id;
    const postId = req.body.entry[0].changes[0].value.post_id;

    try {
      const pageResponse = await axios.get(`https://graph.facebook.com/${pageId}?access_token=${process.env.FACEBOOK_APP_ACCESS_TOKEN}`);
      const pageName = pageResponse.data.name;
      const messageRoom = (room, message) => {
        console.log(`Message to ${room}: ${message}`); // Replace with actual room messaging logic
      };
      
      messageRoom(process.env.REAL_TIME_ROOM, `New post on ${pageName} Page: https://www.facebook.com/${postId.split('_')[1]}.`);

      setTimeout(async () => {
        try {
          const likesResponse = await axios.get(`https://graph.facebook.com/${postId.split('_')[1]}/likes?summary=true&access_token=${process.env.FACEBOOK_APP_ACCESS_TOKEN}`);
          const likes = likesResponse.data.summary ? likesResponse.data.summary.total_count : 0;
          messageRoom(process.env.REAL_TIME_ROOM, `After ${process.env.WAIT_MINUTES} minutes, the Facebook post https://www.facebook.com/${postId.split('_')[1]} has ${likes} likes.`);
        } catch (err) {
          console.error('Error fetching likes:', err);
        }
      }, process.env.WAIT_MINUTES * 60000);

    } catch (err) {
      console.error('Error fetching page info:', err);
    }
  } else {
    res.sendStatus(400);
  }
});

app.get('/hello-world', async function(req, res) {
  const phoneNumber = '790222683';
  const messageContent = 'hello world';
  const accessToken = process.env.FACEBOOK_APP_ACCESS_TOKEN; // Ensure this token has permissions to send WhatsApp messages

  try {
    const response = await axios.post(`https://graph.facebook.com/v20.0/398681919986082/messages`, {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { body: messageContent }
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200) {
      res.send('Message sent successfully');
    } else {
      res.status(response.status).send('Failed to send message');
    }
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).send('Internal Server Error');
  }
});

console.log(process.env.APP_SECRET);
app.listen()