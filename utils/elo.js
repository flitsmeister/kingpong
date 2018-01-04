'use strict';

const K = 20;

module.exports.calcElo = (matchData) => {

    const player1 = matchData.player1;
    const player2 = matchData.player2;

    const E1 = calcExpectedScore(player1.elo, player2.elo).toFixed(2);
    const E2 = calcExpectedScore(player2.elo, player1.elo).toFixed(2);

    const player1NewElo = calcNewElo(player1, matchData.winnerId, E1);
    const player2NewElo = calcNewElo(player2, matchData.winnerId, E2);

    return {player1NewElo, player2NewElo};
};

const calcTransElo = (elo) => Math.pow(10, elo / 400);

const calcExpectedScore = (player1Elo, player2Elo) => {

    const TR1 = calcTransElo(player1Elo);
    const TR2 = calcTransElo(player2Elo);

    return TR1 / (TR1 + TR2);
};

const calcNewElo = (player, winnerId, E) => {
    const win = (player.id === winnerId) ? 1 : 0;
    return player.elo + K * (win - E);
};
