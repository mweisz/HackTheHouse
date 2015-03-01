// Database

var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSONPure;
var MongoClient = require('mongodb').MongoClient;
var request = require('request');


// Relayr stuff
var Relayr = require('relayr');

var app_id = "be38eecf-79f4-4d18-aa83-88fe1a8043ea";
var dev_id = "2d89b26b-f2d5-4b67-a535-04b3fe2fe1f7";
var token  = "J4M1btoT1.qac-lRqATjiONcVNBy1_mr";
var relayr = new Relayr(app_id);
relayr.connect(token, dev_id);
var counter = 0;    



relayr.on('data', function (topic, msg) {
        var val = parseInt(msg.readings[0].value.charCodeAt(0)) * 42 - 584;
        var threshold = 30;
        if (Math.abs(lastweight - val) > threshold) {
            counter++;
            if(counter > 2){
                console.log("OLD: " + lastWeight + ". NEW:" + val);
                previousWeight = lastWeight;
                lastWeight = val;
                goIfReady();
                counter  = 0;
            }
        }
        
});


var db = new Db('hackTheHouse', new Server("127.0.0.1", 27017,
 {auto_reconnect: false, poolSize: 4}), {w:0, native_parser: false});


// Globals
var lastProductCode;
var lastUserId;
var lastWeight = undefined; 
var previousWeight = 0;


var users = {
    122 : "Jonas",
    123 : "User B"
}

var barcodes = {
    111 : "Coca Cola", 
    555 : "Milk",
    4013143081078 : "Mineral Water"
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
    console.log("user:" + lastUserId + ". product: " + lastProductCode + ". lastweight: " + lastWeight);
    if(lastUserId == undefined) return;     // check if user is logged in
    if(lastProductCode == undefined) return;  // check if product has been checked in
    if(lastWeight == undefined) return;       // check if new weight is available

    // Everything is ready
    go();
}

function go(){
    console.log("GO");
    var productWeight = lastWeight - previousWeight;
    // New product (not in fridge already)
    isNewProduct(lastProductCode, function ok (){
        insertIntoFridge(lastProductCode, productWeight);

        // Reset values
        lastProductCode = undefined;
        lastWeight = undefined;
    }, function nok () {
        calculateProductWeightDifference(lastProductCode, productWeight, function finished (diff) {
            // Update user consumption
            addUserConsumption(lastProductCode, diff, lastUserId);
            updateFridge(lastProductCode, lastWeight);

            // Reset values
            lastProductCode = undefined;
            lastWeight = undefined;
        });

        
    });

}

function isNewProduct(productCode, ok, nok){
    db.collection('items', function(err, collection) {
        collection.find({itemId: lastProductCode}).toArray(function(err, items) {
           if (items.length > 0){
            nok();
        } else{
            ok();
        }
    });
    });
    // var doc = db.runCommand(  {count: 'items', query : {itemId: lastProductCode}});

}

function insertIntoFridge(productCode, productWeight){
    //insert into db
    var item = { itemId : productCode, weight: productWeight }
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

function calculateProductWeightDifference(productCode, weight, cb){
    db.collection('items', function(err, collection) {
        collection.find({itemId: productCode}).toArray(function(err, items) {
            cb(items[0].weight - weight);
        });
    });
}

function addUserConsumption(productCode, productWeightDifference, user){
    var wolframAlphaData = lookupNutritionFacts(productCode, productWeightDifference);
    var consumption = {name : barcodes[productCode], amount: productWeightDifference, nutritionFacts: wolframAlphaData,
      userId: user };

    // save in db
    db.collection('consumptions', function(err, collection) {
        collection.insert(consumption, {safe:true}, function(err, result) {
            if (err) {
                console.log(consumption + " couldn't be saved.")
            } else {
                console.log('Success: ' + JSON.stringify(result[0]));
            }
        });
    });
}


function updateFridge(productCode, productWeight){
    db.collection('items', function(err, collection) {
        collection.find({itemId: productCode}).toArray(function(err, items) {
            // Update item with new weight in fridge
            collection.update({itemId: productCode},
               { $set: { weight: productWeight} } );
        });
    });
}

function lookupNutritionFacts(productCode, amount){
    var productName = barcodes[productCode];
    // Call Wolfram Alpha
    var url = "http://api.wolframalpha.com/v2/query?appid=7TPW94-3WQTJLGR7E&input="+ amount + "%20g%20of%20"+ productName +"&format=plaintext";

    request(url, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        return parseWolframAlpha(body); // Show the HTML for the Google homepage. 
      }
    })


    //return { carbohidrates : 300 , fat : 24, calories: 125 , cholesterol: 12, proteins: 3};
}

function parseWolframAlpha(rawData){
    console.log("Got data. start parsing.");
    var startFat = rawData.indexOf("total fat") + 11;
    var endFat = rawData.indexOf("|", startFat) - 3;
    var fat = parseInt(rawData.substring(startFat,endFat));

    var startCarbo = rawData.indexOf("total carbohydrates") + 21;
    var endCarbo = rawData.indexOf("|", startCarbo) - 3;
    var carbohidrates = parseInt(rawData.substring(startCarbo,endCarbo)); 

    var startProteins = rawData.indexOf("protein  ") + 9;
    var endProteins = rawData.indexOf("|", startProteins) - 3;
    var proteins = parseInt(rawData.substring(startProteins,endProteins)); 

    var startCholesterol = rawData.indexOf("cholesterol  ") + 13;
    var endCholesterol = rawData.indexOf("|", startCholesterol) - 3;
    var cholesterol = parseInt(rawData.substring(startCholesterol,endCholesterol)); 

    var startCalories = rawData.indexOf("tal calories  ") + 14;
    var endCalories = rawData.indexOf("|", startCalories) - 3;
    var calories = parseInt(rawData.substring(startCalories,endCalories)); 

    console.log("Fat:" + fat, {carbohidrates : carbohidrates, fat: fat, proteins: proteins, calories: calories} )
    console.log("finished parsing.");

    // if WIFI times out use locally stored data
    fallbackData = {
        4013143081078:  {carbohidrates : carbohidrates, fat: fat, proteins: proteins, calories: calories}

    };


    return {carbohidrates : carbohidrates, fat: fat, proteins: proteins, calories: calories};
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
    var productCode = JSON.parse(req.body.id);
    lastProductCode = productCode;
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

exports.getConsumptionsByUserId = function (req, res){
    var dummyConsumptions = 
    [
    {name : "milk", amount : 300, nutritionFacts : 
    { carbohidrates : 19 , fat : 24, calories: 125 , cholesterol: 12, proteins: 18}
},
{name : "coca cola", amount : 500, nutritionFacts : 
{ carbohidrates : 20 , fat : 82, calories: 129 , cholesterol: 30, proteins: 6}
},
{name : "coca cola", amount : 500, nutritionFacts : 
{ carbohidrates : 40 , fat : 65, calories: 83 , cholesterol: 30, proteins: 21}
}
];

console.log("Get consumptions.");
res.send(200, dummyConsumptions);
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
    //lastUserName = name;
    lastUserId = userId;

    console.log(lookupNutritionFacts(555, 300));

    res.send(200);
    goIfReady();
}

