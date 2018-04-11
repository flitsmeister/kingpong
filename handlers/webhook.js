'use strict';

const KingPong = require('../controllers/kingpong');
const Mysql = require('../providers/mysql');
const Slack = require('../providers/slack');

const leaderboard = function *(request, h) {
    return h
        .response({
            'text': yield KingPong.getLeaderBoardString(),
            'mrkdwn': true
        })
        .header('Content-Type', 'application/json');
};

const challenge = function *(request, slackMessage, h) {

    const challengingPlayer = yield KingPong.getPlayerFromId(slackMessage.user_id);

    if (challengedPlayerId.toLowerCase == "winner") {
        const challengedPlayerName = yield Mysql.instance.query('SELECT * FROM players ORDER BY score DESC')[0];

        yield sendSlackMessage(challengedPlayerName, slackMessage);

        return h
        .response(`You have challenged the King aka <${challengedPlayerName}>! Please wait for a response...`)
        .header('Content-Type', 'application/json');
    }

    if (challengingPlayer === null) {
        return h
            .response({
                'attachments': [
                    {
                        fallback: 'Something went wrong with the challenge!',
                        text: 'You need to register first before challenging someone. Enter \'/kingpong register\' to register.',
                        color: 'danger'
                    }
                ]
            })
            .header('Content-Type', 'application/json');
    }

    const challengedPlayerName = slackMessage.text.split(' ').pop();
    const challengedPlayerIdResult = yield Mysql.instance.query('SELECT playerId FROM players where playerName = ? LIMIT 1', [challengedPlayerName.replace('@', '')]);

    let challengedPlayerId = '';
    if (challengedPlayerIdResult.length > 0) {
        challengedPlayerId = challengedPlayerIdResult[0].playerId;
    }

    if (challengedPlayerId.length === 0) {
        return h.response({
            'attachments': [
                {
                    fallback: `No registered players with the name <${challengedPlayerName}> were found. Try again or let them join!`,
                    text: `No registered players with the name <${challengedPlayerName}> were found. Try again or let them join!`,
                    image_url: 'https://assets.flitsmeister.nl/kingpong/404-PlayerNotFound.png',
                    color: 'danger'
                }
            ]
        })
            .header('Content-Type', 'application/json');
    }

    yield sendSlackMessage(challengedPlayerId, slackMessage);

    return h
    .response(`You have challenged <${challengedPlayerName}>! Please wait for a response...`)
    .header('Content-Type', 'application/json');

};

const sendSlackMessage = function *(challengedPlayerName, slackMessage) {
  yield Slack.sendSlackMessage(challengedPlayerName, '',
        [
            {
                'text': `<@${slackMessage.user_id}> challenges you for a ping pong match. Do you accept? Or pussy out? :smirk:`,
                'fallback': 'You have been challenged for a ping pong match!',
                'callback_id': 'challenge_accept',
                'actions': [
                    {
                        'name': 'game',
                        'text': 'Game On!',
                        'type': 'button',
                        'value': `accept;${slackMessage.user_id}`,
                        'style': 'primary'
                    },
                    {
                        'name': 'game',
                        'text': 'Pussy Out!',
                        'style': 'danger',
                        'type': 'button',
                        'value': `decline;${slackMessage.user_id}`
                    }
                ]
            }
        ]);
}

const registerPlayer = function *(request, slackMessage, h) {
    yield KingPong.registerPlayer(request, slackMessage, h);
    return h.response('You pledged your loyality to me, good job!');
};

const parseSlackCommand = function *(request, h) {

    const payload = request.payload;
    const command = payload.text ? payload.text.split(' ').shift() : null;

    switch (command) {
        case 'leaderboard': return yield leaderboard(request, h);
        case 'register': return yield registerPlayer(request, payload, h);
        case 'challenge': return yield challenge(request, payload, h);
        default: {
            return h.response({
                'attachments': [
                    {
                        image_url: 'https://assets.flitsmeister.nl/kingpong/404-USpeakNoApe.png',
                        color: 'danger',
                        pretext: `Oops, ${command} is not a valid command.`
                    }
                ]
            })
                .header('Content-Type', 'application/json');
        }
    }
};

const parseSlackHook = function *(request, h) {

    const payload = JSON.parse(request.payload.payload);

    switch (payload.callback_id) {
        case 'challenge_accept' : return yield KingPong.acceptChallenge(payload);
        case 'challenge_result' : return yield KingPong.finishChallenge(payload);
        default: return h.response();
    }
};

module.exports = {
    parseSlackCommand,
    parseSlackHook
};
