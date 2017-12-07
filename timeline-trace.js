var fs = require('fs');
var readline = require('readline');
var Chrome = require('chrome-remote-interface');
var chromeLauncher = require('chrome-launcher');
var async = require('async');

var TRACE_CATEGORIES = ["-*", "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "toplevel", "blink.console", "disabled-by-default-devtools.timeline.stack", "disabled-by-default-devtools.screenshot", "disabled-by-default-v8.cpu_profile", "disabled-by-default-v8.cpu_profiler", "disabled-by-default-v8.cpu_profiler.hires"];

var rawEvents = [];

var heapChunks = "";

var windowObject = {};

var windowDiff = {};

var pageLoadTime = {};

var cacheCounter = 0

var program = require('commander');

var mkdirp = require('mkdirp');

program
    .version("0.1.0")
    .option('-u, --url [url]', "The url to be traced")
    .option('-o , --output [output-dir]','path to the output directory for results','./trace')
    .option('-d , --device [device]','Device to run chrome on')
    .option('-h, --heap','Enable heap profiling')
    .parse(process.argv)

function getChromeTrace(url,launcher){

    Chrome(function (chrome) {
        with (chrome) {
            Page.enable();
            Network.enable();
            Runtime.enable();
            Debugger.enable();
            HeapProfiler.enable();
            // Disable cache (wonder if this works better than the browser...) 
            // Answer: it seems to work better from the eye ball test
            Network.setCacheDisabled({cacheDisabled: true});

            extractPageInformation(Runtime, "beforeLoad");

            // urlList.on('line', (line) => {
            Tracing.start({
                "categories":   TRACE_CATEGORIES.join(','),
                "options":      "sampling-frequency=10000"  // 1000 is default and too slow.
            });
            networkFile = program.output + "/" + url.substring(7,) + '/Network.trace';

            NetworkEventHandlers(Network, networkFile)

            if (program.heap) {
                HeapProfiler.addHeapSnapshotChunk(msg => heapChunks += msg.chunk);
                HeapProfiler.startTrackingHeapObjects();
            }

            Page.navigate({'url': url});

            var file = program.output + "/" + url.substring(7,) + '/';

            Page.loadEventFired(function () {
                if (program.heap) HeapProfiler.takeHeapSnapshot();
                Tracing.end();
                extractPageLoadTime(Runtime);
                extractPageInformation(Runtime, "afterLoad", file, chrome);
                fetchEntireDOM(Runtime, file)
                if (program.heap) HeapProfiler.stopTrackingHeapObjects();
            });


            Tracing.tracingComplete(function () {
                mkdirp(file , function(err) {
                    if (err) console.log("Error file creating directory",err)
                    else {
                         fs.writeFileSync(file + 'Timeline.trace', JSON.stringify(rawEvents, null, 2));
                         fs.writeFileSync(file + "page_load_time", url + "\t" + JSON.stringify(pageLoadTime))
                         if (program.heap) fs.writeFileSync(file + "Heap.trace", JSON.stringify(heapChunks))
                         console.log('Trace file: ' + file + Date.now());
                         console.log("Timing information file:" + JSON.stringify(pageLoadTime));
                         // console.log("javascript execution impact: " + windowDiff);
                    }
                })

                // chrome.close();
                // if (launcher) launcher.kill();
                // return;
            });

            Tracing.dataCollected(function(data){
                var events = data.value;
                rawEvents = rawEvents.concat(events);
            });
        }
        }).on('error', function (e) {
            console.error('Cannot connect to Chrome' + url, e);
        });
}

function fetchEntireDOM(Runtime, file){
    Runtime.evaluate({
        returnByValue: true,
        expression: 'document.body.outerHTML'
    }, (err, result) => {
        fs.writeFileSync(file + "DOM", result["result"]["value"])
    })
}

function findDuplicate( propName ) {
    return windowObject["beforeLoad"].indexOf( propName ) === -1;
}

function NetworkEventHandlers(Network, file){
    console.log("Network trace file: " + file)
    mkdirp(file.split('/').slice(0,-1).join('/'), function (err) {
        if (err)
            console.log("Error creating the network file path")
        else {
                Network.requestWillBeSent(function(data){
                    fs.appendFileSync(file, JSON.stringify({"Network.requestWillBeSent":data})+"\n");
                });
                Network.requestServedFromCache(function(data){
                    fs.appendFileSync(file, JSON.stringify({"Network.requestServedFromCache":data})+"\n");
                });

                Network.responseReceived(function(data){
                    fs.appendFileSync(file, JSON.stringify({"Network.responseReceived":data})+"\n");
                });

                Network.dataReceived(function(data){
                    fs.appendFileSync(file, JSON.stringify({"Network.dataReceived":data})+"\n");
                });

                Network.loadingFinished(function(data){
                    fs.appendFileSync(file, JSON.stringify({"Network.loadingFinished":data})+"\n");
                });
        }
    });

}

function extractPageLoadTime(Runtime){
    Runtime.evaluate({expression: 'performance.timing.navigationStart'}, (err, result) => {
            pageLoadTime["startTime"] = result["result"]["value"]
        });
    Runtime.evaluate({expression: 'performance.timing.loadEventEnd'}, (err, result) => {
            pageLoadTime["endTime"] = result["result"]["value"]
        });
    Runtime.evaluate({expression: 'performance.timing.domContentLoadedEventEnd'},(err, result) => {
            pageLoadTime["domContentLoaded"] = result["result"]["value"]
        });
}

 function extractPageInformation(Runtime, when, file, chrome){
     Runtime.evaluate({
        returnByValue: true,
        expression: `Object.getOwnPropertyNames( window )`
    },(err, result) => {
        windowObject[when] = result["result"]["value"]
        if (when == "afterLoad") {
            extractValuesFromKeys(Runtime, windowObject[when].filter(findDuplicate), file, chrome)
        }
    });
}

function extractValuesFromKeys(Runtime, keyArray, file, chrome){
    // console.log("Fetching values for: " + keyArray)
    async.forEachOf(keyArray, function(result, key, callback) {
        windowDiff = {}
        prop = keyArray[key]
        Runtime.evaluate({
            returnByValue: true,
            expression: `window[${JSON.stringify(prop)}]`
        },(err, result) => {
            // console.log(JSON.stringify(keyArray[key]), result)
            setGlobalWindowDiff(keyArray[key], result)
            callback();
        });
    }, function () {
        console.log("Done computing the js impact")
        fs.writeFileSync(file + "js_affect", JSON.stringify(windowDiff));
        chrome.close();
        // return windowDiff
    }); 
}

function setGlobalWindowDiff(key, result){
    if ( typeof result !== 'undefined' && result && result["result"] )
        windowDiff[key] = result["result"]["value"]
    else windowDiff[key] = "NULL"
}
function dumpChromePid(pid){
    mkdirp((program.output) , function(err){
    fs.writeFileSync(program.output + "/chrome.pid", pid)
    });
}

function launchChrome(url){
    console.log("Tracing url:" + url)
    if (program.device == "mac") {
        chromeLauncher.launch({
        port: 9222,
        chromeFlags: [
            '--headless',
            '--enable-logging',
            '--v=1',
            // '--v8-cache-options=off',
            // '--v8-cache-strategies-for-cache-storage=off',
            '--disable-extensions',
            '--no-first-run',
            '--enable-devtools-experiments', 
            '--remote-debugging-port=9222',
            "--user-data-dir=TMPDIR/chrome-profiling",
            '--no-default-browser-check'
            ]
        }).then((launcher) => {
            dumpChromePid(launcher.pid)
            getChromeTrace(url, launcher)
        });
    } else {
        getChromeTrace(url)
    }
}

// urlList.on('line', (line) => {
//     console.log("read url from line: " + line)
//     launchChrome(line);
// });

launchChrome(program.url);




