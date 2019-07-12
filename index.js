// todo: refactor
const backlog_domain = process.env.BACKLOG_URL;
const webhook_url = process.env.SLACK_WEBHOOK_URL;
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
    case 2:
        return build_updated_issue(body);
    case 3:
        return build_commented_issue(body);
    case 4:
        return build_deleted_issue(body);
    case 14:
        return build_bulk_updated_issues(body);
    default:
        return JSON.stringify(body);
    }
};

const build_added_issue = (body) => {
    return {
        text: `[${body.project.name}] 新しい課題が追加されました`,
        attachments: [{
            color: "good",
            title: issue_title(body),
            title_link: backlog_url(body),
            text: body.content.description,
            fields: [{
                title: "担当者",
                value: (body.content.assignee || {}).name || "( - )",
                short: true
            }, {
                title: "登録者",
                value: body.createdUser.name,
                short: true
            }, {
                title: "種別",
                value: (body.content.issueType || {}).name || "( - )",
                short: true
            }, {
                title: "カテゴリー",
                value: body.content.category.map(c => c.name).join(", ") || "( - )",
                short: true
            }, {
                title: "マイルストーン",
                value: body.content.milestone.map(m => m.name).join(", ") || "( - )",
                short: true
            }, {
                title: "状態",
                value: body.content.status.name || "( - )",
                short: true
            }, {
                title: "優先度",
                value: (body.content.priority || {}).name || "( - )",
                short: true
            }, {
                title: "期限日",
                value: body.content.dueDate || "( - )",
                short: true
            }]
        }]
    };
};

const build_updated_issue = (body) => {
    var fields_changes = build_changes(body);
    var fields_default =
        [{
            title: "コメント",
            value: (body.content.comment || {}).content || "なし"
        }, {
            title: "担当者",
            value: (body.content.assignee || {}).name || "未定",
            short: true
        }, {
            title: "更新者",
            value: body.createdUser.name,
            short: true
        }];

    return {
        text: `[${body.project.name}] 課題が更新されました`,
        attachments: [{
            color: "warning",
            title: issue_title(body),
            title_link: backlog_url(body),
            fields: fields_changes.concat(fields_default)
        }]
    };
};

const build_bulk_updated_issues = (body) => {
    var fields_changes = build_changes(body);
    var fields_issue_list =
        [{
            title: "変更された課題リスト",
            value: body.content.link.map(l => `<${backlog_url(body, l.key_id)}|${key_name(body, l.key_id)}: ${l.title}>`).join("\n")
        }];
    var fields_default =[
        {
            title: "コメント",
            value: (body.content.comment || {}).content || "なし"
        }, {
            title: "担当者",
            value: (body.content.assignee || {}).name || "未定",
            short: true
        }, {
            title: "更新者",
            value: body.createdUser.name,
            short: true
        }];

    return {
        text: `[${body.project.name}] 課題が一括更新されました`,
        attachments: [{
            color: "#cc9",
            fields: fields_issue_list.concat(fields_changes).concat(fields_default)
        }]
    };
};

const build_commented_issue = (body) => {
    return {
        text: `[${body.project.name}] 課題にコメントが追加されました`,
        attachments: [{
            color: "#33c",
            title: issue_title(body),
            title_link: backlog_url(body),
            fields: [{
                title: "コメント",
                value: body.content.comment.content
            }, {
                title: "担当者",
                value: (body.content.assignee || {}).name || "未定",
                short: true
            }, {
                title: "登録者",
                value: body.createdUser.name,
                short: true
            }]
        }]
    };
};

const build_deleted_issue = (body) => {
    return {
        text: `[${body.project.name}] 課題が削除されました`,
        attachments: [{
            color: "danger",
            title: backlog_url(body),
            fields: [{
                title: "更新者",
                value: body.createdUser.name,
                short: true
            }]
        }]
    };
};

const state_label = (num) => {
    switch(num) {
    case '1': return '未処理';
    case '2': return '処理中';
    case '3': return '処理済み';
    case '4': return '完了';
    default: return num;
    }
};

const priority_label = (num) => {
    switch(num) {
    case '2': return '高';
    case '3': return '中';
    case '4': return '低';
    default: return num;
    }
};

const resolution_label = (num) => {
    switch(num) {
    case '0': return '対応済み';
    case '1': return '対応しない';
    case '2': return '無効';
    case '3': return '重複';
    case '4': return '再現しない';
    default: return num;
    }
};

const build_changes = (body) => {
    return body.content.changes.map(change => build_change_field(change));
};

const build_change_field = (change) => {
    switch(change.field) {
    case 'summary':
        return { title: '件名', value: `${change.old_value} => ${change.new_value}` };
    case 'issueType':
        return { title: '種別', value: `${change.old_value || '( - )'} => ${change.new_value || '( - )'}`, short: true };
    case 'description':
        const diffLines = diff.diffLines(change.old_value, change.new_value);
        let text = '';
        diffLines.forEach( (d) => {
            if(!d.value.match((/^\n+$/))) {
                if(d.added) {
                  text += `+ ${d.value.trim().replace(/\n/g, '\n  ')}\n`;
                } else if (d.removed) {
                  text += `- ~${d.value.trim().replace(/\n/g, '~\n  ~')}~\n`;
                }
            }
        });
        return { title: '詳細', value: text, short: false };
    case 'component':
        return { title: 'カテゴリー', value: `${change.old_value || '( - )'} => ${change.new_value || '( - )'}`, short: true };
    case 'version':
        return { title: '発生バージョン', value: `${change.old_value || '( - )'} => ${change.new_value || '( - )'}`, short: true };
    case 'milestone':
        return { title: 'マイルストーン', value: `${change.old_value || '( - )'} => ${change.new_value || '( - )'}`, short: true };
    case 'status':
        return { title: '状態', value: `${state_label(change.old_value) || '( - )'} => ${state_label(change.new_value) || '( - )'}`, short: true };
    case 'assigner':
        return { title: '担当者', value: `${change.old_value || '( - )'} => ${change.new_value || '( - )'}`, short: true };
    case 'startDate':
        return { title: '開始日', value: `${change.old_value || '( - )'} => ${change.new_value || '( - )'}`, short: true };
    case 'limitDate':
        return { title: '期限日', value: `${change.old_value || '( - )'} => ${change.new_value || '( - )'}`, short: true };
    case 'priority':
        return { title: '優先度', value: `${priority_label(change.old_value) || '( - )'} => ${priority_label(change.new_value) || '( - )'}`, short: true };
    case 'resolution':
        return { title: '完了理由', value: `${resolution_label(change.old_value) || '( - )'} => ${resolution_label(change.new_value) || '( - )'}`, short: true };
    case 'estimatedHours':
        return { title: '予定時間', value: `${change.old_value || '( - )'} => ${change.new_value || '( - )'}`, short: true };
    case 'actualHours':
        return { title: '実績時間', value: `${change.old_value || '( - )'} => ${change.new_value || '( - )'}`, short: true };
    default:
        return { title: change.field, value: `${change.old_value || '( - )'} => ${change.new_value || '( - )'}` };
    }
};

exports.backlog2slack = (req, res) => {
    console.log(JSON.stringify(req.body));

    const body = req.body;
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
};
