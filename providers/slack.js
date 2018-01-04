'use strict';

const Slack = require('slack');

exports.sendSlackMessage = function *(channel, message, attachments) {
    yield Slack.chat.postMessage({
        as_user: true,
        token: process.env.SLACK_BOT_TOKEN,
        text: message,
        channel,
        attachments
    });
};
