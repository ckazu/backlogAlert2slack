// todo: refactor
const backlog_domain = process.env.BACKLOG_URL;
const webhook_url = process.env.SLACK_WEBHOOK_URL;
const extract_regexp = process.env.EXTRACT_REGEXP;
const request = require('request');
const diff = require('diff');

const key_name = (body, key_id) => {
  if(key_id) {
    return `${body.project.projectKey}-${key_id}`;
  } else {
    return `${body.project.projectKey}-${body.content.key_id}`;
  }
};

const backlog_url = (body, key_id) => {
  if(key_id) {
    return `${backlog_domain}/view/${body.project.projectKey}-${key_id}`;
  } else {
    return `${backlog_domain}/view/${key_name(body)}`;
  }
};

const issue_title = (body) => {
  return `${key_name(body)}: ${body.content.summary}`;
};

const build_response_json = (body) => {
  switch(body.type) {
    case 1:
      return build_added_issue(body);
    default:
      return JSON.stringify(body);
  }
};

const build_added_issue = (body) => {
  return {
    text: `[${body.project.name}] 新たな進行不能かクラッシュが報告されました。`,
    attachments: [{
      color: "danger",
      title: issue_title(body),
      title_link: backlog_url(body),
      text: body.content.description,
    }]
  };
};

exports.backlogAlert2slack = (req, res) => {
  console.log(JSON.stringify(req.body));

  const body = req.body;

  const regexp = new RegExp(extract_regexp);
  if(!(body.content.summary.match(regexp) || body.content.description.match(regexp))) {
    res.status(200).end();
  } else {
    var response = build_response_json(body);

    console.log(JSON.stringify(response));

    request.post({
      uri: webhook_url,
      headers: { 'Content-Type': 'application/json' },
      json: response
    }, function(error, response, body){
      if (!error && response.statusCode === 200) {
        // console.log(body);
      } else {
        console.log('error');
        console.log(body);
      }
      res.status(200).end();
    });
  }
};
