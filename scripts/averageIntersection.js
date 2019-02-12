
/*
This file takes average of a metric provided the flag
*/

const fs = require('fs');
const util = require('util');

if (process.argv.length < 5){
    console.error("Usage: node averageIntersection.js <metric> <iterations> <path>")
}

function matchingExceptions(log1, log2, skipFirst){
    var exceptions1 = [];
    var exceptionCount = 0;
    if (!skipFirst) {
        log1.forEach((l) => {
            if (l.exceptionDetails){
                //Either there is an exceptions object or the description is contained inside the text object
                if (l.exceptionDetails.exception) {
                    var exception = l.exceptionDetails.exception.description || "";
                    exceptions1.push(exception.substr(0, exception.indexOf("at")));
                } else {
                    exceptions1.push(l.exceptionDetails.text);
                }
            }
        });
    } else {
        exceptions1 = log1;
    }
    var exceptions2 = [];
    log2.forEach((l) => {
        if (l.exceptionDetails){
                if (l.exceptionDetails.exception) {
                    var exception = l.exceptionDetails.exception.description || "";
                    exceptions2.push(exception.substr(0, exception.indexOf("at")));
                } else {
                    exceptions2.push(l.exceptionDetails.text);
                }
        }
    });
    //console.log(exceptions1);
    //console.log(exceptions2);
    var intersection = [];
    for (var ex1 in exceptions1){
        for (var ex2 in exceptions2){
            if (exceptions1[ex1] == exceptions2[ex2]) {
                exceptionCount++;
                intersection.push(exceptions1[ex1]);
                break;
            }
        }
    }
    //console.log(exceptions1);
    return intersection;


}

function calculateErrors(log){
    var count=0;
    log.forEach((l) => {
        if (l.exceptionDetails) {
            count++;
        }
    });
    return count;
}

if ( process.argv[2] == "-logs") {
    var firstFile = [];
    for (var i=1;i<Number(process.argv[3]);i++) {
        var skipFirst = true;
        var secondFile = JSON.parse(fs.readFileSync(process.argv[4].replace('{}', i+1),"utf-8"));
        if (!firstFile.length) {
            firstFile = JSON.parse(fs.readFileSync(process.argv[4].replace('{}', i),"utf-8"));
            skipFirst = false;
        }
        firstFile = matchingExceptions(firstFile, secondFile, skipFirst);
    }
    console.log(JSON.stringify(firstFile));

}