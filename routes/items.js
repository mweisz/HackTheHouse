// Database

var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSONPure;
var MongoClient = require('mongodb').MongoClient;

var db = new Db('hackTheHouse', new Server("127.0.0.1", 27017,
   {auto_reconnect: false, poolSize: 4}), {w:0, native_parser: false});

// Establish connection to db
db.open(function(err, db) {
    if(err) { 
        return console.dir(err);
    } else {
    //opens the database and the categories collection
    db.createCollection('items', {safe:true}, function(err, collection) {
        if (err) {
            //TODO ESTO ESTA MAL NO FUNCIONA NUNCA
            console.log("The 'categories' collection doesn't exist. Creating it with sample data...");
        } else {
            console.log("Collection 'categories' exists.");
        }
    });
}
});





exports.postItem = function (req, res){
    console.log(req.body);
    var myItem = JSON.parse(req.body.item);

    console.log('Adding Item: ' + JSON.stringify(myItem));
    db.collection('items', function(err, collection) {
        collection.insert(myItem, {safe:true}, function(err, result) {
            if (err) {
                res.send({'error':'An error has occurred'});
            } else {
                console.log('Success: ' + JSON.stringify(result[0]));
                res.send(result[0]);
            }
        });
    });


}

exports.getItems = function (req, res){
    console.log(req.params);

    console.log('Retrieving all items:');
    db.collection('items', function(err, collection) {
        collection.find().toArray(function(err, items) {
            console.log(items);
            res.send(items);
        });
    });
}

exports.getItemById = function (req, res){
    console.log(req.params);

    var id = parseInt(req.params.id);
    console.log('Retrieving item: ' + id);
    db.collection('items', function(err, collection) {
        if (err){
            console.log('not found');
        } else {
            collection.find({itemId: id}).toArray(function(err, items) {
                        console.log(items);
                        res.send(items[0]);
                     });
        }
    });
}

