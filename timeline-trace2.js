var fs = require('fs');
var readline = require('readline');
var Chrome = require('chrome-remote-interface');
var chromeLauncher = require('chrome-launcher');
var async = require('async');
var {spawnSync} = require('child_process');

var TRACE_CATEGORIES = ["-*", "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "toplevel", "blink.console", "disabled-by-default-devtools.timeline.stack", "disabled-by-default-devtools.screenshot", "disabled-by-default-v8.cpu_profile", "disabled-by-default-v8.cpu_profiler", "disabled-by-default-v8.cpu_profiler.hires"];

var rawEvents = [];

var heapChunks = "";

var windowObject = {};
windowObject["beforeLoad"] = []

var windowDiff = {};

var pageLoadTime = {};

var cacheCounter = 0

var program = require('commander');

var mkdirp = require('mkdirp');

var loadCounter = 0;

program
    .version("0.1.0")
    .option('-u, --url [url]', "The url to be traced")
    .option('-o , --output [output-dir]','path to the output directory for results','./trace')
    .option('-d , --device [device]','Device to run chrome on')
    .option('-h, --heap','Enable heap profiling')
    .option('-n, --network', 'Enable network profiling')
    .option('-t, --trace', 'Enable timeline tracing')
    .option('-j, --js-profiling', 'Enable jsprofiling of webpages')
    .option('-w, --warm','enable warm cache setting')
    .parse(process.argv)

const CDP = require('chrome-remote-interface');


function getChromeTrace(url,launcher){
    Chrome({local:true, port:9224},function (chrome) {
        with (chrome) {
            Page.enable();
            Network.enable();
            Runtime.enable();
            // Debugger.enable();
            // HeapProfiler.enable();
            Profiler.enable();
            // Disable cache (wonder if this works better than the browser...) 
            // Answer: it seems to work better from the eye ball test
            Network.emulateNetworkConditions({offline:false, latency:100, downloadThroughput:750*1024/8, uploadThroughput:250*1024/8,connectionType: "cellular3g"})
            Network.setCacheDisabled({cacheDisabled: true});
            // Profiler.setSamplingInterval({interval: 1000});
            // extractPageInformation(Runtime, "beforeLoad");

            if (program.warm) {
                console.log("Navigating the cold cache load");
                Page.navigate({ 'url' : url});
            }

            if (program.trace && !program.warm){

                startTracing(Tracing);
            }

            if (program.jsProfiling) {
                Profiler.start();
            }

            if (!program.warm) {
                console.log("started page navigation")
                Page.navigate({'url': url});
            }
            
            
            if (program.network){
                networkFile = program.output + "/" + url.substring(7,) + '/Network.trace';
                NetworkEventHandlers(Network, networkFile)
            }                

            if (program.heap) {
                HeapProfiler.addHeapSnapshotChunk(msg => heapChunks += msg.chunk);
                HeapProfiler.startTrackingHeapObjects();
            }

            var file = program.output + "/" + url.substring(7,) + '/';
            var jsPath = program.output + "/CPU/" + url.substring(7,) + '/'; 
            if (program.jsProfiling) mkdirp(jsPath)

             Tracing.dataCollected(function(data){
                var events = data.value;
                rawEvents = rawEvents.concat(events);
            });


            Tracing.tracingComplete().then(function () {
                console.log("tracing complete callback fired");
                mkdirp(file , function(err) {
                    if (err) console.log("Error file creating directory",err)
                    else {
                        // console.log(rawEvents.length);
                         fs.writeFileSync(file + 'Timeline.trace', JSON.stringify(rawEvents,null,2));
                         console.log('Trace file: ' + file + Date.now());
                         fs.writeFileSync(file + "page_load_time", url + "\t" + JSON.stringify(pageLoadTime))
                         // console.log("javascript execution impact: " + windowDiff);
                         chrome.close();
                         spawnSync("ps aux | grep 9224 | awk '{print $2}' | xargs kill -9",{shell:true});
                    }
                })
            });


            Page.loadEventFired(function () {
                console.log("Load event fired");
                if (program.warm && loadCounter == 0) {
                    loadCounter++;
                    if (program.trace) startTracing(Tracing);
                    console.log("Navigating load");
                    Page.navigate({'url': url});
                    return;
                }
                if (program.heap) HeapProfiler.takeHeapSnapshot();
                if (program.trace) {
                    Tracing.end();
                }
                extractPageLoadTime(Runtime);
                // launcher.kill()
                // extractPageInformation(Runtime, "afterLoad", file, chrome, url);
                // fetchEntireDOM(Runtime, file, chrome)
                if (program.heap) HeapProfiler.stopTrackingHeapObjects();
                if (program.jsProfiling) {
                    Profiler.stop().then(data => {
                        // console.log("stopped profiling " + JSON.stringify(data));
                        fs.writeFileSync(jsPath + 'jsProfile', JSON.stringify(data.profile));
                        // fs.writeFileSync(file + "page_load_time", url + "\t" + JSON.stringify(pageLoadTime))
                        console.log("Done writing the file");
                        chrome.close();
                        if (program.device == "mac") 
                            spawnSync("ps aux | grep 9222 | awk '{print $2}' | xargs kill -9",{shell:true});
                    });
                }
                // chrome.close();
                // spawnSync("ps aux | grep 9222 | awk '{print $2}' | xargs kill -9",{shell:true});
            });

        }
        }).on('error', function (e) {
            console.error('Cannot connect to Chrome' + url, e);
        });
}

function startTracing(Tracing,Page){
    console.log("Start capturing trace");
    Tracing.start({
        "categories":   TRACE_CATEGORIES.join(','),
        // "options":      "sampling-frequency=10000"  // 1000 is default and too slow.
    });
   
}

function fetchEntireDOM(Runtime, file, chrome){
    serializeWithStyle = fs.readFileSync("serializeWithStyles.js","utf-8")
    // Register SW
    Runtime.evaluate({expression: serializeWithStyle}, (err, result) => {
        console.log("Registered SW")
        Runtime.evaluate({
            returnByValue: true,
            expression: 'document.body.serializeWithStyles()'
        }, (err, result) => {
            console.log("Fetched the entire DOM")
            fs.writeFileSync(file + "DOM", result["result"]["value"])
            // Closing chrome now
            chrome.close()
        })
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
    Runtime.evaluate({expression: 'performance.timing.navigationStart'}).then( (result, err) => {
            pageLoadTime["startTime"] = result["result"]["value"]
        });
    Runtime.evaluate({expression: 'performance.timing.loadEventEnd'}).then( (result, err) => {
            pageLoadTime["endTime"] = result["result"]["value"]
            pageLoadTime["loadTime"] = pageLoadTime["endTime"] - pageLoadTime["startTime"];
        });
    Runtime.evaluate({expression: 'performance.timing.domContentLoadedEventEnd'}).then((result, err) => {
            pageLoadTime["domContentLoaded"] = result["result"]["value"]
        });
}

 function extractPageInformation(Runtime, when, file, chrome, url){
     Runtime.evaluate({
        returnByValue: true,
        expression: `Object.getOwnPropertyNames( window )`
    },(err, result) => {
        windowObject[when] = result["result"]["value"]
        if (when == "afterLoad") {
            extractValuesFromKeys(Runtime, windowObject[when].filter(findDuplicate), file, chrome, url)
        }
    });
}

function extractValuesFromKeys(Runtime, keyArray, file, chrome, url){
    // console.log("Fetching values for: " + keyArray)
    async.forEachOf(keyArray, function(result, key, callback) {
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
        fs.writeFileSync(file + "page_load_time", url + "\t" + JSON.stringify(pageLoadTime))
        console.log("Timing information file:" + JSON.stringify(pageLoadTime));
        if (program.heap) fs.writeFileSync(file + "Heap.trace", JSON.stringify(heapChunks))
        // chrome.close();
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
    // if (program.device == "mac") {
    //     console.log("Firing chrome");
    //     chromeLauncher.launch({
    //     port: 9222,
    //     chromeFlags: [
    //         // '--headless',
    //         // '--enable-logging',
    //         // '--v=1',
    //         // '--v8-cache-options=off',
    //         // '--v8-cache-strategies-for-cache-storage=off',
    //         '--disable-extensions',
    //         // '--no-first-run',
    //         // '--enable-devtools-experiments', 
    //         '--remote-debugging-port=9222',
    //         "--user-data-dir=TMPDIR/chrome-profiling"
    //         // '--no-default-browser-check'
    //         ]
    //     }).then(chrome => {
    //         dumpChromePid(chrome.pid)
    //         getChromeTrace(url, chrome)
    //     });
    // } else {
    //     getChromeTrace(url)
    // }

    getChromeTrace(url)
}

// urlList.on('line', (line) => {
//     console.log("read url from line: " + line)
//     launchChrome(line);
// });

launchChrome(program.url);






