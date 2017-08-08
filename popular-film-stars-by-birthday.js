var express = require('express');
var Webtask = require('webtask-tools');
var bodyParser = require('body-parser');
var http = require('http');
var cheerio = require('cheerio');

var app = express();

const DataURL = 'http://www.imdb.com/search/';

//Takes an html document from IMDB and parses out the names
function ParseNames(HtmlBody) {
    //this is the entire HTML for the search results.
    var $ = cheerio.load(HtmlBody);

    //The list of stored names
    var FilmStars = [];

    //we want to analyze just the detailed rows 
    //(IMDB doesnt implement the thead or th syntax, so we need to skip the 
    //first tr using the tr.detailed clause)
    $('table.results tr.detailed').each(function (x, row) {
        //parse out the names found in each row. particularly in the image link
        var rowHtml = cheerio.load($(this).html());
        var StarName  = rowHtml('td.image a').attr('title');
        var Link = rowHtml('td.image a img').attr('src');
        if(typeof StarName === "string" && typeof Link === "string")
            FilmStars.push({FilmStar:StarName, ImageLink:Link});
        
    });
    return FilmStars;
}

//This function serves to get the HTML document from IMDB
function CallParse(Month, Day, cb) {
    //Simple input tests
    if (typeof cb != 'function') {
        console.error("Warning! Callback is required");
        cb({statusCode: 400, message: "Callback required.", name: "parseerror" });
        return;
    }

    if (!Number.isInteger(Month)) {
        cb({statusCode: 400, message: "Month in incorrect format.", name: "parseerror" });
        return;
    }

    if (!Number.isInteger(Day)) {
        cb({statusCode: 400, message: "Month in incorrect format.", name: "parseerror" });
        return;
    }

    http.get(DataURL + 'name?birth_monthday=' + Month.toString() + '-' + Day.toString() + '')
        //If we run into an error, we store it in the call back and let the caller figure it out   
        //Errors are stored in first parameter per the node standard
        .on('error', function (error) {
            cb(error);
        })
        .on('response', function (response) {
            if (response.statusCode === 200) {
                console.log("Request successful. Buckle up, we are parsing.");

                var Body = '';

                //Reading into the Body variable is asynchronous
                response.on('data', (chunk) => { Body += chunk });

                //An event called when the body has finished reading
                response.on('end', () => {
                    try {
                        var FilmStarsBirthday = ParseNames(Body);
                        cb(null, { BirthdayMonth: Month, BirthdayDay: Day, FilmStars: FilmStarsBirthday });
                        return response;
                    } catch (err) {
                        cb(err);
                    }
                });
            }
        });
}

app.use(bodyParser.json());

//GET /: The GetAll version of the function. Gets the birthdays based off of today
app.get('/', function (req, res) {
    var CurrDay = new Date();
    CallParse(CurrDay.getMonth() + 1, CurrDay.getDate(), function (err, response) {
        if (err !== null) {
            res.status(400).json(err.error);
        }
        res.json(response);
    });

});
//GET: /{MONTH}/{DAY}: Gets the birthdays based off of a particular month and day. 
app.get('/:month/:day', function (req, res) {
    try {
        var Month = parseInt(req.params.month);
        var Day = parseInt(req.params.day);
    }
    catch (err) {
        res.status(400).json({statusCode: 400, message: "Could not parse month and day parameters.", name: "parse error" });
    }

    if(Month>12)
        res.status(400).json({statusCode: 400,message:"The month is wrong. Please enter a number between 1-12 in the format /{MONTH}/{DAY}", name:"validation error"})
    if(Day>31)
        res.status(400).json({statusCode: 400,message:"The day is wrong. Please enter a number between 1-31 in the format /{MONTH}/{DAY}", name:"validation error"})
    CallParse(Month, Day, function (err, response) {
        if (err !== null) {
            res.json(err.error);
        }
        res.json(response);
    });
});

//GET: /{MONTH}/ A friendly fallback if the Day is not entered
app.get('/:month/:day', function (req, res) {
    try {
        var Month = parseInt(req.params.month);
    }
    catch (err) {
        res.status(400).json({ message: "Could not parse month parameter.", name: "parse error" });
    }

    res.status(400).json({message:"Please enter a day. The uri should be in the format /{MONTH}/{DAY}", name:"validation error"});
});

module.exports = Webtask.fromExpress(app);