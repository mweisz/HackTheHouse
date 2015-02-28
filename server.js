var items = require("./routes/items");

var express        = require("express"),
    //morgan         = require('morgan'),
    bodyParser     = require('body-parser'),
    methodOverride = require('method-override'),

    api = require('./api.js'),

    app     = express(),
    // router  = express.Router(),
    port    = process.env.PORT || 5006;

//app.use(morgan('dev'));


app.use(bodyParser.urlencoded( { extended: true } ));
app.use(bodyParser.json());
app.use(methodOverride());

app.use(function (req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    next();
});

// app.use(router);
// router.use('/api', api.router);


app.get('/test', items.postItem);



var server = app.listen(port, function () {
    console.log('App started on http://%s:%d/', server.address().address, server.address().port);
});


