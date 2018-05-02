'use strict';

const Sync = require('yield-yield');

const Mysql = require('../providers/mysql');
const Slack = require('../providers/slack');

const Elo = require('../utils/elo');

const DAYS_INACTIVE = 10;

const challengeFinishedText = [
    '*p1* has beaten *p2* again',
    '*p1* has destroyed *p2* without mercy!',
    '*p1* has defeated *p2* in an epic battle!',
    '*p1* has bested *p2* in a fight for his life.',
    '*p1* didn’t suck, *p2* did.',
    '*p1* smashed *p2* out of the game.',
    '*p1* humiliated *p2*, awkward.. ',
    '*p1* made *p2* cry again.',
    '*p1* 1, *p2* 0.',
    '*p1* embarrassed *p2*.',
    '*p1* showed *p2* how it’s done.',
    '*p1* left *p2* in the gutter.',
    '*p1* dishonoured *p2*\'s pride'
];

const getLeaderBoardString = function *() {

    let leaderboard = '*```LEADERBOARD```* ';

    // Only show players in the leaderboard if they played a game in the last 10 days
    const rows = yield Mysql.instance.query('SELECT * FROM players WHERE updated_at > ? ORDER BY score DESC', [new Date(new Date().getTime() - (DAYS_INACTIVE * 1000 * 60 * 60 * 24))]);

    let i = 1;

    for (const row of rows) {

        const wins = yield Mysql.instance.query('SELECT COUNT(*) as count FROM matches where winner_id = ?', [row.playerId]);
        const losses = yield Mysql.instance.query('SELECT COUNT(*) as count FROM matches where winner_id IS NOT NULL AND (player1_id = ? OR player2_id = ?) AND (winner_id != ?)', [row.playerId, row.playerId, row.playerId]);

        if (wins[0].count > 0 || losses[0].count > 0) {
            leaderboard = leaderboard.concat(`*#${i} \`${row.score}\` ${(i == 1) ? ':crown:' : ''} <@${row.playerId}>* - _${wins[0].count} wins, ${losses[0].count} losses_ \n`);
        }
        i++;
    }

    return leaderboard.concat('_```These players were active in the past ' + DAYS_INACTIVE + ' days.```_\r\n');
};

const getMatchIdForPlayers = function *(playerId1, playerId2) {
    const result = yield Mysql.instance.query('SELECT id as match_id FROM matches WHERE (player1_id = ? AND player2_id = ?) OR (player2_id = ? AND player1_id = ?) ORDER BY created_at DESC LIMIT 1', [playerId1, playerId2, playerId1, playerId2]);
    if (result.length > 0) {
        return result[0].match_id;
    }

    return -1;
};

const getPlayerFromId = function *(playerId) {
    const result = yield Mysql.instance.query('SELECT * FROM players WHERE playerId = ?', [playerId]);
    if (result.length > 0) {
        return result[0];
    }

    return null;
};

const announceWinner = function *(matchId, ratingPlayerId, winner, loser) {
    const validationResult = yield Mysql.instance.query('SELECT * FROM matches_validation WHERE match_id = ?', [matchId]);
    const isWinner = ratingPlayerId === winner.playerId;

    let validation = null;
    if (validationResult.length > 0)
        validation = validationResult[0];

    if (validation !== null) {
        if ((isWinner && validation.winner_id !== null) || (!isWinner && validation.loser_id !== null)) {
            // already filled in.
            return;
        }

        if (isWinner) {
            yield Mysql.instance.query('UPDATE matches_validation SET winner_id = ? WHERE match_id = ?', [winner.playerId, matchId]);
        } else {
            yield Mysql.instance.query('UPDATE matches_validation SET loser_id = ? WHERE match_id = ?', [winner.playerId, matchId]);
        }

    } else if (isWinner) {
        yield Mysql.instance.query('INSERT INTO matches_validation(match_id, winner_id) VALUES(?, ?)', [matchId, winner.playerId]);
    } else {
        yield Mysql.instance.query('INSERT INTO matches_validation(match_id, loser_id) VALUES(?, ?)', [matchId, winner.playerId]);
    }

    const updatedValidationResult = yield Mysql.instance.query('SELECT * FROM matches_validation WHERE match_id = ?', [matchId]);
    if (updatedValidationResult.length > 0) {
        const matchValidation = updatedValidationResult[0];
        if (matchValidation.winner_id !== null && matchValidation.loser_id !== null) {
            if (matchValidation.winner_id === matchValidation.loser_id) {
                // WINNER IS DECIDED YAY!
                yield Mysql.instance.query('UPDATE matches SET winner_id = ? WHERE id = ?', [winner.playerId, matchId]);

                const matchData = {
                    player1: {id: winner.playerId, elo: winner.score},
                    player2: {id: loser.playerId, elo: loser.score},
                    winnerId: winner.playerId
                };
                const newElo = Elo.calcElo(matchData);

                yield Mysql.instance.query('UPDATE players SET score = ? WHERE playerId = ?', [newElo.player1NewElo, winner.playerId]);
                yield Mysql.instance.query('UPDATE players SET score = ? WHERE playerId = ?', [newElo.player2NewElo, loser.playerId]);

                const leaderboard = yield getLeaderBoardString();
                const content = `The match is finished. Current standings:\n${leaderboard}`;

                yield Slack.sendSlackMessage(winner.playerId, content);
                yield Slack.sendSlackMessage(loser.playerId, content);

                // TODO: later, fix slackbot permissions.
                // const randomText = challengeFinishedText[Math.floor(Math.random() * challengeFinishedText.length)];
                // randomText.replace('*p1*', 'PlayerOne');
                // randomText.replace('*p2*', 'PlayerTwo');

                // yield sendSlackMessage('#fm-test', randomText);

            } else {
                // SOMEONE CHEATED!!
                // Print something in #public to shame cheaters.
            }
        }
    }
};


