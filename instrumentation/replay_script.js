/*
The following replays the instrumented webpage and connect the chrome-remote-interface to analyse
the instrumented javascript trace.

usage: node replay_script.js [path-to-output-metadata-file] [path-to-output-invocations-file]
*/

var exec = require('child_process').exec
var spawn = require('child_process').spawn
var fs = require('fs')

if (process.argv.length < 4){
    console.log("Invalid command:\n Usage:  node replay_script.js [path-to-output-metadata-file] [path-to-output-invocations-file]");
    return;
}

//Replay chrome using mahimahi
//Commented out because spawn gives unresolved ENONT error

/*
var chromeReplayCommand = ' chromium-browser --remote-debugging-port=9222 --ignore-certificate-errors --user-data-dir=/tmp/nonexistent$(date +%s%N) www.nytimes.com  '
console.log("Replaying chrome using cmd:" + chromeReplayCommand);

//Replay the webpage using mahimahi replay shell 
exec(chromeReplayCommand, function(err, stdout, stderr){
	if (err) {
		console.log("An error was raised while trying to run chrome"+ err);
	}
});

spawn(chromeReplayCommand, {
	detached: true
}).on('error', function(err){
	console.log("error occured while running chrome in detached mode");
});
*/


var Chrome = require('chrome-remote-interface');

//Content extracted from the analysis
var invocations = [];
var functions = {};
var metadata = {};


Chrome(function (chrome) {
    with (chrome) {
        Page.enable();
        Network.enable();
        Runtime.enable();
        // Disable cache (wonder if this works better than the browser...) 
        // Answer: it seems to work better from the eye ball test
        Network.setCacheDisabled({cacheDisabled: true});
	    fetchInvocations = fs.readFileSync("analyse_instrumented_trace.js", "utf-8");

        // Run the analyze script to extract all the numbers
		Runtime.evaluate({expression: fetchInvocations}, (err, result) => {
			console.log("Fetch invocations ran successfully");
		});

        invocationsFetched = false;
        //Now fetch these numbers individually
        Runtime.evaluate({expression: 'invocations', returnByValue: true}, (err, result) => {
            // console.log(JSON.stringify(result))
            invocations = result["result"]["value"];
            invocationsFetched = true;

            fs.writeFileSync(process.argv[3], JSON.stringify(invocations));

            console.log("Invocations written to " + process.argv[3] + "\n");
        });

         Runtime.evaluate({expression: 'functions', returnByValue: true}, (err, result) => {
            functions = result["result"]["value"]
            while (!invocationsFetched){
                //Wait for the invocations to be fetched
            }
            populateMetadata();
            console.log("Metadata written to " + process.argv[2] + "\n");

            //Close the remote interface connector
            chrome.close();
         });


    }
}).on('error', function (e) {
     console.error('Cannot connect to Chrome', e);
});

function populateMetadata(){
    metadata["invocations"] = invocations.length;
    metadata["functions"] = Object.keys(functions).length;
    metadata["uniqueInvocations"] = getUniqueFunctions(invocations).length;

    //Dump metadata in a file
    fs.writeFileSync(process.argv[2], JSON.stringify(metadata));
}

function getUniqueFunctions(invocations){
    uniqueFunctions = [];
    invocations.forEach(function(entry){
        if (uniqueFunctions.indexOf(entry.nodeId) < 0){
            uniqueFunctions.push(entry.nodeId);
        }
    });

    return uniqueFunctions;
}

var modifiedFunctionCounter = 0
invocations.forEach(function(entry){
    if (entry.globalDelta){
        if (entry.globalDelta[2] - entry.globalDelta[1] > 1){
            // console.log(JSON.stringify(entry));
            modifiedFunctionCounter++;
        }
    }
    if (uniqueFunctions.indexOf(entry.nodeId) < 0){
        uniqueFunctions.push(entry.nodeId);
    }
});
// console.log("Total number of unqiue functions executed " + uniqueFunctions.length);
// console.log("Total number of modified functions: " + modifiedFunctionCounter);

// var totalTimeSaved = 0
// invocations.forEach(function(entry){
//  if (entry.globalDelta){
//      if (entry.globalDelta[2] - entry.globalDelta[1] <= 1){
//          totalTimeSaved += entry.duration;
//      }
//  }
// });
// console.log("Total time that can be saved: " + totalTimeSaved);