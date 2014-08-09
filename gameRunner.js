var MongoClient = require('mongodb').MongoClient;
var Q = require('q');
var Game = require('./GameScripts/Game.js');
var heroCommunicator = require('./heroCommunicator.js');

var mongoConnectionURL = process.env.CUSTOMCONNSTR_MONGO_URI || 'mongodb://localhost/javascriptBattle'
var mongoConnectionURL = 'mongodb://localhost/javascriptBattle';

var openGameDatabase = function() {
  return Q.ninvoke(MongoClient, 'connect', mongoConnectionURL).then(function(db) {
    console.log('open!');
    return {
      collection: db.collection('jsBattleGameData'),
      db: db
    };
  });
};

var addGameDataToDatabase = function(collection, gameData, date) {
  gameData.date = date;
  return Q.ninvoke(collection, 'insert', gameData).then(function(docs) {
    console.log('~~~~~~');
    console.log(docs);
    console.log('~~~~~~');
  }, function(err) {
    console.log(err);
  });
};

var getDateString = function() {
  var d = new Date();
  var result = (d.getMonth() + 1).toString();
  result += '/' + d.getDate();
  result += '/' + d.getFullYear();
  return result;
};

var runGame = function() {
  //Set up the game board

  var randomNumber = function(max) {
    return Math.floor(Math.random()*max);
  };

  var boardSize = 12;
  var game = new Game(boardSize);

  game.addHero(randomNumber(boardSize), randomNumber(boardSize), 'assassin', 0);
  game.addHero(randomNumber(boardSize), randomNumber(boardSize), 'miner', 0);
  game.addHero(randomNumber(boardSize), randomNumber(boardSize), 'miner', 0);
  game.addHero(randomNumber(boardSize), randomNumber(boardSize), 'miner', 0);
  game.addHero(randomNumber(boardSize), randomNumber(boardSize), 'miner', 0);

  for (var i=0; i<5; i++) {
    while (!game.addHero(randomNumber(boardSize), randomNumber(boardSize), 'random', 1)) {
      //Loops until each hero is successfully added
    }
  }
  for (var i=0; i<6; i++) {
    game.addHealthWell(randomNumber(boardSize), randomNumber(boardSize));
  }
  for (var i=0; i<18; i++) {
    game.addImpassable(randomNumber(boardSize), randomNumber(boardSize));
  }
  for (var i=0; i<12; i++) {
    game.addDiamondMine(randomNumber(boardSize), randomNumber(boardSize));
  }

  game.maxTurn = 2000;

  //Get today's date in string form
  var date = getDateString();

  //Manually set the ID so Mongo doesn't just keep writing to the same document
  game._id = game.turn + '|' + date;

  //Open up the database connection
  var openDatabasePromise = openGameDatabase();

  //After opening the database promise, 
  openDatabasePromise.then(function(mongoData) {
    //The collection we're inserting into
    var mongoCollection = mongoData.collection;
    //The database we're inserting into
    var mongoDb = mongoData.db;

    var resolveGameAndSaveTurnsToDB = function(game) {
      console.log('Turn: ' + game.turn);
      mongoCollection.update({
        '_id':game._id
      }, game, {
        upsert:true
      }, function(err, result) {
        if (err) {
          console.trace();
          console.log('---------')
          console.log(err);
        }

        //Get the current hero
        var activeHero = game.activeHero;

        //Get the direction the currently active hero
        //wants to move
        heroCommunicator.getNextMove(activeHero, game).then(function(direction) {

          //Advances the game one turn
          game.handleHeroTurn(direction);

          //Manually set the ID so Mongo doesn't just keep writing to the same document
          game._id = game.turn + '|' + date;

          if (game.ended) {
            mongoDb.close();
          } else {
            resolveGameAndSaveTurnsToDB(game);
          }
        }).catch(function(err) {
          console.log('Something went wrong!');
          console.log(err);
          console.trace(err);
          throw err;
        });
      });
    };

    resolveGameAndSaveTurnsToDB(game);

  }).catch(function(err) {
    console.trace();
    console.log('---------')
    console.log(err);
  });
};

runGame();