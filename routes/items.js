// Database

var Db = require('mongodb').Db;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSONPure;
var MongoClient = require('mongodb').MongoClient;
var http = require('http');

var db = new Db('hackTheHouse', new Server("127.0.0.1", 27017,
 {auto_reconnect: false, poolSize: 4}), {w:0, native_parser: false});


// Globals
var lastProductCode;
var lastUserId;
var lastWeight = undefined; 
var previousWeight = 0;


var users = {
    12344 : "Jonas",
    123 : "User B"
}

var barcodes = {
    111 : "Coca Cola", 
    555 : "Milk",
    4013143081078 : "Water"
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
    var options = { host: 'www.random.org',
                    path: '/integers/?num=1&min=1&max=10&col=1&base=10&format=plain&rnd=new'};

    function callback(response){
        console.log("RESPONSE");
    }
   // http.request(options, )


    return { carbohidrates : 300 , fat : 24, calories: 125 , cholesterol: 12, proteins: 3};
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

    res.send(200);
    goIfReady();
}

