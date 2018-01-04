# kingpong
Slack App for keeping score of Ping-Pong in the Office.

This is the result from Flitsmeister Hackathon 2017.
Video: https://flitsmeister.github.io/kingpong/

Core contributors:
- [@ivoduits](https://github.com/ivoduits)
- [@rubenmx](https://github.com/rubenmx)
- [@nickmeessen](https://github.com/nickmeessen)
- [@bramerto](https://github.com/bramerto)

Free for public use and PR's are welcome!

## Installation Guide
- Copy .env.example to .env
- Set Slack credentials in .env file.
- Setup a MySQL database with the following structure and enter credentials in .env

```sql
CREATE TABLE `matches` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `player1_id` varchar(255) DEFAULT '',
  `player2_id` varchar(255) DEFAULT '',
  `winner_id` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4;

CREATE TABLE `matches_validation` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `match_id` int(11) NOT NULL,
  `winner_id` varchar(255) DEFAULT NULL,
  `loser_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4;

CREATE TABLE `players` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `playerId` varchar(255) DEFAULT '',
  `playerName` varchar(255) DEFAULT '',
  `score` int(11) NOT NULL DEFAULT '1000',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4;
```

## Slack Commands
- /kingpong register (register current player)
- /kingpong challenge @playername (challenge player)
- /kingpong leaderboard (prints the current leaderboard)

## Contributing
We use a ESLint file (https://github.com/flitsmeister/fm-eslint) to enforce a code standard, and we try to use most of ES6 features.

- Fork the repo.
- Make improvements.
- Create PR.
- Wait for code-review and PR approval.
- Rejoice and repeat :-)


