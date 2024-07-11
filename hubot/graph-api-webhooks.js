module.exports = function(robot) {

  robot.router.get(['/facebook', '/instagram'], function(req, res) {
    if (req.param('hub.mode') === 'subscribe' && req.param('hub.verify_token') === 'token') {
      res.send(req.param('hub.challenge'));
    } else {
      res.sendStatus(400);
    }
  });

  robot.router.post('/facebook', function(req, res) {
    if (req.body.entry[0].changes[0].value.verb === 'add' && req.body.entry[0].changes[0].value.item === 'status') {
      res.sendStatus(200);
      const pageId = req.body.entry[0].id;
      const postId = req.body.entry[0].changes[0].value.post_id;
      robot.http(`https://graph.facebook.com/${pageId}?access_token=${process.env.FACEBOOK_APP_ACCESS_TOKEN}`)
        .header('Accept', 'application/json')
        .get()(function(err, res, body) {
          body = JSON.parse(body);
          robot.messageRoom(`${process.env.REAL_TIME_ROOM}`, `New post on ${body.name} Page: https://www.facebook.com/${postId.split('_')[1]}.`);
          // Wait some time before pulling post stats
          setTimeout(function() {
            robot.http(`https://graph.facebook.com/${postId.split('_')[1]}/likes?summary=true&access_token=${process.env.FACEBOOK_APP_ACCESS_TOKEN}`)
              .header('Accept', 'application/json')
              .get()(function(err, res, body) {
                body = JSON.parse(body);
                let likes = 0;
                if (body.summary) {
                  likes = body.summary.total_count;
                }
                robot.messageRoom(`${process.env.REAL_TIME_ROOM}`, `After ${process.env.WAIT_MINUTES} minutes, the Facebook post https://www.facebook.com/${postId.split('_')[1]} has ${likes} likes.`);
              });
          }, process.env.WAIT_MINUTES * 60000);
        });
    } else {
      res.sendStatus(400);
    }
  });
}