const registerPlayer = function *(request, slackMessage, h) {

    const userExists = yield Mysql.instance.query('SELECT id FROM players WHERE playerId = ?', [slackMessage.user_id]);

    if (userExists.length > 0) {
        // TODO: deze moet ook naar handler toe.
        return h.response('Are you kidding me? You are already registered! Go play some :pingpong:');
    }

    yield Mysql.instance.query('INSERT INTO players(playerId, playerName) VALUES(?, ?)', [slackMessage.user_id, slackMessage.user_name]);

    return h.response();
};

const acceptChallenge = function *(payload) {

    let accepted = false;
    let challengerPlayerId = '';
    const opponentPlayerId = payload.user.id;

    if (payload.actions.length > 0) {
        const values = payload.actions[0].value.split(';');
        if (values.length > 0) {
            accepted = values[0] === 'accept';
        }

        if (values.length > 1) {
            challengerPlayerId = values[1];
        }
    }

    if (challengerPlayerId.length === 0) {
        // TODO slack error .
        throw new Error('challenge player not found');
    }

    yield Slack.updateChat(payload.channel.id, payload.original_message.ts,
        accepted ? [{
            fallback: `You have accepted the challenge from <@${challengerPlayerId}> :smirk:`,
            text: `You have accepted the challenge from <@${challengerPlayerId}> :smirk:`,
            image_url: 'https://assets.flitsmeister.nl/kingpong/challenge-accepted.png',
            color: '#90D748'
        }] : [{
            text: `You are a coward! <@${challengerPlayerId}> is disappointed in you. :confused:`,
        }]);

    if (!accepted) return '';

    const matchInsert = yield Mysql.instance.query('INSERT INTO matches(player1_id, player2_id) VALUES(?, ?)', [challengerPlayerId, opponentPlayerId]);
    const matchId = matchInsert.insertId;

    setTimeout(() => {
        Sync.run(function *() {
            const challenger = yield getPlayerFromId(challengerPlayerId);
            const opponent = yield getPlayerFromId(opponentPlayerId);

            // TODO: right matchId, now just taking the last one, maybe good enough?
            // const matchId = yield getMatchIdForPlayers(challengerPlayerId, opponentPlayerId)

            const attachments = [
                {
                    'text': 'So, who is the winner? Be honest :wink:',
                    'fallback': 'Who won the match?',
                    'callback_id': 'challenge_result',
                    'actions': [
                        {
                            'name': 'result',
                            'text': `${challenger.playerName}`,
                            'type': 'button',
                            'value': `${matchId};${challengerPlayerId};${opponentPlayerId}`,
                            'style': 'default'
                        },
                        {
                            'name': 'result',
                            'text': `${opponent.playerName}`,
                            'style': 'default',
                            'type': 'button',
                            'value': `${matchId};${opponentPlayerId};${challengerPlayerId}`
                        }
                    ]
                }
            ];

            yield Slack.sendSlackMessage(challengerPlayerId, '', attachments);
            yield Slack.sendSlackMessage(opponentPlayerId, '', attachments);
        });

    }, 1000 * 60);

    yield Slack.sendSlackMessage(challengerPlayerId, '', accepted ? [
        {
            fallback: `Your challenge has been accepted by <@${opponentPlayerId}>!`,
            text: `Your challenge has been accepted by <@${opponentPlayerId}>!`,
            image_url: 'https://assets.flitsmeister.nl/kingpong/challenge-accepted.png',
            color: '#90D748'
        }
    ] : [
        {
            fallback: `Your challenge has been declined by <@${opponentPlayerId}>!`,
            text: `Your challenge has been declined by <@${opponentPlayerId}>!`,
            image_url: 'https://assets.flitsmeister.nl/kingpong/pussy-out.png',
            color: 'danger'
        }
    ]);

    return '';
};

const finishChallenge = function *(payload) {

    const ratingPlayerId = payload.user.id;

    yield Slack.updateChat(payload.channel.id, payload.original_message.ts, [
        {
            'text': 'Thanks! I hope you didn\'t cheat :wink:'
            // TODO: better texts
        }
    ]);

    if (payload.actions.length > 0) {
        const values = payload.actions[0].value.split(';');
        if (values.length > 2) {
            const matchId = values[0];
            const winner = yield getPlayerFromId(values[1]);
            const loser = yield getPlayerFromId(values[2]);

            yield announceWinner(matchId, ratingPlayerId, winner, loser);
        }
    }

    return '';
};

module.exports = {
    getLeaderBoardString,
    getPlayerFromId,
    announceWinner,
    registerPlayer,
    acceptChallenge,
    finishChallenge
};