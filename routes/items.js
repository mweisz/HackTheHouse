// Database

var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSONPure;
var MongoClient = require('mongodb').MongoClient;

var db = new Db('hackTheHouse', new Server("127.0.0.1", 27017,
   {auto_reconnect: false, poolSize: 4}), {w:0, native_parser: false});


// Globals
var lastItem;
var lastUserName;
var lastWeight; 
var previousWeight = 0;


var users = {
    12344 : "Jonas"
}

var barcodes = {
    111 : "Coca Cola", 
    555 : "Milk"
}


// Establish connection to db
db.open(function(err, db) {
    if(err) { 
        return console.dir(err);
    } else {
        //opens the database and the categories collection

        // ITEMS
        db.createCollection('items', {safe:true}, function(err, collection) {
            if (err) {
                //TODO ESTO ESTA MAL NO FUNCIONA NUNCA
                console.log("The 'items' collection doesn't exist. Creating it with sample data...");
            } else {
                console.log("Collection 'items' exists.");
            }
        });

        // LAST ITEM
        db.createCollection('lastItem', {safe:true}, function(err, collection) {
            if (err) {
                //TODO ESTO ESTA MAL NO FUNCIONA NUNCA
                console.log("The 'lastItem' collection doesn't exist. Creating it with sample data...");
            } else {
                console.log("Collection 'lastItem' exists.");
            }
        });

        // CONSUMPTIONS
        db.createCollection('consumptions', {safe:true}, function(err, collection) {
            if (err) {
                //TODO ESTO ESTA MAL NO FUNCIONA NUNCA
                console.log("The 'consumptions' collection doesn't exist. Creating it with sample data...");
            } else {
                console.log("Collection 'consumptions' exists.");
            }
        });
    }
});


function goIfReady(){
    // Guard clauses
    if(lastUserName == undefined) return false; // check if user is logged in
    if(lastItem == undefined) return false;     // check if product has been checked in
    if(lastWeight == undefined) return false;   // check if new weight is available

    // Everything is ready
    updateFridge();

    // Reset values
    lastItem = undefined;
    lastWeight = undefined;
}

function updateFridge(){
    console.log("UPDATING FRIDGE....");
}

function onWeightUpdate(oldWeight, currentWeight){

    // Fetch last item
    /*var lastItem;
    db.collection('lastItem', function(err, collection) {
        if(err){
            console.log(err);
        } 

        collection.find().toArray(function (err, items) {
            if (err) console.log(err);
            console.log("in the array".green, items);
            lastItem = items[0];
            console.log("ITEM:".red, lastItem);
        });
    });*/

    var userName = lastUserName;
    var item = lastItem;

    var newItemWeight = currentWeight - oldWeight;


    // Check if item is already in the fridge
    db.collection('items', function(err, collection) {
        collection.find({itemId: item.itemId}).toArray(function(err, items) {
            if(items.length != 0){ // item IS already in the fridge

                // Get old weight of item
                var oldItemWeight = items[0].weight;
              

                // Update item with new weight in fridge
                collection.update({itemId: item.itemId},
                                     { $set: { weight: newItemWeight} } );


                // Save consumption for user
                var consumptionWeight = oldItemWeight - newItemWeight;
                item.weight = consumptionWeight;
                var consumption = {"userName": userName, "item": item };
                db.collection('consumptions', function(err, collection) {
                    collection.insert(consumption, {safe:true}, function(err, result) {
                        if (err) {
                            console.log(consumption + " couldn't be saved.")
                        } else {
                            console.log('Success: ' + JSON.stringify(result[0]));
                        }
                    });
                });


            } else{ // item is NOT in the fridge
                item.weight = newItemWeight;
               
                // SAVE INTO DB
                db.collection('items', function(err, collection) {
                    collection.insert(item, {safe:true}, function(err, result) {
                        if (err) {
                            console.log(item + " couldn't be saved.")
                        } else {
                            console.log('Success: ' + JSON.stringify(result[0]));
                        }
                    });
                });
            }
        });
    });
        
}


exports.postItem = function (req, res){
    var barcode = req.body.barcode;

    var myItem = JSON.parse(req.body.item);
    var user = req.body.user;


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


exports.lastProduct = function (req, res){
    // var productCode = JSON.parse(req.body.barcode);
    console.log(req.body);
    res.send(200);
    goIfReady();
}

// exports.postItem = function (req, res){
//     var myItem = JSON.parse(req.body.item);
    
//     lastItem = myItem;

//     res.send(200);
//     goIfReady();

//     // TEST CODE (mock incoming weight update)
//     //onWeightUpdate(0, 700);

// }

exports.postWeight = function (req, res){
    var weight = parseInt(req.body.weight);
    if(lastWeight != undefined) previousWeight = lastWeight;
    lastWeight = weight;
    console.log("Weight updated from " + previousWeight + " to " + weight);

    res.send(200);
    goIfReady();

    // TEST CODE (mock incoming weight update)
    //onWeightUpdate(0, 700);
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

exports.getConsumptionsByUserName = function (req, res){
    res.send(200);
    // console.log(req.params);

    // var id = parseInt(req.params.id);
    // console.log('Retrieving item: ' + id);
    // db.collection('items', function(err, collection) {
    //     if (err){
    //         console.log('not found');
    //     } else {
    //         collection.find({itemId: id}).toArray(function(err, items) {
    //                     console.log(items);
    //                     res.send(items[0]);
    //                  });
    //     }
    // });
}

exports.postLastId = function (req, res){
    var userId = parseInt(req.body.userId);
    var name = users[userId];
    console.log(name + " just logged in." );
    lastUserName = name;

    res.send(200);
    goIfReady();
}

